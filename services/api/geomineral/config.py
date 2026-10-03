import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./.data/geomineral.db")
PRODUCTION = os.getenv("APP_ENV") == "production"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true" if PRODUCTION else "false") == "true"
LIVE_PROVIDERS = os.getenv("ENABLE_LIVE_PROVIDERS", "true") == "true"
USER_AGENT = os.getenv(
    "PROVIDER_USER_AGENT", "GeoMineral/1.0 (https://github.com/adegbe11/geomineral)"
)
# Number of trusted proxies in front of the API that append X-Forwarded-For.
PROXY_HOPS = int(os.getenv("PROXY_HOPS", "0"))
ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:3000,http://localhost:3000"
    + ("" if PRODUCTION else ",http://127.0.0.1:8081,http://localhost:8081"),
).split(",")
if PRODUCTION and (not COOKIE_SECURE or DATABASE_URL.startswith("sqlite")):
    raise RuntimeError("Production requires secure cookies and PostgreSQL.")
