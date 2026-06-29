import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255, null=True, blank=True)
    preferred_language = models.CharField(max_length=5, default='en')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class ActiveManager(models.Manager):
    """Manager that automatically filters out soft-deleted records."""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    """Manager that returns all records including soft-deleted ones."""
    pass


class Card(models.Model):
    CARD_TYPES = [('credit', 'Credit'), ('debit', 'Debit'), ('prepaid', 'Prepaid'), ('covered', 'Covered')]
    CARD_CATEGORIES = [
        ('classic', 'Classic'),
        ('silver', 'Silver'),
        ('gold', 'Gold'),
        ('platinum', 'Platinum'),
        ('signature', 'Signature'),
        ('infinite', 'Infinite'),
        ('titanium', 'Titanium'),
        ('business', 'Business'),
        ('world', 'World'),
        ('world_elite', 'World Elite'),
    ]
    CARD_OWNERSHIP = [
        ('primary', 'Primary'),
        ('supplementary', 'Supplementary'),
        ('joint', 'Joint'),
    ]
    CARD_CLASSIFICATIONS = [
        ('personal', 'Personal'),
        ('travel', 'Travel'),
        ('business', 'Business'),
        ('rewards', 'Rewards'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cards')
    card_name = models.CharField(max_length=255)
    bank_name = models.CharField(max_length=100)
    card_type = models.CharField(max_length=50, choices=CARD_TYPES)
    card_category = models.CharField(max_length=50, choices=CARD_CATEGORIES, null=True, blank=True)
    card_ownership = models.CharField(max_length=50, choices=CARD_OWNERSHIP, null=True, blank=True)
    card_network = models.CharField(max_length=50, null=True, blank=True)
    card_number_encrypted = models.BinaryField()
    card_last_four = models.CharField(max_length=4)
    cardholder_name_encrypted = models.BinaryField(null=True, blank=True)
    expiry_month = models.SmallIntegerField(null=True, blank=True)
    expiry_year = models.SmallIntegerField(null=True, blank=True)
    cvv_encrypted = models.BinaryField(null=True, blank=True)
    iban_encrypted = models.BinaryField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    color_hex = models.CharField(max_length=7, null=True, blank=True)
    is_favorite = models.BooleanField(default=False)
    available_balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    balance_currency = models.CharField(max_length=3, default='AED')
    
    # Credit Card Management Fields
    statement_date = models.IntegerField(null=True, blank=True, help_text='Day of month for statement (1-31)')
    payment_due_date = models.IntegerField(null=True, blank=True, help_text='Day of month for payment due (1-31)')
    minimum_payment = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Fixed minimum amount (optional if percentage set)')
    minimum_payment_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Min payment as % of amount due (e.g. 5 for 5%), varies by bank')
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Total credit limit')
    current_balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Current outstanding balance')
    last_payment_date = models.DateField(null=True, blank=True)
    last_payment_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    card_benefits = models.TextField(null=True, blank=True, help_text='JSON array of card benefits/features')

    RENEWAL_TYPES = [
        ('automatic', 'Automatic'),
        ('manual', 'Manual'),
        ('conditional', 'Conditional'),
    ]
    # Fees, Renewal & Contact
    late_payment_fee = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    over_limit_fee = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    supplementary_card_fee = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    annual_fee = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    fee_due_date = models.DateField(null=True, blank=True)
    renewal_type = models.CharField(max_length=20, choices=RENEWAL_TYPES, null=True, blank=True)
    has_waiver_condition = models.BooleanField(default=False)
    waiver_condition = models.TextField(null=True, blank=True)
    card_replacement_fee = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    account_manager_name = models.CharField(max_length=255, null=True, blank=True)
    account_manager_phone = models.CharField(max_length=50, null=True, blank=True)
    bank_emails = models.TextField(null=True, blank=True, help_text='JSON array of bank email addresses')
    issue_date = models.DateField(null=True, blank=True)
    classification = models.CharField(max_length=50, choices=CARD_CLASSIFICATIONS, null=True, blank=True)

    # Points & Rewards
    points_earn_rate = models.FloatField(null=True, blank=True, default=1.0,
        help_text='Points earned per 1 AED spent')
    points_value_fils = models.FloatField(null=True, blank=True, default=5.0,
        help_text='Value of 1 point in fils (5 = 0.005 AED per point)')

    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        db_table = 'cards'
        indexes = [models.Index(fields=['user_id'])]


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        # legacy lowercase (existing data)
        ('purchase', 'Purchase'),
        ('withdrawal', 'Withdrawal'),
        ('payment', 'Payment'),
        ('refund', 'Refund'),
        ('transfer', 'Transfer'),
        ('deposit', 'Deposit'),
        # new types
        ('PURCHASE', 'Purchase'),
        ('REFUND', 'Refund (Merchant)'),
        ('REVERSAL', 'Reversal / Void'),
        ('CARD_PAYMENT', 'Card Payment'),
        ('CASH_WITHDRAWAL', 'Cash Withdrawal (ATM)'),
        ('CASH_ADVANCE', 'Cash Advance'),
        ('TRANSFER', 'Transfer'),
        ('WALLET_TOPUP', 'Wallet Top-Up'),
        ('BALANCE_TRANSFER', 'Balance Transfer'),
        ('INSTALLMENT_PRINCIPAL', 'Installment / BNPL'),
        ('BANK_FEE', 'Bank Fee'),
        ('FINANCE_CHARGE', 'Finance Charge / Interest'),
        ('FOREIGN_EXCHANGE_FEE', 'Foreign Exchange Fee'),
        ('CASHBACK', 'Cashback'),
        ('REWARD_CREDIT', 'Reward / Miles Credit'),
        ('CHARGEBACK', 'Chargeback'),
        ('ADJUSTMENT', 'Adjustment'),
        ('PREAUTH_HOLD', 'Pre-Auth Hold'),
        ('PREAUTH_RELEASE', 'Pre-Auth Release'),
        ('QUASI_CASH', 'Quasi-Cash'),
        ('UNKNOWN', 'Unknown'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    card = models.ForeignKey(Card, on_delete=models.SET_NULL, null=True, related_name='transactions')
    transaction_type = models.CharField(max_length=50, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=3, default='AED')
    merchant_name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    transaction_date = models.DateTimeField()
    source = models.CharField(max_length=50, default='manual')
    statement = models.ForeignKey('Statement', on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        db_table = 'transactions'
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['card_id']),
            models.Index(fields=['transaction_date']),
        ]


class Statement(models.Model):
    """Stores metadata for each imported bank statement."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='statements')
    card = models.ForeignKey('Card', on_delete=models.SET_NULL, null=True, blank=True, related_name='statements')
    bank_name = models.CharField(max_length=100)
    card_name = models.CharField(max_length=255, null=True, blank=True)
    card_last_four = models.CharField(max_length=4, null=True, blank=True)
    cardholder_name = models.CharField(max_length=255, null=True, blank=True)
    statement_period_from = models.DateField(null=True, blank=True)
    statement_period_to = models.DateField(null=True, blank=True)
    statement_balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    available_balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    payment_due_full_date = models.DateField(null=True, blank=True)
    payment_due_day = models.IntegerField(null=True, blank=True)
    minimum_payment = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='AED')
    transactions_imported = models.IntegerField(default=0)
    transactions_skipped = models.IntegerField(default=0)
    imported_at = models.DateTimeField(auto_now_add=True)
    file_path = models.CharField(max_length=500, null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_type = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'statements'
        ordering = ['-imported_at']
        indexes = [models.Index(fields=['user_id']), models.Index(fields=['card_id'])]


class CashEntry(models.Model):
    ENTRY_TYPES = [('income', 'Income'), ('expense', 'Expense')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cash_entries')
    entry_type = models.CharField(max_length=50, choices=ENTRY_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=3, default='AED')
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    entry_date = models.DateTimeField(default=timezone.now)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        db_table = 'cash_entries'
        indexes = [models.Index(fields=['user_id'])]


class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    title = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chat_sessions'
        indexes = [models.Index(fields=['user_id'])]


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20)  # user, assistant
    content = models.TextField()
    tool_calls = models.JSONField(null=True, blank=True)
    tool_results = models.JSONField(null=True, blank=True)
    tokens_used = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        indexes = [models.Index(fields=['session_id'])]
        ordering = ['created_at']


class BankPassword(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bank_passwords')
    bank_name = models.CharField(max_length=100)
    password_encrypted = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bank_passwords'
        unique_together = [('user', 'bank_name')]
        indexes = [models.Index(fields=['user_id'])]

    def __str__(self):
        return f'{self.user.email} - {self.bank_name}'


class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        db_table = 'password_reset_tokens'

    def __str__(self):
        return f'{self.user.email} - {self.token[:10]}'


class WebAuthnCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='webauthn_credentials')
    credential_id = models.TextField(unique=True)  # base64url encoded
    public_key = models.TextField()  # base64url encoded
    sign_count = models.IntegerField(default=0)
    device_name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'webauthn_credentials'
        indexes = [models.Index(fields=['user_id'])]

    def __str__(self):
        return f'{self.user.email} - {self.device_name or self.credential_id[:20]}'
