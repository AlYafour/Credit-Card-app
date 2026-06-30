import re
import logging
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Card, Transaction, CashEntry, ChatSession, ChatMessage, MerchantGroup, MerchantRule, Project, AuditLog
from .services import encryption_service, detect_card_network, extract_last_four

logger = logging.getLogger(__name__)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'preferred_language', 'is_active']
        read_only_fields = ['id', 'is_active']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['email', 'password', 'full_name', 'preferred_language']
    
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class CardSerializer(serializers.ModelSerializer):
    card_number = serializers.CharField(write_only=True, required=False)
    cardholder_name = serializers.CharField(write_only=True, required=False)
    cvv = serializers.CharField(write_only=True, required=False)
    iban = serializers.CharField(write_only=True, required=False)
    utilization_percentage = serializers.SerializerMethodField()
    total_points_earned = serializers.SerializerMethodField()

    class Meta:
        model = Card
        fields = [
            'id', 'card_name', 'bank_name', 'card_type', 'card_category', 'card_ownership', 'card_network',
            'card_last_four', 'expiry_month', 'expiry_year', 'notes',
            'color_hex', 'is_favorite', 'available_balance', 'balance_currency',
            'statement_date', 'payment_due_date', 'minimum_payment', 'minimum_payment_percentage',
            'credit_limit', 'current_balance', 'last_payment_date', 'last_payment_amount', 'card_benefits',
            'late_payment_fee', 'over_limit_fee', 'supplementary_card_fee', 'annual_fee',
            'fee_due_date', 'renewal_type', 'has_waiver_condition', 'waiver_condition',
            'card_replacement_fee', 'account_manager_name', 'account_manager_phone', 'bank_emails',
            'issue_date', 'classification',
            'points_earn_rate', 'points_value_fils',
            'utilization_percentage', 'total_points_earned',
            'created_at', 'updated_at',
            'card_number', 'cardholder_name', 'cvv', 'iban'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'card_last_four', 'utilization_percentage', 'total_points_earned']

    def get_utilization_percentage(self, obj):
        if obj.credit_limit and obj.credit_limit > 0 and obj.current_balance is not None:
            return round(float(obj.current_balance) / float(obj.credit_limit) * 100, 1)
        return None

    def get_total_points_earned(self, obj):
        if not obj.points_earn_rate:
            return 0
        from django.db.models import Sum
        result = obj.transactions.filter(
            is_deleted=False,
            transaction_type__in=['PURCHASE', 'CARD_PAYMENT'],
        ).aggregate(total=Sum('amount'))
        total_spend = float(result['total'] or 0)
        return round(total_spend * obj.points_earn_rate)
    
    def validate_card_number(self, value):
        if value:
            digits = re.sub(r'\D', '', value)
            if digits and not (13 <= len(digits) <= 19):
                raise serializers.ValidationError('Card number must be 13-19 digits')
        return value

    def validate_expiry_month(self, value):
        if value is not None and not (1 <= value <= 12):
            raise serializers.ValidationError('Month must be between 1 and 12')
        return value

    def validate_expiry_year(self, value):
        if value is None:
            return value
        # Accept 2-digit years (24-99) or 4-digit years (2020-2100)
        if 20 <= value <= 99:
            return value  # 2-digit year e.g. 30 → stored as 30
        if 2020 <= value <= 2100:
            return value % 100  # normalize 4-digit to 2-digit e.g. 2030 → 30
        raise serializers.ValidationError('Invalid year (use YY format, e.g. 30)')

    def validate_cvv(self, value):
        if value and not re.match(r'^\d{3,4}$', value):
            raise serializers.ValidationError('CVV must be 3-4 digits')
        return value

    def create(self, validated_data):
        user = self.context['request'].user

        card_number = validated_data.pop('card_number', '') or ''
        cardholder_name = validated_data.pop('cardholder_name', None)
        cvv = validated_data.pop('cvv', None)
        iban = validated_data.pop('iban', None)

        # Ensure strings for encryption (API may send numbers)
        card_number = str(card_number).strip() if card_number is not None else ''
        cardholder_name = str(cardholder_name).strip() if cardholder_name else None
        cvv = str(cvv).strip() if cvv else None
        iban = str(iban).strip() if iban else None

        if not validated_data.get('card_network') and card_number:
            validated_data['card_network'] = detect_card_network(card_number)

        card_last_four = extract_last_four(card_number) if card_number else ''

        try:
            card = Card.objects.create(
                user=user,
                card_number_encrypted=encryption_service.encrypt(card_number),
                card_last_four=card_last_four,
                cardholder_name_encrypted=encryption_service.encrypt(cardholder_name) if cardholder_name else None,
                cvv_encrypted=encryption_service.encrypt(cvv) if cvv else None,
                iban_encrypted=encryption_service.encrypt(iban) if iban else None,
                **validated_data
            )
            # Auto-compute current_balance (outstanding) = credit_limit - available_balance
            if card.credit_limit is not None and card.available_balance is not None:
                card.current_balance = float(card.credit_limit) - float(card.available_balance)
                card.save(update_fields=['current_balance'])
            return card
        except Exception as e:
            logger.exception('Card create failed: %s', e)
            raise serializers.ValidationError(
                {'detail': 'Could not save card. Please check your data and try again.'}
            )
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        reveal = self.context.get('reveal', False)

        # Always derive available_balance from credit_limit - current_balance
        credit_limit = data.get('credit_limit')
        current_balance = data.get('current_balance')
        if credit_limit is not None and current_balance is not None:
            data['available_balance'] = float(credit_limit) - float(current_balance)

        if reveal:
            try:
                if instance.card_number_encrypted:
                    data['card_number'] = encryption_service.decrypt(instance.card_number_encrypted)
            except Exception as e:
                logger.error(f'Error decrypting card_number: {e}')
                data['card_number'] = ''
            
            try:
                if instance.cardholder_name_encrypted:
                    data['cardholder_name'] = encryption_service.decrypt(instance.cardholder_name_encrypted)
            except Exception as e:
                logger.error(f'Error decrypting cardholder_name: {e}')
                data['cardholder_name'] = ''
            
            try:
                if instance.cvv_encrypted:
                    data['cvv'] = encryption_service.decrypt(instance.cvv_encrypted)
            except Exception as e:
                logger.error(f'Error decrypting cvv: {e}')
                data['cvv'] = ''
            
            try:
                if instance.iban_encrypted:
                    data['iban'] = encryption_service.decrypt(instance.iban_encrypted)
            except Exception as e:
                logger.error(f'Error decrypting iban: {e}')
                data['iban'] = ''
        
        return data


