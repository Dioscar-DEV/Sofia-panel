"""
Endpoints para consultar estado de campañas y sistema
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime
import logging

from app.models import CampaignStatus, SystemStatus
from app.services.redis_service import RedisService
from app.services.supabase_service import SupabaseService
from app.services.worker import WorkerService
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# Dependencias globales (se inyectarán desde main.py)
redis_service: Optional[RedisService] = None
supabase_service: Optional[SupabaseService] = None
worker_service: Optional[WorkerService] = None


def get_redis() -> RedisService:
    """Dependency injection para Redis"""
    if redis_service is None:
        raise HTTPException(status_code=503, detail="Redis no disponible")
    return redis_service


def get_supabase() -> SupabaseService:
    """Dependency injection para Supabase"""
    if supabase_service is None:
        raise HTTPException(status_code=503, detail="Supabase no disponible")
    return supabase_service


def get_worker() -> WorkerService:
    """Dependency injection para Worker"""
    if worker_service is None:
        raise HTTPException(status_code=503, detail="Worker no disponible")
    return worker_service


@router.get("/estado-cola/{campaign_id}", response_model=CampaignStatus)
async def get_campaign_status(
    campaign_id: str,
    redis: RedisService = Depends(get_redis)
):
    """
    Consulta el estado de una campaña específica.

    Retorna:
    - Total de mensajes
    - Mensajes pendientes
    - Mensajes enviados
    - Mensajes fallidos
    - Estado (encolado, procesando, completado)
    - Porcentaje de progreso
    - Timestamp del último envío
    """
    try:
        # Obtener estadísticas de Redis
        stats = await redis.get_campaign_stats(campaign_id)

        if not stats:
            raise HTTPException(
                status_code=404,
                detail=f"Campaña '{campaign_id}' no encontrada"
            )

        # Parsear ultimo_envio
        ultimo_envio = None
        if stats.get("ultimo_envio"):
            try:
                ultimo_envio = datetime.fromisoformat(stats["ultimo_envio"])
            except:
                pass

        return CampaignStatus(
            campaign_id=stats["campaign_id"],
            total=stats["total"],
            pendientes=stats["pendientes"],
            enviados=stats["enviados"],
            fallidos=stats["fallidos"],
            estado=stats["estado"],
            progreso_porcentaje=stats["progreso_porcentaje"],
            ultimo_envio=ultimo_envio
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener estado de campaña '{campaign_id}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/estado-sistema", response_model=SystemStatus)
async def get_system_status(
    redis: RedisService = Depends(get_redis),
    supabase: SupabaseService = Depends(get_supabase),
    worker: WorkerService = Depends(get_worker)
):
    """
    Consulta el estado general del sistema.

    Retorna:
    - Estado del sistema (healthy, degraded, down)
    - ID de la instancia
    - Número de campañas activas
    - Total de mensajes pendientes
    - Estado de conexión a Redis
    - Estado de conexión a Supabase
    - Última actividad
    - Uptime en segundos
    """
    try:
        # Verificar conexiones
        redis_conectado = await redis.ping()
        supabase_conectado = await supabase.health_check()

        # Obtener campañas activas
        campaigns = await redis.get_active_campaigns()
        campanas_activas = len(campaigns)

        # Obtener total de mensajes pendientes
        total_pendientes = await redis.get_total_pending_messages()

        # Determinar estado del sistema
        estado = "healthy"
        if not redis_conectado or not supabase_conectado:
            estado = "degraded"
        if not redis_conectado and not supabase_conectado:
            estado = "down"

        # Uptime del worker
        uptime = worker.get_uptime_seconds()

        # Última actividad (última vez que el worker procesó algo)
        ultima_actividad = datetime.utcnow()

        return SystemStatus(
            estado=estado,
            instancia_id=settings.INSTANCE_ID,
            campanas_activas=campanas_activas,
            total_mensajes_pendientes=total_pendientes,
            redis_conectado=redis_conectado,
            supabase_conectado=supabase_conectado,
            ultima_actividad=ultima_actividad,
            uptime_segundos=uptime
        )

    except Exception as e:
        logger.error(f"Error al obtener estado del sistema: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/listar-campanas")
async def list_campaigns(
    redis: RedisService = Depends(get_redis)
):
    """
    Lista todas las campañas activas con mensajes pendientes.

    Retorna un array con los IDs de las campañas activas.
    """
    try:
        campaigns = await redis.get_active_campaigns()

        return {
            "total": len(campaigns),
            "campanas": campaigns
        }

    except Exception as e:
        logger.error(f"Error al listar campañas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
