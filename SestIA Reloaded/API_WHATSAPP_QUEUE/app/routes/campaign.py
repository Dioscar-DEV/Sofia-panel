"""
Endpoints para gestión de campañas
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Header
from typing import Optional
from datetime import datetime
import logging
import uuid

from app.models import CreateCampaignRequest, CreateCampaignResponse, MessageData, EnqueueMessageRequest, EnqueueMessageResponse
from app.services.redis_service import RedisService
from app.services.supabase_service import SupabaseService
from app.utils.csv_parser import parse_csv, validate_csv_size
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# Dependencias globales (se inyectarán desde main.py)
redis_service: Optional[RedisService] = None
supabase_service: Optional[SupabaseService] = None


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


@router.post("/crear-campana", response_model=CreateCampaignResponse)
async def crear_campana_csv(
    titulo_campana: str = Form(..., description="ID único de la campaña"),
    plantilla: str = Form(..., description="Nombre de la plantilla Meta"),
    buzon: str = Form(..., description="ID del canal en Supabase"),
    idioma: str = Form(default="es", description="Código de idioma"),
    archivo_csv: Optional[UploadFile] = File(None, description="Archivo CSV con mensajes"),
    redis: RedisService = Depends(get_redis),
    supabase: SupabaseService = Depends(get_supabase)
):
    """
    Crea una campaña desde CSV (compatible con frontend).

    Acepta archivo CSV con columnas:
    - numero (obligatorio)
    - cedula
    - estatus_servicio
    - variable1, variable2, variable3, variable4, variable5
    - url_imagen
    """
    try:
        # Verificar que se envió un archivo CSV
        if not archivo_csv:
            raise HTTPException(
                status_code=400,
                detail="Debe enviar un archivo CSV"
            )

        # Validar tamaño del archivo
        file_content = await archivo_csv.read()
        validate_csv_size(len(file_content), settings.MAX_CSV_SIZE_MB)

        # Parsear CSV
        messages_data = await parse_csv(file_content)

        if not messages_data:
            raise HTTPException(
                status_code=400,
                detail="El CSV no contiene datos válidos"
            )

        # Validar límite de mensajes
        if len(messages_data) > settings.MAX_MESSAGES_PER_CAMPAIGN:
            raise HTTPException(
                status_code=400,
                detail=f"El máximo de mensajes por campaña es {settings.MAX_MESSAGES_PER_CAMPAIGN}"
            )

        logger.info(
            f"Creando campaña '{titulo_campana}': "
            f"{len(messages_data)} mensajes, plantilla '{plantilla}', buzon '{buzon}'"
        )

        # Verificar que el buzon existe en Supabase
        try:
            credentials = await supabase.get_credentials(buzon)
            logger.info(f"Credenciales validadas para buzon '{buzon}': {credentials['custom_name']}")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Preparar mensajes para encolar
        # IMPORTANTE: Cada mensaje debe incluir plantilla, buzon, idioma
        messages_to_enqueue = []
        for msg_data in messages_data:
            message = {
                "numero": msg_data.get("numero"),
                "plantilla": plantilla,
                "buzon": buzon,
                "idioma": idioma,
                # Campos opcionales del CSV
                "cedula": msg_data.get("cedula"),
                "estatus_servicio": msg_data.get("estatus_servicio"),
                "variable1": msg_data.get("variable1"),
                "variable2": msg_data.get("variable2"),
                "variable3": msg_data.get("variable3"),
                "variable4": msg_data.get("variable4"),
                "variable5": msg_data.get("variable5"),
                "url_imagen": msg_data.get("url_imagen")
            }
            messages_to_enqueue.append(message)

        # Metadata de la campaña
        metadata = {
            "plantilla": plantilla,
            "buzon": buzon,
            "idioma": idioma,
            "created_at": datetime.utcnow().isoformat()
        }

        # Encolar en Redis
        total_encolados = await redis.enqueue_campaign(
            campaign_id=titulo_campana,
            messages=messages_to_enqueue,
            metadata=metadata
        )

        logger.info(f"Campaña '{titulo_campana}' creada exitosamente: {total_encolados} mensajes encolados")

        return CreateCampaignResponse(
            campaign_id=titulo_campana,
            total_mensajes=total_encolados,
            estado="encolado",
            timestamp=datetime.utcnow()
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error al crear campaña: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post("/crear-campana-json", response_model=CreateCampaignResponse)
async def crear_campana_json(
    request: CreateCampaignRequest,
    redis: RedisService = Depends(get_redis),
    supabase: SupabaseService = Depends(get_supabase)
):
    """
    Crea una campaña desde JSON directo.

    Acepta un objeto JSON con:
    - titulo_campana
    - plantilla
    - buzon
    - idioma
    - mensajes (array de MessageData)
    """
    try:
        logger.info(
            f"Creando campaña JSON '{request.titulo_campana}': "
            f"{len(request.mensajes)} mensajes, plantilla '{request.plantilla}', buzon '{request.buzon}'"
        )

        # Verificar que el buzon existe en Supabase
        try:
            credentials = await supabase.get_credentials(request.buzon)
            logger.info(f"Credenciales validadas para buzon '{request.buzon}': {credentials['custom_name']}")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Preparar mensajes para encolar
        messages_to_enqueue = []
        for msg in request.mensajes:
            message = {
                "numero": msg.numero,
                "plantilla": request.plantilla,
                "buzon": request.buzon,
                "idioma": request.idioma,
                "cedula": msg.cedula,
                "estatus_servicio": msg.estatus_servicio,
                "variable1": msg.variable1,
                "variable2": msg.variable2,
                "variable3": msg.variable3,
                "variable4": msg.variable4,
                "variable5": msg.variable5,
                "url_imagen": msg.url_imagen
            }
            messages_to_enqueue.append(message)

        # Metadata de la campaña
        metadata = {
            "plantilla": request.plantilla,
            "buzon": request.buzon,
            "idioma": request.idioma,
            "created_at": datetime.utcnow().isoformat()
        }

        # Encolar en Redis
        total_encolados = await redis.enqueue_campaign(
            campaign_id=request.titulo_campana,
            messages=messages_to_enqueue,
            metadata=metadata
        )

        logger.info(f"Campaña JSON '{request.titulo_campana}' creada: {total_encolados} mensajes encolados")

        return CreateCampaignResponse(
            campaign_id=request.titulo_campana,
            total_mensajes=total_encolados,
            estado="encolado",
            timestamp=datetime.utcnow()
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error al crear campaña JSON: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post("/encolar-mensaje", response_model=EnqueueMessageResponse)
async def encolar_mensaje_individual(
    request: EnqueueMessageRequest,
    redis: RedisService = Depends(get_redis),
    x_campaignid: Optional[str] = Header(None, alias="x-campaignid", description="ID de la campaña")
):
    """
    Encola un mensaje individual (compatible con frontend que envía credenciales directas).

    Este endpoint acepta mensajes con token y phone_id incluidos, sin necesidad de consultar Supabase.
    El worker usará estas credenciales directamente para enviar el mensaje.

    Campaign ID (prioridad):
    1. Header 'x-campaignid' (minúsculas, si se proporciona)
    2. Campo 'campaignid' en el body JSON (minúsculas, si se proporciona)
    3. Auto-generado si no se proporciona ninguno

    Esto permite agrupar múltiples mensajes en una sola campaña usando el header.
    """
    try:
        # Determinar campaign_id (prioridad: header > body > auto-generado)
        campaign_id = x_campaignid or request.campaignid or f"auto_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

        logger.info(
            f"Encolando mensaje individual en campaña '{campaign_id}': "
            f"número {request.numero}, plantilla '{request.template_name}'"
        )

        # Convertir variables de lista a diccionario variable1, variable2, etc.
        message_dict = {
            "numero": request.numero,
            "plantilla": request.template_name,
            "idioma": request.idioma,
            "url_imagen": request.url_imagen,
            # IMPORTANTE: Incluir credenciales directamente en el mensaje
            "token": request.token,
            "phone_id": request.phone_id,
            # No incluir buzon porque las credenciales ya están en el mensaje
            "buzon": None
        }

        # Convertir array de variables a variable1, variable2, etc.
        if request.variables:
            for i, var in enumerate(request.variables, start=1):
                message_dict[f"variable{i}"] = var

        # Metadata de la campaña
        metadata = {
            "plantilla": request.template_name,
            "idioma": request.idioma,
            "created_at": datetime.utcnow().isoformat(),
            "tipo": "mensaje_individual"
        }

        # Encolar en Redis
        total_encolados = await redis.enqueue_campaign(
            campaign_id=campaign_id,
            messages=[message_dict],
            metadata=metadata
        )

        # Obtener posición en la cola
        stats = await redis.get_campaign_stats(campaign_id)
        position = stats['total'] if stats else 1

        logger.info(f"Mensaje encolado exitosamente en campaña '{campaign_id}', posición {position}")

        return EnqueueMessageResponse(
            success=True,
            campaignid=campaign_id,
            message=f"Mensaje encolado exitosamente. Será procesado en {settings.INTERVALO_ENVIO_MS/1000} segundos.",
            position_in_queue=position
        )

    except Exception as e:
        logger.error(f"Error al encolar mensaje individual: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
