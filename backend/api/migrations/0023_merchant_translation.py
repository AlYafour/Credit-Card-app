from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_enterprise_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='MerchantTranslation',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('original_name', models.CharField(db_index=True, max_length=255, unique=True)),
                ('arabic_name', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'merchant_translations',
            },
        ),
    ]
