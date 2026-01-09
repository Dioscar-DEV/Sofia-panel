"""
Servicio para enviar mensajes a la API de WhatsApp
"""
import httpx
import logging
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Servicio para enviar mensajes a la API de WhatsApp"""

    def __init__(self, api_url: str):
        """
        Inicializa el servicio de WhatsApp.

        Args:
            api_url: URL completa del endpoint (ej: https://tu-api.railway.app/enviar-mensaje)
        """
        self.api_url = api_url.rstrip("/")
        self.endpoint = self.api_url  # URL ya incluye el endpoint completo
        self.client: Optional[httpx.AsyncClient] = None

    async def connect(self):
        """Crea el cliente HTTP asíncrono"""
        if not self.client:
            self.client = httpx.AsyncClient(timeout=30.0)
            logger.info(f"Cliente HTTP inicializado para API WhatsApp: {self.api_url}")

    async def disconnect(self):
        """Cierra el cliente HTTP"""
        if self.client:
            await self.client.aclose()
            logger.info("Cliente HTTP cerrado")

    def _extract_variables(self, message_data: Dict) -> List[str]:
        """
        Extrae las variables dinámicamente del mensaje.

        Busca campos variable1, variable2, variable3, variable4, variable5
        y los convierte en un array ordenado, filtrando valores None.

        Args:
            message_data: Diccionario con los datos del mensaje

        Returns:
            Lista de strings con las variables en orden
        """
        variables = []

        # Extraer hasta 10 variables (variable1 a variable10)
        for i in range(1, 11):
            var_key = f"variable{i}"
            var_value = message_data.get(var_key)

            # Solo agregar si tiene valor
            if var_value is not None and str(var_value).strip():
                variables.append(str(var_value).strip())
            else:
                # Si encontramos una variable vacía, dejamos de buscar
                # (asumimos que las variables son secuenciales)
                break

        return variables

    async def send_message(
        self,
        credentials: Dict[str, str],
        message_data: Dict
    ) -> Dict:
        """
        Envía un mensaje a través de la API de WhatsApp.

        Args:
            credentials: Diccionario con token, phone_id
            message_data: Diccionario con los datos del mensaje (numero, plantilla, variables, etc.)

        Returns:
            Diccionario con el resultado: {"success": bool, "wamid": str, "error": str}
        """
        try:
            # Extraer variables dinámicamente
            variables = self._extract_variables(message_data)

            # Construir payload según documentación de la API WhatsApp
            payload = {
                "token": credentials["token"],
                "phone_id": credentials["phone_id"],
                "numero": message_data["numero"],
                "template_name": message_data["plantilla"],
                "idioma": message_data.get("idioma", "es")
            }

            # Agregar variables solo si existen
            if variables:
                payload["variables"] = variables

            # Agregar URL de imagen solo si existe
            url_imagen = message_data.get("url_imagen")
            if url_imagen and str(url_imagen).strip():
                payload["url_imagen"] = str(url_imagen).strip()

            # Enviar request a la API
            logger.debug(f"Enviando mensaje a {message_data['numero']} con plantilla {message_data['plantilla']}")

            response = await self.client.post(
                self.endpoint,
                json=payload,
                headers={"Content-Type": "application/json"}
            )

            # Procesar respuesta
            if response.status_code == 200:
                response_data = response.json()
                wamid = response_data.get("id", response_data.get("wamid", ""))

                logger.info(f"Mensaje enviado exitosamente a {message_data['numero']}: {wamid}")

                return {
                    "success": True,
                    "wamid": wamid,
                    "error": None
                }
            else:
                # Error en el envío
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", error_data.get("meta_error", error_msg))
                except:
                    error_msg = response.text[:200]

                logger.warning(f"Error al enviar mensaje a {message_data['numero']}: {error_msg}")

                return {
                    "success": False,
                    "wamid": None,
                    "error": error_msg
                }

        except httpx.TimeoutException:
            error_msg = "Timeout al conectar con la API de WhatsApp"
            logger.error(f"{error_msg} - {message_data['numero']}")
            return {
                "success": False,
                "wamid": None,
                "error": error_msg
            }
        except httpx.ConnectError:
            error_msg = "No se pudo conectar con la API de WhatsApp"
            logger.error(f"{error_msg} - {message_data['numero']}")
            return {
                "success": False,
                "wamid": None,
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"Error inesperado: {str(e)}"
            logger.error(f"{error_msg} - {message_data['numero']}")
            return {
                "success": False,
                "wamid": None,
                "error": error_msg
            }
