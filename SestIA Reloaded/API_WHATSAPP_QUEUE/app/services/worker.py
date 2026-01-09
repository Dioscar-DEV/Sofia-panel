"""
Background worker para procesar las colas de mensajes
"""
import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime

from app.services.redis_service import RedisService
from app.services.supabase_service import SupabaseService
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


class WorkerService:
    """Worker background para procesar colas de mensajes de WhatsApp"""

    def __init__(
        self,
        redis: RedisService,
        supabase: SupabaseService,
        whatsapp: WhatsAppService,
        delay_ms: int,
        batch_size: int = 100,
        max_concurrent_batches: int = 5
    ):
        """
        Inicializa el worker.

        Args:
            redis: Servicio de Redis
            supabase: Servicio de Supabase
            whatsapp: Servicio de WhatsApp
            delay_ms: Delay en milisegundos entre lotes
            batch_size: Cantidad de mensajes por lote
            max_concurrent_batches: Número máximo de lotes en paralelo
        """
        self.redis = redis
        self.supabase = supabase
        self.whatsapp = whatsapp
        self.delay_ms = delay_ms
        self.batch_size = batch_size
        self.max_concurrent_batches = max_concurrent_batches

        # Cache de credenciales en memoria (buzon_id -> credentials)
        self._credentials_cache: Dict[str, Dict] = {}

        # Estado del worker
        self.is_running = False
        self.start_time = datetime.utcnow()

    async def get_cached_credentials(self, buzon_id: str) -> Optional[Dict]:
        """
        Obtiene credenciales con cache en memoria.

        Args:
            buzon_id: ID del buzon

        Returns:
            Diccionario con credenciales o None si hay error
        """
        # Verificar si ya está en cache
        if buzon_id in self._credentials_cache:
            logger.debug(f"Credenciales obtenidas de cache para buzon '{buzon_id}'")
            return self._credentials_cache[buzon_id]

        # Si no está en cache, consultar Supabase
        try:
            credentials = await self.supabase.get_credentials(buzon_id)
            if credentials:
                # Guardar en cache
                self._credentials_cache[buzon_id] = credentials
                logger.info(f"Credenciales cacheadas para buzon '{buzon_id}'")
                return credentials
            return None
        except Exception as e:
            logger.error(f"Error al obtener credenciales para buzon '{buzon_id}': {str(e)}")
            return None

    async def process_message(self, campaign_id: str, message: Dict) -> bool:
        """
        Procesa un mensaje individual.

        Soporta dos modos:
        1. Credenciales directas: Si el mensaje incluye 'token' y 'phone_id', los usa directamente
        2. Credenciales desde Supabase: Si el mensaje incluye 'buzon', consulta Supabase

        Args:
            campaign_id: ID de la campaña
            message: Datos del mensaje

        Returns:
            True si fue exitoso, False si falló
        """
        try:
            credentials = None

            # Modo 1: Verificar si el mensaje ya tiene credenciales directas
            if message.get("token") and message.get("phone_id"):
                credentials = {
                    "token": message["token"],
                    "phone_id": message["phone_id"],
                    "waba_id": message.get("waba_id")
                }
                logger.debug(f"[{campaign_id}] Usando credenciales directas del mensaje")

            # Modo 2: Consultar Supabase usando buzon
            elif message.get("buzon"):
                buzon_id = message.get("buzon")
                credentials = await self.get_cached_credentials(buzon_id)
                if not credentials:
                    logger.error(f"No se pudieron obtener credenciales para buzon '{buzon_id}'")
                    return False
                logger.debug(f"[{campaign_id}] Usando credenciales de Supabase (buzon: {buzon_id})")

            # Error: Sin credenciales
            else:
                logger.error(
                    f"Mensaje sin credenciales en campaña '{campaign_id}': "
                    f"No tiene 'buzon' ni ('token' + 'phone_id')"
                )
                return False

            # Enviar mensaje
            result = await self.whatsapp.send_message(credentials, message)

            if result["success"]:
                # Incrementar contador de exitosos
                await self.redis.increment_sent(campaign_id)
                logger.info(
                    f"[{campaign_id}] Mensaje enviado: {message['numero']} - "
                    f"WAMID: {result['wamid']}"
                )
                return True
            else:
                # Incrementar contador de fallidos
                await self.redis.increment_failed(campaign_id)
                logger.warning(
                    f"[{campaign_id}] Mensaje fallido: {message['numero']} - "
                    f"Error: {result['error']}"
                )
                return False

        except Exception as e:
            logger.error(f"Error al procesar mensaje en campaña '{campaign_id}': {str(e)}")
            await self.redis.increment_failed(campaign_id)
            return False

    async def process_batch(self, campaign_id: str, messages: list) -> dict:
        """
        Procesa un lote de mensajes en paralelo.

        Args:
            campaign_id: ID de la campaña
            messages: Lista de mensajes a procesar

        Returns:
            Dict con estadísticas: {"success": int, "failed": int}
        """
        if not messages:
            return {"success": 0, "failed": 0}

        logger.info(f"[{campaign_id}] Procesando lote de {len(messages)} mensajes en paralelo")

        # Crear tareas para todos los mensajes del lote
        tasks = [self.process_message(campaign_id, msg) for msg in messages]

        # Ejecutar todas las tareas en paralelo
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Contar resultados
        success_count = sum(1 for r in results if r is True)
        failed_count = len(results) - success_count

        logger.info(
            f"[{campaign_id}] Lote completado: {success_count} exitosos, {failed_count} fallidos"
        )

        return {"success": success_count, "failed": failed_count}

    async def dequeue_batch(self, campaign_id: str, size: int) -> list:
        """
        Desencola un lote de mensajes de una campaña.

        Args:
            campaign_id: ID de la campaña
            size: Tamaño del lote

        Returns:
            Lista de mensajes (puede ser menor a size si no hay suficientes)
        """
        batch = []
        for _ in range(size):
            message = await self.redis.dequeue_message(campaign_id)
            if message:
                batch.append(message)
            else:
                break
        return batch

    async def start_worker(self):
        """
        Inicia el worker background con procesamiento paralelo en lotes.

        Loop infinito que:
        1. Obtiene campañas activas
        2. Desencola lotes de mensajes
        3. Procesa lotes en paralelo (asyncio.gather)
        4. Procesa múltiples campañas simultáneamente
        5. Aplica delay configurable entre ciclos (opcional)
        """
        self.is_running = True
        logger.info(
            f"Worker iniciado - Batch: {self.batch_size}, Concurrent: {self.max_concurrent_batches}, "
            f"Delay: {self.delay_ms}ms - Instancia: {self.start_time.isoformat()}"
        )

        consecutive_empty_cycles = 0
        max_empty_cycles = 10

        try:
            while self.is_running:
                # Obtener campañas activas (con mensajes pendientes)
                campaigns = await self.redis.get_active_campaigns()

                if not campaigns:
                    consecutive_empty_cycles += 1

                    # Si no hay campañas, hacer un sleep más largo
                    if consecutive_empty_cycles >= max_empty_cycles:
                        logger.debug("No hay campañas activas. Esperando...")
                        await asyncio.sleep(5)  # 5 segundos si no hay nada que hacer
                        consecutive_empty_cycles = 0
                    else:
                        await asyncio.sleep(1)
                    continue

                # Reset contador si hay campañas
                consecutive_empty_cycles = 0

                logger.debug(f"Procesando {len(campaigns)} campañas activas: {campaigns}")

                # Procesar múltiples campañas en paralelo
                campaign_tasks = []
                
                for campaign_id in campaigns[:self.max_concurrent_batches]:
                    # Desencolar un lote de mensajes
                    batch = await self.dequeue_batch(campaign_id, self.batch_size)
                    
                    if batch:
                        # Crear tarea para procesar el lote
                        task = self.process_batch(campaign_id, batch)
                        campaign_tasks.append(task)
                    else:
                        logger.debug(f"Campaña '{campaign_id}' sin mensajes pendientes")

                # Ejecutar todos los lotes en paralelo
                if campaign_tasks:
                    await asyncio.gather(*campaign_tasks, return_exceptions=True)
                    
                    # Aplicar delay configurable entre ciclos (si está configurado)
                    if self.delay_ms > 0:
                        await asyncio.sleep(self.delay_ms / 1000.0)
                else:
                    # Pequeño delay si no hay mensajes para procesar
                    await asyncio.sleep(0.5)

        except asyncio.CancelledError:
            logger.info("Worker detenido por cancelación")
            self.is_running = False
        except Exception as e:
            logger.error(f"Error crítico en worker: {str(e)}", exc_info=True)
            self.is_running = False
            raise

    def get_uptime_seconds(self) -> int:
        """Retorna el tiempo de ejecución del worker en segundos"""
        delta = datetime.utcnow() - self.start_time
        return int(delta.total_seconds())