class CardUpdateSerializer(serializers.ModelSerializer):
    card_number = serializers.CharField(write_only=True, required=False)
    cardholder_name = serializers.CharField(write_only=True, required=False)
    cvv = serializers.CharField(write_only=True, required=False)
    iban = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Card
        fields = [
            'card_name', 'bank_name', 'card_type', 'card_category', 'card_ownership', 'card_network',
            'expiry_month', 'expiry_year', 'notes', 'color_hex',
            'is_favorite', 'available_balance', 'balance_currency',
            'statement_date', 'payment_due_date', 'minimum_payment', 'minimum_payment_percentage',
            'credit_limit', 'current_balance', 'last_payment_date', 'last_payment_amount', 'card_benefits',
            'late_payment_fee', 'over_limit_fee', 'supplementary_card_fee', 'annual_fee',
            'fee_due_date', 'renewal_type', 'has_waiver_condition', 'waiver_condition',
            'card_replacement_fee', 'account_manager_name', 'account_manager_phone', 'bank_emails',
            'issue_date', 'classification',
            'card_number', 'cardholder_name', 'cvv', 'iban'
        ]
    
    def validate_card_number(self, value):
        if value:
            digits = re.sub(r'\D', '', value)
            if digits and not (13 <= len(digits) <= 19):
                raise serializers.ValidationError('Card number must be 13-19 digits')
        return value

    def validate_expiry_year(self, value):
        if value is None:
            return value
        if 20 <= value <= 99:
            return value
        if 2020 <= value <= 2100:
            return value % 100
        raise serializers.ValidationError('Invalid year (use YY format, e.g. 30)')

    def validate_cvv(self, value):
        if value and not re.match(r'^\d{3,4}$', value):
            raise serializers.ValidationError('CVV must be 3-4 digits')
        return value
    
    def update(self, instance, validated_data):
        # Handle encrypted fields
        card_number = validated_data.pop('card_number', None)
        cardholder_name = validated_data.pop('cardholder_name', None)
        cvv = validated_data.pop('cvv', None)
        iban = validated_data.pop('iban', None)
        
        # Update card_number if provided
        if card_number is not None:
            instance.card_number_encrypted = encryption_service.encrypt(card_number)
            instance.card_last_four = extract_last_four(card_number)
            # Auto-detect network if not set
            if not validated_data.get('card_network') and card_number:
                validated_data['card_network'] = detect_card_network(card_number)
        
        # Update cardholder_name if provided
        if cardholder_name is not None:
            instance.cardholder_name_encrypted = encryption_service.encrypt(cardholder_name) if cardholder_name else None
        
        # Update cvv if provided
        if cvv is not None:
            instance.cvv_encrypted = encryption_service.encrypt(cvv) if cvv else None
        
        # Update iban if provided
        if iban is not None:
            instance.iban_encrypted = encryption_service.encrypt(iban) if iban else None
        
        # Update other fields
        for key, value in validated_data.items():
            if value is not None:
                setattr(instance, key, value)

        # Auto-compute current_balance (outstanding) = credit_limit - available_balance
        if instance.credit_limit is not None and instance.available_balance is not None:
            instance.current_balance = float(instance.credit_limit) - float(instance.available_balance)

        instance.save()
        return instance


