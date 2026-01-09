"""
Servicio para gestionar las colas en Redis
"""
import redis.asyncio as redis
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime
import fakeredis.aioredis

logger = logging.getLogger(__name__)


class RedisService:
    """Servicio para gestionar colas de campañas en Redis"""

    def __init__(self, redis_url: str, campaign_ttl: int = 604800):
        """
        Inicializa el servicio de Redis.

        Args:
            redis_url: URL de conexión a Redis
            campaign_ttl: TTL para campañas completadas (default: 7 días)
        """
        self.redis_url = redis_url
        self.campaign_ttl = campaign_ttl
        self.redis_client: Optional[redis.Redis] = None

    async def connect(self):
        """Establece conexión con Redis o FakeRedis para pruebas"""
        if not self.redis_client:
            try:
                # Intentar conectar a Redis real
                self.redis_client = await redis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                await self.redis_client.ping()
                logger.info("Conectado a Redis exitosamente")
            except Exception as e:
                # Si falla, usar FakeRedis en memoria
                logger.warning(f"No se pudo conectar a Redis: {e}")
                logger.info("Usando FakeRedis en memoria para pruebas...")
                self.redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
                logger.info("FakeRedis iniciado exitosamente")

    async def disconnect(self):
        """Cierra la conexión con Redis"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Desconectado de Redis")

    async def ping(self) -> bool:
        """Verifica la conexión a Redis"""
        try:
            await self.redis_client.ping()
            return True
        except Exception as e:
            logger.error(f"Error al hacer ping a Redis: {str(e)}")
            return False

    async def enqueue_campaign(
        self,
        campaign_id: str,
        messages: List[Dict],
        metadata: Dict
    ) -> int:
        """
        Encola mensajes de una campaña en Redis.

        Args:
            campaign_id: ID único de la campaña
            messages: Lista de mensajes a encolar
            metadata: Metadata de la campaña (plantilla, buzon, idioma, etc.)

        Returns:
            Número de mensajes encolados
        """
        try:
            # Crear claves Redis
            queue_key = f"campaign:{campaign_id}"
            stats_key = f"campaign:{campaign_id}:stats"
            metadata_key = f"campaign:{campaign_id}:metadata"

            # Encolar mensajes (usar RPUSH para agregar al final)
            if messages:
                # Serializar mensajes a JSON
                serialized_messages = [json.dumps(msg) for msg in messages]
                await self.redis_client.rpush(queue_key, *serialized_messages)

            # Guardar metadata
            await self.redis_client.hset(
                metadata_key,
                mapping={
                    "plantilla": metadata.get("plantilla", ""),
                    "buzon": metadata.get("buzon", ""),
                    "idioma": metadata.get("idioma", "es"),
                    "created_at": datetime.utcnow().isoformat()
                }
            )

            # Inicializar stats
            await self.redis_client.hset(
                stats_key,
                mapping={
                    "total": len(messages),
                    "enviados": 0,
                    "fallidos": 0,
                    "created_at": datetime.utcnow().isoformat(),
                    "ultimo_envio": ""
                }
            )

            logger.info(f"Campaña '{campaign_id}' encolada: {len(messages)} mensajes")
            return len(messages)

        except Exception as e:
            logger.error(f"Error al encolar campaña '{campaign_id}': {str(e)}")
            raise

    async def dequeue_message(self, campaign_id: str) -> Optional[Dict]:
        """
        Extrae un mensaje de la cola (LPOP).

        Args:
            campaign_id: ID de la campaña

        Returns:
            Diccionario con el mensaje o None si la cola está vacía
        """
        try:
            queue_key = f"campaign:{campaign_id}"
            message_json = await self.redis_client.lpop(queue_key)

            if message_json:
                return json.loads(message_json)
            return None

        except Exception as e:
            logger.error(f"Error al desencolar mensaje de '{campaign_id}': {str(e)}")
            return None

    async def get_campaign_stats(self, campaign_id: str) -> Dict:
        """
        Obtiene las estadísticas de una campaña.

        Args:
            campaign_id: ID de la campaña

        Returns:
            Diccionario con las estadísticas
        """
        try:
            queue_key = f"campaign:{campaign_id}"
            stats_key = f"campaign:{campaign_id}:stats"

            # Obtener stats de Redis
            stats = await self.redis_client.hgetall(stats_key)

            if not stats:
                return None

            # Obtener mensajes pendientes
            pendientes = await self.redis_client.llen(queue_key)

            # Calcular progreso
            total = int(stats.get("total", 0))
            enviados = int(stats.get("enviados", 0))
            fallidos = int(stats.get("fallidos", 0))

            progreso_porcentaje = 0
            if total > 0:
                progreso_porcentaje = ((enviados + fallidos) / total) * 100

            # Determinar estado
            estado = "encolado"
            if enviados > 0 or fallidos > 0:
                estado = "procesando"
            if pendientes == 0 and total > 0:
                estado = "completado"

            return {
                "campaign_id": campaign_id,
                "total": total,
                "pendientes": pendientes,
                "enviados": enviados,
                "fallidos": fallidos,
                "estado": estado,
                "progreso_porcentaje": round(progreso_porcentaje, 2),
                "ultimo_envio": stats.get("ultimo_envio") or None
            }

        except Exception as e:
            logger.error(f"Error al obtener stats de '{campaign_id}': {str(e)}")
            return None

    async def increment_sent(self, campaign_id: str):
        """Incrementa el contador de mensajes enviados"""
        try:
            stats_key = f"campaign:{campaign_id}:stats"
            await self.redis_client.hincrby(stats_key, "enviados", 1)
            await self.redis_client.hset(
                stats_key,
                "ultimo_envio",
                datetime.utcnow().isoformat()
            )
        except Exception as e:
            logger.error(f"Error al incrementar enviados de '{campaign_id}': {str(e)}")

    async def increment_failed(self, campaign_id: str):
        """Incrementa el contador de mensajes fallidos"""
        try:
            stats_key = f"campaign:{campaign_id}:stats"
            await self.redis_client.hincrby(stats_key, "fallidos", 1)
        except Exception as e:
            logger.error(f"Error al incrementar fallidos de '{campaign_id}': {str(e)}")

    async def get_active_campaigns(self) -> List[str]:
        """
        Obtiene la lista de campañas activas (con mensajes pendientes).

        Returns:
            Lista de IDs de campañas activas
        """
        try:
            # Buscar todas las claves de campañas
            pattern = "campaign:*"
            keys = []

            async for key in self.redis_client.scan_iter(match=pattern):
                # Filtrar solo las colas (sin :stats ni :metadata)
                if ":stats" not in key and ":metadata" not in key:
                    # Verificar que tenga mensajes pendientes
                    length = await self.redis_client.llen(key)
                    if length > 0:
                        # Extraer campaign_id
                        campaign_id = key.replace("campaign:", "")
                        keys.append(campaign_id)

            return keys

        except Exception as e:
            logger.error(f"Error al obtener campañas activas: {str(e)}")
            return []

    async def get_campaign_metadata(self, campaign_id: str) -> Optional[Dict]:
        """
        Obtiene la metadata de una campaña.

        Args:
            campaign_id: ID de la campaña

        Returns:
            Diccionario con la metadata o None
        """
        try:
            metadata_key = f"campaign:{campaign_id}:metadata"
            metadata = await self.redis_client.hgetall(metadata_key)
            return metadata if metadata else None
        except Exception as e:
            logger.error(f"Error al obtener metadata de '{campaign_id}': {str(e)}")
            return None

    async def get_total_pending_messages(self) -> int:
        """
        Obtiene el total de mensajes pendientes en todas las campañas.

        Returns:
            Total de mensajes pendientes
        """
        try:
            total = 0
            pattern = "campaign:*"

            async for key in self.redis_client.scan_iter(match=pattern):
                if ":stats" not in key and ":metadata" not in key:
                    length = await self.redis_client.llen(key)
                    total += length

            return total

        except Exception as e:
            logger.error(f"Error al obtener total de mensajes pendientes: {str(e)}")
            return 0
