"""
Modelos Pydantic para validación de datos
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class MessageData(BaseModel):
    """Modelo para un mensaje individual"""
    numero: str = Field(..., description="Número de teléfono con código de país (sin +)")
    cedula: Optional[str] = Field(None, description="Cédula del cliente")
    estatus_servicio: Optional[str] = Field(None, description="Estado del servicio")
    variable1: Optional[str] = Field(None, description="Primera variable de la plantilla")
    variable2: Optional[str] = Field(None, description="Segunda variable de la plantilla")
    variable3: Optional[str] = Field(None, description="Tercera variable de la plantilla")
    variable4: Optional[str] = Field(None, description="Cuarta variable de la plantilla")
    variable5: Optional[str] = Field(None, description="Quinta variable de la plantilla")
    url_imagen: Optional[str] = Field(None, description="URL de la imagen (si la plantilla usa cabecera de imagen)")

    @field_validator('numero')
    @classmethod
    def validate_numero(cls, v: str) -> str:
        """Valida que el número no esté vacío"""
        if not v or not v.strip():
            raise ValueError("El número de teléfono es obligatorio")
        return v.strip()

    @field_validator('estatus_servicio')
    @classmethod
    def normalize_estatus(cls, v: Optional[str]) -> Optional[str]:
        """Normaliza el estatus a minúsculas"""
        return v.lower() if v else None


class CreateCampaignRequest(BaseModel):
    """Modelo para crear una campaña (JSON directo)"""
    titulo_campana: str = Field(..., description="ID único de la campaña")
    plantilla: str = Field(..., description="Nombre de la plantilla Meta")
    buzon: str = Field(..., description="ID del canal en Supabase")
    idioma: str = Field(default="es", description="Código de idioma de la plantilla")
    mensajes: List[MessageData] = Field(..., description="Lista de mensajes a enviar")

    @field_validator('mensajes')
    @classmethod
    def validate_mensajes(cls, v: List[MessageData]) -> List[MessageData]:
        """Valida que haya al menos un mensaje"""
        if not v or len(v) == 0:
            raise ValueError("Debe incluir al menos un mensaje")
        if len(v) > 100000:
            raise ValueError("El máximo de mensajes por campaña es 100,000")
        return v


class CreateCampaignResponse(BaseModel):
    """Respuesta al crear una campaña"""
    campaign_id: str
    total_mensajes: int
    estado: str
    timestamp: datetime


class CampaignStatus(BaseModel):
    """Estado de una campaña"""
    campaign_id: str
    total: int
    pendientes: int
    enviados: int
    fallidos: int
    estado: str  # "procesando", "completado", "encolado"
    progreso_porcentaje: float
    ultimo_envio: Optional[datetime] = None


class SystemStatus(BaseModel):
    """Estado del sistema"""
    estado: str  # "healthy", "degraded", "down"
    instancia_id: str
    campanas_activas: int
    total_mensajes_pendientes: int
    redis_conectado: bool
    supabase_conectado: bool
    ultima_actividad: Optional[datetime] = None
    uptime_segundos: int


class WhatsAppCredentials(BaseModel):
    """Credenciales de WhatsApp"""
    token: str
    phone_id: str
    waba_id: Optional[str] = None


class WhatsAppMessagePayload(BaseModel):
    """Payload para enviar mensaje a la API de WhatsApp"""
    token: str
    phone_id: str
    numero: str
    template_name: str
    idioma: str = "es"
    variables: Optional[List[str]] = None
    url_imagen: Optional[str] = None


class WhatsAppResponse(BaseModel):
    """Respuesta de la API de WhatsApp"""
    success: bool
    wamid: Optional[str] = None
    error: Optional[str] = None


class EnqueueMessageRequest(BaseModel):
    """Modelo para encolar un mensaje individual desde el frontend"""
    token: str = Field(..., description="Token de WhatsApp")
    phone_id: str = Field(..., description="Phone ID de WhatsApp")
    numero: str = Field(..., description="Número de teléfono destino")
    template_name: str = Field(..., description="Nombre de la plantilla")
    variables: Optional[List[str]] = Field(None, description="Variables de la plantilla")
    idioma: Optional[str] = Field(default="es", description="Código de idioma")
    url_imagen: Optional[str] = Field(None, description="URL de imagen (opcional)")
    campaignid: Optional[str] = Field(None, description="ID de campaña (opcional, usar header 'x-campaignid' preferentemente)")


class EnqueueMessageResponse(BaseModel):
    """Respuesta al encolar un mensaje individual"""
    success: bool
    campaignid: str
    message: str
    position_in_queue: int
