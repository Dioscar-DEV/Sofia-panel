"""
Aplicación principal FastAPI
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
import sys

from app.config import settings
from app.services.redis_service import RedisService
from app.services.supabase_service import SupabaseService
from app.services.whatsapp_service import WhatsAppService
from app.services.worker import WorkerService
from app.routes import campaign, status

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format=f"[{settings.INSTANCE_ID}] %(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Inicializar servicios globales
redis_service = RedisService(
    redis_url=settings.REDIS_URL,
    campaign_ttl=settings.REDIS_CAMPAIGN_TTL
)

supabase_service = SupabaseService(
    supabase_url=settings.SUPABASE_URL,
    supabase_key=settings.SUPABASE_KEY
)

whatsapp_service = WhatsAppService(
    api_url=settings.API_WHATSAPP_URL
)

worker_service = WorkerService(
    redis=redis_service,
    supabase=supabase_service,
    whatsapp=whatsapp_service,
    delay_ms=settings.INTERVALO_ENVIO_MS,
    batch_size=settings.BATCH_SIZE,
    max_concurrent_batches=settings.MAX_CONCURRENT_BATCHES
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestión del ciclo de vida de la aplicación.

    Startup:
    - Conecta a Redis
    - Conecta a Supabase
    - Inicia cliente HTTP de WhatsApp
    - Inicia worker background

    Shutdown:
    - Detiene worker
    - Cierra conexiones
    """
    logger.info("=" * 60)
    logger.info(f"Iniciando API Gestor de Colas WhatsApp - Instancia: {settings.INSTANCE_ID}")
    logger.info("=" * 60)

    # Conectar a servicios
    try:
        logger.info("Conectando a Redis...")
        await redis_service.connect()

        logger.info("Conectando a Supabase...")
        await supabase_service.connect()

        logger.info("Inicializando cliente WhatsApp...")
        await whatsapp_service.connect()

        logger.info("Servicios conectados exitosamente")

    except Exception as e:
        logger.error(f"Error al conectar servicios: {str(e)}")
        raise

    # Iniciar worker background
    worker_task = None
    try:
        logger.info(f"Iniciando worker background (delay: {settings.INTERVALO_ENVIO_MS}ms)...")
        worker_task = asyncio.create_task(worker_service.start_worker())
        logger.info("Worker iniciado exitosamente")
    except Exception as e:
        logger.error(f"Error al iniciar worker: {str(e)}")
        raise

    logger.info("=" * 60)
    logger.info("API lista para recibir requests")
    logger.info("=" * 60)

    yield

    # Shutdown
    logger.info("Deteniendo aplicación...")

    if worker_task:
        logger.info("Deteniendo worker...")
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            logger.info("Worker detenido")

    logger.info("Cerrando conexiones...")
    await redis_service.disconnect()
    await whatsapp_service.disconnect()

    logger.info("Aplicación detenida")


# Crear aplicación FastAPI
app = FastAPI(
    title="API Gestor de Colas WhatsApp",
    description="API para gestionar colas de envío masivo de WhatsApp con Redis y Supabase",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inyectar dependencias en las rutas
campaign.redis_service = redis_service
campaign.supabase_service = supabase_service

status.redis_service = redis_service
status.supabase_service = supabase_service
status.worker_service = worker_service

# Registrar rutas
app.include_router(campaign.router, prefix="/api", tags=["Campañas"])
app.include_router(status.router, prefix="/api", tags=["Estado"])


@app.get("/")
async def root():
    """Endpoint raíz con información de la API"""
    return {
        "message": "API Gestor de Colas WhatsApp",
        "version": "1.0.0",
        "instancia": settings.INSTANCE_ID,
        "endpoints": {
            "crear_campana": "/api/crear-campana (POST)",
            "crear_campana_json": "/api/crear-campana-json (POST)",
            "estado_cola": "/api/estado-cola/{campaign_id} (GET)",
            "estado_sistema": "/api/estado-sistema (GET)",
            "listar_campanas": "/api/listar-campanas (GET)",
            "health": "/health (GET)",
            "docs": "/docs (GET)"
        }
    }


@app.get("/health")
async def health():
    """Health check para Railway y load balancers"""
    try:
        # Verificar Redis
        redis_ok = await redis_service.ping()

        # Verificar Supabase
        supabase_ok = await supabase_service.health_check()

        # Verificar Worker
        worker_ok = worker_service.is_running

        status = "healthy"
        if not redis_ok or not supabase_ok or not worker_ok:
            status = "degraded"

        return {
            "status": status,
            "instance": settings.INSTANCE_ID,
            "services": {
                "redis": "ok" if redis_ok else "error",
                "supabase": "ok" if supabase_ok else "error",
                "worker": "running" if worker_ok else "stopped"
            },
            "uptime_seconds": worker_service.get_uptime_seconds()
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "error",
            "instance": settings.INSTANCE_ID,
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info"
    )
