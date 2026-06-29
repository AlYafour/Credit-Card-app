from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    register, login, refresh_token, profile, change_password, export_data,
    forgot_password_request, reset_password_confirm,
    CardViewSet, TransactionViewSet, CashEntryViewSet,
    ChatSessionViewSet, ChatMessageViewSet, chat_send,
    webauthn_register_options, webauthn_register_verify,
    webauthn_login_options, webauthn_login_verify,
    webauthn_list_credentials, webauthn_delete_credential,
    realtime_session,
    bank_passwords_list, bank_passwords_save, bank_passwords_delete,
    statements_list, statement_transactions, statement_file,
    merchants_list, translate_merchants,
    MerchantGroupViewSet, cardholders_list,
    transactions_export_excel, transactions_import_excel,
    ProjectViewSet, AuditLogViewSet,
)

router = DefaultRouter()
router.register(r'cards', CardViewSet, basename='card')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'cash', CashEntryViewSet, basename='cash')
router.register(r'chat/sessions', ChatSessionViewSet, basename='chatsession')
router.register(r'chat/messages', ChatMessageViewSet, basename='chatmessage')
router.register(r'merchant-groups', MerchantGroupViewSet, basename='merchantgroup')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')

from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('health/', health_check, name='health'),
    path('auth/register/', register, name='register'),
    path('auth/login/', login, name='login'),
    path('auth/refresh/', refresh_token, name='refresh'),
    path('auth/me/', profile, name='profile'),
    path('auth/change-password/', change_password, name='change-password'),
    path('auth/forgot-password/', forgot_password_request, name='forgot-password'),
    path('auth/reset-password/', reset_password_confirm, name='reset-password'),
    path('export/', export_data, name='export-data'),
    path('chat/send/', chat_send, name='chat-send'),
    path('auth/webauthn/register/options/', webauthn_register_options, name='webauthn-register-options'),
    path('auth/webauthn/register/verify/', webauthn_register_verify, name='webauthn-register-verify'),
    path('auth/webauthn/login/options/', webauthn_login_options, name='webauthn-login-options'),
    path('auth/webauthn/login/verify/', webauthn_login_verify, name='webauthn-login-verify'),
    path('auth/webauthn/credentials/', webauthn_list_credentials, name='webauthn-credentials'),
    path('auth/webauthn/credentials/<int:pk>/', webauthn_delete_credential, name='webauthn-delete-credential'),
    path('realtime/session/', realtime_session, name='realtime-session'),
    path('bank-passwords/', bank_passwords_list, name='bank-passwords-list'),
    path('bank-passwords/save/', bank_passwords_save, name='bank-passwords-save'),
    path('bank-passwords/<str:bank_name>/', bank_passwords_delete, name='bank-passwords-delete'),
    path('statements/', statements_list, name='statements-list'),
    path('statements/<str:statement_id>/transactions/', statement_transactions, name='statement-transactions'),
    path('statements/<str:statement_id>/file/', statement_file, name='statement-file'),
    path('merchants/', merchants_list, name='merchants-list'),
    path('merchants/translate/', translate_merchants, name='merchants-translate'),
    path('cardholders/', cardholders_list, name='cardholders-list'),
    path('transactions/export/', transactions_export_excel, name='transactions-export'),
    path('transactions/import/', transactions_import_excel, name='transactions-import'),
    path('', include(router.urls)),
]
