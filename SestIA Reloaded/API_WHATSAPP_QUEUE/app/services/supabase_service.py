"""
Servicio para consultar credenciales de WhatsApp en Supabase
"""
from supabase import create_client, Client
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class SupabaseService:
    """Servicio para consultar credenciales de WhatsApp desde Supabase"""

    def __init__(self, supabase_url: str, supabase_key: str):
        """
        Inicializa el servicio de Supabase.

        Args:
            supabase_url: URL de Supabase
            supabase_key: API Key de Supabase
        """
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.client: Optional[Client] = None

    async def connect(self):
        """Establece conexión con Supabase"""
        if not self.client:
            self.client = create_client(self.supabase_url, self.supabase_key)
            logger.info("Conectado a Supabase exitosamente")

    async def health_check(self) -> bool:
        """Verifica la conexión a Supabase"""
        try:
            # Hacer una consulta simple para verificar conexión
            result = self.client.schema("instancia_sofia").table("instancias_inputs").select("canal").limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Error al verificar conexión con Supabase: {str(e)}")
            return False

    async def get_credentials(self, buzon_id: str) -> Optional[Dict[str, str]]:
        """
        Obtiene las credenciales de WhatsApp desde Supabase.

        Consulta la tabla instancia_sofia.instancias_inputs y parsea el campo 'key'
        que tiene el formato: "TOKEN,PHONE_ID,WABA_ID"

        Args:
            buzon_id: ID del canal (buzon) en Supabase

        Returns:
            Diccionario con token, phone_id y waba_id o None si no se encuentra

        Raises:
            ValueError: Si el buzon_id no existe o el formato es inválido
        """
        try:
            # Consultar tabla instancias_inputs en esquema instancia_sofia
            # Buscar por custom_name ya que buzon_id viene como nombre, no como ID numérico
            result = self.client.schema("instancia_sofia").table("instancias_inputs") \
                .select("key, nameid, custom_name, canal") \
                .eq("custom_name", buzon_id) \
                .limit(1) \
                .execute()

            if not result.data or len(result.data) == 0:
                logger.error(f"No se encontró el buzon '{buzon_id}' en Supabase")
                raise ValueError(f"No se encontró el buzon '{buzon_id}' en la base de datos")

            # Obtener el registro
            record = result.data[0]
            key_field = record.get("key", "")

            if not key_field:
                logger.error(f"El buzon '{buzon_id}' no tiene configurado el campo 'key'")
                raise ValueError(f"El buzon '{buzon_id}' no tiene credenciales configuradas")

            # Parsear el campo 'key': "TOKEN,PHONE_ID,WABA_ID"
            parts = key_field.split(",")

            if len(parts) < 2:
                logger.error(f"Formato inválido del campo 'key' para buzon '{buzon_id}': {key_field}")
                raise ValueError(f"Formato inválido de credenciales para buzon '{buzon_id}'")

            credentials = {
                "token": parts[0].strip(),
                "phone_id": parts[1].strip(),
                "waba_id": parts[2].strip() if len(parts) > 2 else None,
                "nameid": record.get("nameid", ""),
                "custom_name": record.get("custom_name", "")
            }

            logger.info(f"Credenciales obtenidas para buzon '{buzon_id}': {credentials['custom_name']}")
            return credentials

        except Exception as e:
            if isinstance(e, ValueError):
                raise
            logger.error(f"Error al obtener credenciales para buzon '{buzon_id}': {str(e)}")
            raise ValueError(f"Error al consultar credenciales: {str(e)}")
