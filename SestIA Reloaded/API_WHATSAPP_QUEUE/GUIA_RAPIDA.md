# Guía Rápida de Uso

## Inicio Rápido Local

### 1. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 2. Configurar .env

Copia `.env.example` a `.env` y configura tus variables:

```env
API_WHATSAPP_URL=https://tu-api-whatsapp.railway.app
INTERVALO_ENVIO_MS=2000
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=tu_supabase_key
REDIS_URL=redis://localhost:6379
DEBUG=true
INSTANCE_ID=local
```

### 3. Iniciar Redis

```bash
docker run -d -p 6379:6379 --name redis-colas redis:alpine
```

### 4. Ejecutar la API

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Probar la API

Abre http://localhost:8000/docs para ver la documentación interactiva.

## Ejemplo de Uso con CURL

### Crear campaña desde CSV

```bash
curl -X POST "http://localhost:8000/api/crear-campana" \
  -F "archivo_csv=@ejemplo_mensajes.csv" \
  -F "titulo_campana=test_campaign_001" \
  -F "plantilla=hello_world" \
  -F "buzon=14" \
  -F "idioma=es"
```

### Consultar estado de la campaña

```bash
curl "http://localhost:8000/api/estado-cola/test_campaign_001"
```

### Ver estado del sistema

```bash
curl "http://localhost:8000/api/estado-sistema"
```

### Listar campañas activas

```bash
curl "http://localhost:8000/api/listar-campanas"
```

## Ejemplo con Python

```python
import requests

# Crear campaña desde CSV
with open('ejemplo_mensajes.csv', 'rb') as f:
    files = {'archivo_csv': f}
    data = {
        'titulo_campana': 'promo_enero',
        'plantilla': 'promo_fibra_visual',
        'buzon': '14',
        'idioma': 'es'
    }

    response = requests.post(
        'http://localhost:8000/api/crear-campana',
        files=files,
        data=data
    )

    print(response.json())

# Consultar estado
response = requests.get('http://localhost:8000/api/estado-cola/promo_enero')
print(response.json())
```

## Ejemplo con JavaScript (Frontend)

```javascript
// Crear campaña desde CSV
const formData = new FormData();
formData.append('archivo_csv', fileInput.files[0]);
formData.append('titulo_campana', 'promo_enero');
formData.append('plantilla', 'promo_fibra_visual');
formData.append('buzon', '14');
formData.append('idioma', 'es');

const response = await fetch('http://localhost:8000/api/crear-campana', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);

// Consultar estado cada 5 segundos
setInterval(async () => {
  const status = await fetch(`http://localhost:8000/api/estado-cola/promo_enero`);
  const data = await status.json();
  console.log(`Progreso: ${data.progreso_porcentaje}%`);
}, 5000);
```

## Deploy en Railway

### 1. Crear proyecto

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init
```

### 2. Agregar Redis

En el dashboard de Railway:
1. New Service → Database → Redis
2. Esperar a que se cree `REDIS_URL` automáticamente

### 3. Configurar variables

```bash
railway variables set API_WHATSAPP_URL=https://tu-api-whatsapp.railway.app
railway variables set INTERVALO_ENVIO_MS=2000
railway variables set SUPABASE_URL=https://xxxxx.supabase.co
railway variables set SUPABASE_KEY=tu_supabase_key
railway variables set DEBUG=false
railway variables set INSTANCE_ID=instance-1
```

### 4. Deploy

```bash
railway up
```

### 5. Verificar

```bash
railway logs
```

## Monitoreo en Producción

### Ver logs en tiempo real

```bash
railway logs --follow
```

### Ver métricas de Redis

Conectar a Redis de Railway:

```bash
redis-cli -u $REDIS_URL

# Ver campañas activas
KEYS campaign:*

# Ver mensajes pendientes
LLEN campaign:promo_enero

# Ver estadísticas
HGETALL campaign:promo_enero:stats
```

## Troubleshooting Común

### Redis no conecta

```bash
# Verificar que Redis esté corriendo
docker ps | grep redis

# Test de conexión
redis-cli ping
```

### Supabase timeout

Verifica que el `SUPABASE_KEY` sea correcto y que la tabla `instancias_inputs` exista:

```sql
SELECT * FROM instancia_sofia.instancias_inputs WHERE canal = 14;
```

### Worker no procesa

Revisa los logs para ver si hay errores:

```bash
# Local
uvicorn app.main:app --log-level debug

# Railway
railway logs | grep "worker"
```

### Mensajes fallan

Verifica que la API de WhatsApp esté funcionando:

```bash
curl -X POST https://api-whatsapp.railway.app/enviar-mensaje \
  -H "Content-Type: application/json" \
  -d '{
    "token": "tu_token",
    "phone_id": "tu_phone_id",
    "numero": "584121234567",
    "template_name": "hello_world"
  }'
```

## Notas Importantes

1. **Delay entre mensajes**: El default es 2000ms (2 segundos). No reducir demasiado para evitar bloqueos de Meta.

2. **Límites**: Por defecto la API acepta hasta 100,000 mensajes por campaña y archivos CSV de hasta 50MB.

3. **Credenciales**: Deben estar configuradas en Supabase en la tabla `instancias_inputs` con el formato: `"TOKEN,PHONE_ID,WABA_ID"`.

4. **Campañas paralelas**: Puedes crear múltiples campañas simultáneamente, cada una con su propia cola en Redis.

5. **TTL**: Las campañas completadas se eliminan automáticamente de Redis después de 7 días.
