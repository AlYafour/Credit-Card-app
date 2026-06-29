"""
Django settings for cardvault project.
"""
import os
from pathlib import Path
from datetime import timedelta
from decouple import config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')
DEBUG = config('DEBUG', default='False', cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1,0.0.0.0').split(',')

# Render
RENDER = config('RENDER', default='False', cast=bool)
if RENDER:
    ALLOWED_HOSTS.append('.onrender.com')

# Railway — automatically sets RAILWAY_ENVIRONMENT
RAILWAY = bool(config('RAILWAY_ENVIRONMENT', default=''))
if RAILWAY:
    ALLOWED_HOSTS.append('.railway.app')
    ALLOWED_HOSTS.append('.up.railway.app')

if DEBUG:
    ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'api',
    'drf_spectacular',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',  # Required for admin
    'corsheaders.middleware.CorsMiddleware',  # Must be before CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'api.middleware.RequestIDMiddleware',
]

ROOT_URLCONF = 'cardvault.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'cardvault.wsgi.application'

# Database configuration
# Priority:
# 1. DATABASE_URL env var (Render / production)
# 2. If POSTGRES_HOST='db' → Docker → Use PostgreSQL
# 3. If USE_SQLITE=True → Use SQLite (default for local dev)
# 4. If USE_SQLITE=False → Use PostgreSQL (local or remote)

DATABASE_URL = config('DATABASE_URL', default='')

if DATABASE_URL:
    # Production (Render, Heroku, etc.)
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    USE_SQLITE = config('USE_SQLITE', default='True', cast=bool)
    POSTGRES_HOST = config('POSTGRES_HOST', default='localhost')
    IS_DOCKER = POSTGRES_HOST == 'db'

    if IS_DOCKER or not USE_SQLITE:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': config('POSTGRES_DB', default='cardvault'),
                'USER': config('POSTGRES_USER', default='cardvault'),
                'PASSWORD': config('POSTGRES_PASSWORD', default='cardvault_dev_pass'),
                'HOST': POSTGRES_HOST,
                'PORT': config('POSTGRES_PORT', default='5432'),
                'CONN_MAX_AGE': 600,
            }
        }
    else:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }

AUTH_USER_MODEL = 'api.User'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Allow trailing slash so /api/v1/cards and /api/v1/cards/ both work (proxy sends no slash)
APPEND_SLASH = True

# Allow large base64-encoded bank statement PDFs (up to ~35MB JSON body for a 25MB file)
DATA_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50MB

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
STORAGES = {
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'api.authentication.SafeJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'EXCEPTION_HANDLER': 'api.exceptions.api_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',
        'user': '120/minute',
        'login': '5/minute',
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'CardVault API',
    'DESCRIPTION': 'API for managing credit cards, transactions, and cash entries',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
]

# Allow additional origins from environment variable (comma-separated)
cors_origins_env = config('CORS_ORIGINS', default='')
if cors_origins_env and cors_origins_env.strip() != '*':
    CORS_ALLOWED_ORIGINS.extend([
        origin.strip() for origin in cors_origins_env.split(',')
        if origin.strip() and origin.strip().startswith('http')
    ])

# Allow production origins via regex
CORS_ALLOWED_ORIGIN_REGEXES = []
if RENDER:
    CORS_ALLOWED_ORIGIN_REGEXES.append(r'^https://.*\.onrender\.com$')
if RAILWAY:
    CORS_ALLOWED_ORIGIN_REGEXES.append(r'^https://.*\.railway\.app$')
    CORS_ALLOWED_ORIGIN_REGEXES.append(r'^https://.*\.up\.railway\.app$')
    CORS_ALLOWED_ORIGIN_REGEXES.append(r'^https://.*\.vercel\.app$')

CORS_ALLOW_CREDENTIALS = True

# In development, allow all origins; also if CORS_ORIGINS='*'
if DEBUG or cors_origins_env.strip() == '*':
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False

# CORS Headers
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Encryption settings
ENCRYPTION_KEY = config('ENCRYPTION_KEY', default='CHANGE-ME-32-byte-key-for-aes256')

# Fail loudly if using default encryption key in production
if not DEBUG and ENCRYPTION_KEY == 'CHANGE-ME-32-byte-key-for-aes256':
    raise ValueError(
        'ENCRYPTION_KEY must be set to a secure value in production! '
        'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
    )

# AI Vision API settings
ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY', default='')
GOOGLE_API_KEY = config('GOOGLE_API_KEY', default='')
OPENAI_API_KEY = config('OPENAI_API_KEY', default='')

# WebAuthn RP ID - must match the frontend domain
# Set WEBAUTHN_RP_ID env var on Render to your frontend domain (e.g. cardvault-frontend-0myv.onrender.com)
WEBAUTHN_RP_ID = config('WEBAUTHN_RP_ID', default='localhost')

# Security settings for production
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default='True', cast=bool)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'api': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'api.audit': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Cache configuration (for login rate limiting)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'cardvault-cache',
    }
}
