from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_password_reset_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='statement',
            name='file_path',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='statement',
            name='file_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='statement',
            name='file_type',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
