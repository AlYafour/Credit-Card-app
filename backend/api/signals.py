from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='api.Transaction')
def auto_classify_transaction(sender, instance, created, **kwargs):
    """On each Transaction save, try to match a MerchantRule and set expense_type."""
    if not instance.merchant_name:
        return

    from .models import MerchantRule

    rules = MerchantRule.objects.filter(
        group__user=instance.user
    ).select_related('group').order_by('match_type')  # exact first

    merchant_lower = instance.merchant_name.lower()
    matched_group = None

    for rule in rules:
        name = rule.merchant_name.lower()
        if rule.match_type == 'exact' and merchant_lower == name:
            matched_group = rule.group
            break
        elif rule.match_type == 'starts_with' and merchant_lower.startswith(name):
            matched_group = rule.group
            break
        elif rule.match_type == 'contains' and name in merchant_lower:
            matched_group = rule.group
            break

    new_expense_type = matched_group.group_type if matched_group else 'unclassified'
    if new_expense_type == 'mixed':
        new_expense_type = 'unclassified'

    if instance.merchant_group_id != (matched_group.id if matched_group else None) or \
       instance.expense_type != new_expense_type:
        # Use update() to avoid recursive signal
        sender.objects.filter(pk=instance.pk).update(
            merchant_group=matched_group,
            expense_type=new_expense_type,
        )
