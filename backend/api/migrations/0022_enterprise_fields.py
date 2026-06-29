import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_normalize_transaction_types'),
    ]

    operations = [
        # ── Project model ──────────────────────────────────────────
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('color', models.CharField(default='#6366f1', max_length=7)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='projects',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'projects', 'ordering': ['name']},
        ),
        migrations.AddIndex(
            model_name='project',
            index=models.Index(fields=['user_id'], name='project_user_idx'),
        ),

        # ── AuditLog model ─────────────────────────────────────────
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('action', models.CharField(choices=[
                    ('CREATE', 'Create'), ('UPDATE', 'Update'), ('DELETE', 'Delete'),
                    ('RESTORE', 'Restore'), ('APPROVE', 'Approve'), ('REJECT', 'Reject'),
                    ('SUBMIT', 'Submit'), ('LOGIN', 'Login'), ('EXPORT', 'Export'), ('IMPORT', 'Import'),
                ], max_length=20)),
                ('model_name', models.CharField(max_length=50)),
                ('object_id', models.CharField(blank=True, max_length=100, null=True)),
                ('object_repr', models.CharField(blank=True, max_length=255, null=True)),
                ('changes', models.JSONField(blank=True, null=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='audit_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'audit_logs', 'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['user_id'], name='audit_user_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['model_name'], name='audit_model_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['created_at'], name='audit_date_idx'),
        ),

        # ── Transaction new fields ─────────────────────────────────
        migrations.AddField(
            model_name='transaction',
            name='vat_amount',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True),
        ),
        migrations.AddField(
            model_name='transaction',
            name='is_vat_inclusive',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='transaction',
            name='receipt_file',
            field=models.FileField(blank=True, null=True, upload_to='receipts/'),
        ),
        migrations.AddField(
            model_name='transaction',
            name='approval_status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'), ('submitted', 'Submitted for Approval'),
                    ('approved', 'Approved'), ('rejected', 'Rejected'),
                ],
                default='draft', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='transaction',
            name='approved_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='approved_transactions',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='transaction',
            name='approval_note',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='transaction',
            name='project',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='transactions',
                to='api.project',
            ),
        ),

        # ── AlterField: drop legacy lowercase transaction types ────
        migrations.AlterField(
            model_name='transaction',
            name='transaction_type',
            field=models.CharField(
                max_length=50,
                choices=[
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
                ],
            ),
        ),
    ]
