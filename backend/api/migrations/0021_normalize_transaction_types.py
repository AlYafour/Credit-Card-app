from django.db import migrations


def normalize_types(apps, schema_editor):
    """Migrate legacy lowercase transaction types to uppercase canonical values."""
    Transaction = apps.get_model('api', 'Transaction')
    mapping = {
        'purchase': 'PURCHASE',
        'withdrawal': 'CASH_WITHDRAWAL',
        'payment': 'CARD_PAYMENT',
        'refund': 'REFUND',
        'transfer': 'TRANSFER',
        'deposit': 'WALLET_TOPUP',
    }
    for old, new in mapping.items():
        Transaction.objects.filter(transaction_type=old).update(transaction_type=new)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_merchant_groups_and_expense_type'),
    ]

    operations = [
        migrations.RunPython(normalize_types, migrations.RunPython.noop),
    ]
