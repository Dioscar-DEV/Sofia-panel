# API Gestor de Colas para Campañas WhatsApp

API en Python con FastAPI y Pandas para gestionar colas de envío masivo de WhatsApp. Recibe solicitudes HTTP (JSON/CSV) con miles de mensajes, los almacena en Redis como colas independientes por campaña, y los procesa automáticamente enviándolos a la API de WhatsApp Business.

## Características

- **Múltiples campañas paralelas**: Colas independientes por título de campaña
- **Worker background automático**: Procesa colas continuamente sin intervención manual
- **Alta disponibilidad**: 3 instancias Railway con load balancer automático
- **Credenciales dinámicas**: Consulta desde Supabase (tabla instancias_inputs)
- **Control de ritmo**: Delay configurable entre envíos
- **Compatible con frontend**: Acepta la misma estructura que tu módulo de WhatsApp

## Arquitectura

```
Cliente → FastAPI (Load Balancer)
           ↓
        Parseo CSV/JSON (Pandas)
           ↓
        Consulta credenciales (Supabase)
           ↓
        Encolar en Redis (lista por campaña)
           ↓
    Worker Background (asyncio)
           ↓
        Dequeue → Enviar a API WhatsApp → Delay → Repeat
```

## Stack Tecnológico

- **Framework**: FastAPI (async, auto-documentación)
- **Procesamiento CSV**: Pandas
- **Cola**: Redis
- **Base de datos**: Supabase (consulta credenciales)
- **HTTP Client**: httpx (async)
- **Validación**: Pydantic
- **Deploy**: Railway (3 instancias + Redis add-on)

## Instalación Local

### 1. Clonar repositorio

```bash
git clone <repo-url>
cd Api_panda_colas_campanas
```

### 2. Crear entorno virtual

```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno

Copiar `.env.example` a `.env` y configurar:

```env
# API WhatsApp
API_WHATSAPP_URL=https://tu-api-whatsapp.railway.app

# Intervalo entre mensajes (milisegundos)
INTERVALO_ENVIO_MS=2000

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis
REDIS_URL=redis://localhost:6379

# Debug
DEBUG=false
INSTANCE_ID=instance-local
```

### 5. Iniciar Redis (Docker)

```bash
docker run -d -p 6379:6379 redis:alpine
```

### 6. Ejecutar aplicación

```bash
uvicorn app.main:app --reload --port 8000
```

La API estará disponible en: http://localhost:8000

Documentación interactiva: http://localhost:8000/docs

## Endpoints

### POST /api/crear-campana

Crea una campaña desde CSV (compatible con tu frontend).

**Request (multipart/form-data):**

```bash
curl -X POST "http://localhost:8000/api/crear-campana" \
  -F "archivo_csv=@mensajes.csv" \
  -F "titulo_campana=promo_enero_2026" \
  -F "plantilla=promo_fibra_visual" \
  -F "buzon=14" \
  -F "idioma=es"
