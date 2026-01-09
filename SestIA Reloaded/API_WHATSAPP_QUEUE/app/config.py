"""
Configuración de la aplicación usando pydantic-settings.
Todas las variables de entorno se cargan desde el archivo .env
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Configuración de la aplicación"""

    # API WhatsApp
    API_WHATSAPP_URL: str

    # Configuración de envíos paralelos
    BATCH_SIZE: int = 100  # Mensajes por lote
    MAX_CONCURRENT_BATCHES: int = 5  # Lotes en paralelo
    INTERVALO_ENVIO_MS: int = 0  # Delay entre lotes (0 = sin delay)

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # Redis
    REDIS_URL: str

    # General
    DEBUG: bool = False
    INSTANCE_ID: str = "instance-1"

    # Límites
    MAX_CSV_SIZE_MB: int = 50
    MAX_MESSAGES_PER_CAMPAIGN: int = 100000

    # TTL Redis (7 días en segundos)
    REDIS_CAMPAIGN_TTL: int = 604800

    class Config:
        env_file = ".env"
        case_sensitive = True


# Instancia global de settings
settings = Settings()