class TransactionSerializer(serializers.ModelSerializer):
    # Declared explicitly so we can normalize lowercase legacy values before choices validation
    transaction_type = serializers.CharField(max_length=50)
    card_id = serializers.UUIDField(required=False, allow_null=True)
    merchant_group_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    project_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    card_name = serializers.SerializerMethodField()
    card_last_four = serializers.SerializerMethodField()
    merchant_group_name = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    receipt_url = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'card', 'card_id', 'card_name', 'card_last_four',
            'transaction_type', 'amount', 'currency',
            'merchant_name', 'description', 'category', 'transaction_date',
            'source', 'expense_type',
            'merchant_group', 'merchant_group_id', 'merchant_group_name',
            'vat_amount', 'is_vat_inclusive',
            'receipt_url',
            'approval_status', 'approved_by', 'approved_by_name', 'approval_note',
            'project', 'project_id', 'project_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'card', 'card_name', 'card_last_four',
            'merchant_group', 'merchant_group_name',
            'project', 'project_name',
            'approved_by', 'approved_by_name',
            'receipt_url',
            'created_at', 'updated_at',
        ]
    
    def get_card_name(self, obj):
        return obj.card.card_name if obj.card else None

    def get_card_last_four(self, obj):
        return obj.card.card_last_four if obj.card else None

    def get_merchant_group_name(self, obj):
        return obj.merchant_group.name if obj.merchant_group else None

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None

    def get_receipt_url(self, obj):
        if obj.receipt_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.receipt_file.url)
            return obj.receipt_file.url
        return None

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name or obj.approved_by.email if obj.approved_by else None
    
    def to_representation(self, instance):
        """Ensure card_id is included in response"""
        data = super().to_representation(instance)
        if instance.card:
            data['card_id'] = str(instance.card.id)
        else:
            data['card_id'] = None
        return data
    
    def validate_transaction_type(self, value):
        """Accept legacy lowercase types and normalize to canonical uppercase values."""
        _TYPE_MAP = {
            'purchase': 'PURCHASE', 'payment': 'CARD_PAYMENT', 'refund': 'REFUND',
            'withdrawal': 'CASH_WITHDRAWAL', 'transfer': 'TRANSFER', 'deposit': 'WALLET_TOPUP',
            'cash_advance': 'CASH_ADVANCE', 'fee': 'BANK_FEE', 'interest': 'FINANCE_CHARGE',
            'cashback': 'CASHBACK', 'reward': 'REWARD_CREDIT',
        }
        normalized = _TYPE_MAP.get(value, value.upper() if value else value)
        valid = {t[0] for t in self.Meta.model.TRANSACTION_TYPES}
        if normalized not in valid:
            raise serializers.ValidationError(f'"{value}" is not a valid transaction type.')
        return normalized

    def validate_amount(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero')
        return value

    def validate_currency(self, value):
        allowed = {'AED', 'USD', 'EUR', 'GBP', 'SAR', 'EGP', 'KWD', 'BHD', 'QAR', 'OMR', 'JOD', 'INR'}
        if value and value.upper() not in allowed:
            raise serializers.ValidationError(f'Currency must be one of: {", ".join(sorted(allowed))}')
        return value.upper() if value else value

    def create(self, validated_data):
        # user can come from save(user=request.user) or context; avoid duplicate in create()
        user = validated_data.pop('user', None) or self.context['request'].user
        card_id = validated_data.pop('card_id', None)
        project_id = validated_data.pop('project_id', None)

        # Convert transaction_date string to datetime if needed
        transaction_date = validated_data.get('transaction_date')
        if isinstance(transaction_date, str):
            from django.utils.dateparse import parse_datetime, parse_date
            parsed_datetime = parse_datetime(transaction_date)
            if not parsed_datetime:
                parsed_date = parse_date(transaction_date)
                if parsed_date:
                    from django.utils import timezone
                    validated_data['transaction_date'] = timezone.make_aware(
                        timezone.datetime.combine(parsed_date, timezone.datetime.min.time())
                    )
            else:
                validated_data['transaction_date'] = parsed_datetime
        
        # Get card if card_id provided - reject if card doesn't exist
        card = None
        if card_id:
            from .models import Card
            try:
                card = Card.objects.get(id=card_id, user=user)
            except Card.DoesNotExist:
                raise serializers.ValidationError(
                    {'card_id': 'Card not found. Please select a valid card or leave empty.'}
                )
        
        project = None
        if project_id:
            try:
                project = Project.objects.get(id=project_id, user=user)
            except Project.DoesNotExist:
                pass

        transaction = Transaction.objects.create(
            user=user,
            card=card,
            project=project,
            **validated_data
        )
        return transaction


class CashEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CashEntry
        fields = [
            'id', 'entry_type', 'amount', 'currency', 'description',
            'category', 'entry_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChatSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = ['id', 'title', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'role', 'content', 'tool_calls', 'tool_results',
            'tokens_used', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MerchantRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MerchantRule
        fields = ['id', 'merchant_name', 'match_type', 'created_at']
        read_only_fields = ['id', 'created_at']


class MerchantGroupSerializer(serializers.ModelSerializer):
    rules = MerchantRuleSerializer(many=True, read_only=True)
    transaction_count = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    monthly_spent = serializers.SerializerMethodField()

    class Meta:
        model = MerchantGroup
        fields = [
            'id', 'name', 'group_type', 'color', 'icon',
            'monthly_budget', 'rules',
            'transaction_count', 'total_spent', 'monthly_spent',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_transaction_count(self, obj):
        return obj.transactions.filter(is_deleted=False).count()

    def get_total_spent(self, obj):
        from django.db.models import Sum
        result = obj.transactions.filter(is_deleted=False).aggregate(total=Sum('amount'))
        return float(result['total'] or 0)

    def get_monthly_spent(self, obj):
        from django.db.models import Sum
        from django.utils import timezone
        now = timezone.now()
        result = obj.transactions.filter(
            is_deleted=False,
            transaction_date__year=now.year,
            transaction_date__month=now.month,
        ).aggregate(total=Sum('amount'))
        return float(result['total'] or 0)


class ProjectSerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    monthly_spent = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'color', 'description', 'is_active',
            'transaction_count', 'total_spent', 'monthly_spent',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'transaction_count', 'total_spent', 'monthly_spent']

    def get_transaction_count(self, obj):
        return obj.transactions.filter(is_deleted=False).count()

    def get_total_spent(self, obj):
        from django.db.models import Sum
        result = obj.transactions.filter(is_deleted=False).aggregate(total=Sum('amount'))
        return float(result['total'] or 0)

    def get_monthly_spent(self, obj):
        from django.db.models import Sum
        from django.utils import timezone
        now = timezone.now()
        result = obj.transactions.filter(
            is_deleted=False,
            transaction_date__year=now.year,
            transaction_date__month=now.month,
        ).aggregate(total=Sum('amount'))
        return float(result['total'] or 0)


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'action', 'model_name',
            'object_id', 'object_repr', 'changes', 'ip_address', 'created_at',
        ]
        read_only_fields = fields

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None