```

**CSV Format:**

```csv
numero,cedula,estatus_servicio,variable1,variable2,url_imagen
584121234567,12345678,ACTIVO,Juan Pérez,25.00 USD,https://ejemplo.com/img1.jpg
584129876543,87654321,SUSPENDIDO,María López,30.00 USD,
```

**Response:**

```json
{
  "campaign_id": "promo_enero_2026",
  "total_mensajes": 15000,
  "estado": "encolado",
  "timestamp": "2026-01-08T10:30:00Z"
}
```

### POST /api/crear-campana-json

Crea una campaña desde JSON directo.

**Request:**

```json
{
  "titulo_campana": "promo_enero_2026",
  "plantilla": "promo_fibra_visual",
  "buzon": "14",
  "idioma": "es",
  "mensajes": [
    {
      "numero": "584121234567",
      "cedula": "12345678",
      "estatus_servicio": "ACTIVO",
      "variable1": "Juan Pérez",
      "variable2": "25.00 USD",
      "url_imagen": "https://ejemplo.com/img1.jpg"
    }
  ]
}
```

### GET /api/estado-cola/{campaign_id}

Consulta el estado de una campaña.

**Response:**

```json
{
  "campaign_id": "promo_enero_2026",
  "total": 15000,
  "pendientes": 8500,
  "enviados": 6200,
  "fallidos": 300,
  "estado": "procesando",
  "progreso_porcentaje": 43.3,
  "ultimo_envio": "2026-01-08T11:45:23Z"
}
```

### GET /api/estado-sistema

Consulta el estado general del sistema.

**Response:**

```json
{
  "estado": "healthy",
  "instancia_id": "instance-1",
  "campanas_activas": 3,
  "total_mensajes_pendientes": 25000,
  "redis_conectado": true,
  "supabase_conectado": true,
  "ultima_actividad": "2026-01-08T11:50:00Z",
  "uptime_segundos": 86400
}
```

### GET /api/listar-campanas

Lista todas las campañas activas.

**Response:**

```json
{
  "total": 3,
  "campanas": [
    "promo_enero_2026",
    "notificacion_pago",
    "bienvenida_clientes"
  ]
}
```

### GET /health

Health check para Railway y load balancers.

**Response:**

```json
{
  "status": "healthy",
  "instance": "instance-1",
  "services": {
    "redis": "ok",
    "supabase": "ok",
    "worker": "running"
  },
  "uptime_seconds": 3600
}
```

## Deploy en Railway

### 1. Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app)
2. Crea un nuevo proyecto
3. Conecta tu repositorio de GitHub

### 2. Agregar Redis

1. En el proyecto, haz clic en "New Service"
2. Selecciona "Database" → "Redis"
3. Railway generará automáticamente la variable `REDIS_URL`

### 3. Configurar variables de entorno

En el dashboard de Railway, agrega:

```
API_WHATSAPP_URL=https://tu-api-whatsapp.railway.app
INTERVALO_ENVIO_MS=2000
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DEBUG=false
INSTANCE_ID=instance-1
```

**Nota**: `REDIS_URL` se genera automáticamente cuando agregas el add-on Redis.

### 4. Deploy automático

Railway detectará el `Dockerfile` y `railway.json` y:

- Construirá la imagen Docker
- Desplegará 3 instancias (según `railway.json`)
- Configurará load balancer automático

### 5. Verificar deploy

```bash
curl https://tu-proyecto.railway.app/health
```

## Configuración en Supabase

La API consulta credenciales de WhatsApp desde la tabla `instancia_sofia.instancias_inputs`.

**Estructura de la tabla:**

```sql
CREATE TABLE instancia_sofia.instancias_inputs (
  canal INTEGER PRIMARY KEY,
  key TEXT,  -- Formato: "TOKEN,PHONE_ID,WABA_ID"
  nameid TEXT,
  custom_name TEXT,
  output_options JSONB
);
```

**Ejemplo de insert:**

```sql
INSERT INTO instancia_sofia.instancias_inputs (
  canal, key, nameid, custom_name, output_options
) VALUES (
  14,
  'EAAG...token...,1142...phone_id...,1234...waba_id...',
  'canal_whatsapp_14',
  'WhatsApp Principal',
  '{"text": true, "photo": true}'::jsonb
);
```

## Integración con tu Frontend

Tu frontend puede enviar requests directamente a esta API cambiando solo el endpoint:

**Antes (API de envío directo):**
```javascript
const response = await fetch('https://api-envio-directo.railway.app/enviar-mensaje', {
  method: 'POST',
  body: formData
});
```

**Ahora (API de colas):**
```javascript
const response = await fetch('https://api-colas.railway.app/api/crear-campana', {
  method: 'POST',
  body: formData  // Misma estructura: archivo_csv, titulo_campana, plantilla, buzon, idioma
});
```

La API de colas:
1. Recibe el CSV
2. Parsea los datos con Pandas
3. Obtiene credenciales de Supabase usando el `buzon`
4. Encola todos los mensajes en Redis
5. El worker los envía uno a uno a la API de envío directo

## Monitoreo

### Logs en tiempo real

```bash
# Railway CLI
railway logs

# Docker local
docker logs -f <container-id>
```

### Métricas de Redis

```bash
# Conectar a Redis
redis-cli -u $REDIS_URL

# Ver todas las campañas
KEYS campaign:*

# Ver mensajes pendientes de una campaña
LLEN campaign:promo_enero_2026

# Ver stats de una campaña
HGETALL campaign:promo_enero_2026:stats
```

## Límites Configurables

En [config.py](app/config.py):

- `MAX_CSV_SIZE_MB`: Tamaño máximo de CSV (default: 50 MB)
- `MAX_MESSAGES_PER_CAMPAIGN`: Máximo mensajes por campaña (default: 100,000)
- `INTERVALO_ENVIO_MS`: Delay entre mensajes (default: 2000 ms)
- `REDIS_CAMPAIGN_TTL`: TTL para campañas completadas (default: 7 días)

## Troubleshooting

### Error: "Redis no disponible"

Verifica que Redis esté corriendo y `REDIS_URL` esté configurada correctamente.

```bash
# Test local
redis-cli ping  # Debe retornar PONG

# Test Railway
curl https://tu-proyecto.railway.app/health
```

### Error: "No se encontró el buzon 'X' en la base de datos"

Verifica que el canal existe en Supabase:

```sql
SELECT canal, custom_name, key
FROM instancia_sofia.instancias_inputs
WHERE canal = 14;
```

### Mensajes no se envían

1. Verifica que el worker esté corriendo:
   ```bash
   curl https://tu-proyecto.railway.app/api/estado-sistema
   ```

2. Revisa los logs para ver errores del worker

3. Verifica que la API de WhatsApp esté funcionando:
   ```bash
   curl -X POST https://api-whatsapp.railway.app/enviar-mensaje \
     -H "Content-Type: application/json" \
     -d '{"token":"...", "phone_id":"...", "numero":"584121234567", "template_name":"hello_world"}'
   ```

### Campañas lentas

El delay por defecto es 2000ms (2 segundos) entre mensajes. Para cambiarlo:

1. Actualiza la variable de entorno `INTERVALO_ENVIO_MS`
2. Reinicia la aplicación

**Nota**: No reduzcas demasiado el delay o Meta puede bloquear tu cuenta.

## Próximas Mejoras

- [ ] Panel de administración web
- [ ] Webhooks para notificar cuando una campaña termine
- [ ] Reintentos automáticos para mensajes fallidos
- [ ] Rate limiting por IP
- [ ] Autenticación con API key
- [ ] Métricas con Prometheus/Grafana
- [ ] Pausar/reanudar campañas manualmente

## Licencia

Proyecto privado para uso interno.

## Soporte

Para reportar bugs o solicitar features, contacta al equipo de desarrollo.
