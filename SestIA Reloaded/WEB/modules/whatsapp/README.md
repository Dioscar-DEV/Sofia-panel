# Módulo WhatsApp - Envío Masivo de Plantillas

## 📋 Descripción

Módulo integrado en SestIA Reloaded para enviar plantillas de WhatsApp Business de forma masiva mediante carga de archivos CSV. Utiliza la API de WhatsApp Business Cloud a través de un middleware personalizado.

## ✨ Características Principales

- ✅ **Selección dinámica de canales** desde base de datos (instancias_inputs)
- ✅ **Auto-completado** de credenciales al seleccionar canal
- ✅ **Multi-cuenta** - Gestiona varios números de WhatsApp
- ✅ **Consulta dinámica de plantillas** desde Meta Business Manager
- ✅ **Vista previa de mensajes** con configuración de variables
- ✅ **Registro automático de leads** en base de datos
- ✅ **Envío masivo mediante CSV** con validación de datos
- ✅ **Monitoreo en tiempo real** del progreso de envío
- ✅ **Logs detallados** de cada envío con exportación a CSV
- ✅ **Delay automático** entre mensajes (2 segundos)
- ✅ **Cancelación de envíos** en curso
- ✅ **Guardado de configuración** en localStorage

## 🚀 Instalación

### 1. Archivos del Módulo

Los archivos del módulo ya están instalados en:
```
WEB/modules/whatsapp/
  ├── init.js       # Lógica del módulo
  ├── view.html     # Interfaz de usuario
  ├── styles.css    # Estilos
  ├── setup.sql     # Script de configuración SQL
  ├── ejemplo.csv   # Archivo CSV de ejemplo
  └── README.md     # Esta documentación
```

### 2. Configuración en Base de Datos

Ejecuta el archivo `setup.sql` en el SQL Editor de Supabase:

```bash
# Ruta al archivo SQL
WEB/modules/whatsapp/setup.sql
```

Este script configura:
- ✅ Permisos del módulo (view, send)
- ✅ Asignación de permisos a roles (admin, superadmin)
- ✅ Ejemplos de configuración de canales

### 3. Configurar Canales de WhatsApp

Cada canal representa un número de WhatsApp Business. Para agregar un canal:

```sql
INSERT INTO instancia_sofia.instancias_inputs (
  canal,
  key,
  nameid,
  custom_name,
  output_options
) VALUES (
  14,  -- ID del canal de WhatsApp Business
  'TU_TOKEN, TU_PHONE_ID, TU_WABA_ID',  -- Credenciales separadas por comas
  'mi_canal_whatsapp',  -- Identificador único
  'Mi Canal WhatsApp',  -- Nombre descriptivo
  '{"text": true, "photo": true, "video": false, "gallery": false, "sticker": false, "document": true, "location": false}'::jsonb
) ON CONFLICT (nameid) DO NOTHING;
```

#### Formato del campo `key`:
```
token, phone_id, idWaba
```

#### Obtener las credenciales:

**Token Permanente:**
1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. Configuración → System Users
3. Genera un token con permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Selecciona "Never expires"

**Phone ID:**
1. Meta Business Manager → WhatsApp → API Setup
2. Copia el "Phone number ID"

**WABA ID:**
1. Meta Business Manager → WhatsApp
2. Copia el "WhatsApp Business Account ID"

### 4. Registro en Manifest

El módulo ya está registrado en `modules/manifest.json`:

```json
{
  "key": "whatsapp",
  "moduleName": "WhatsAppModule",
  "script": "modules/whatsapp/init.js",
  "view": "modules/whatsapp/view.html",
  "label": "WhatsApp Masivo",
  "description": "Envío masivo de plantillas de WhatsApp Business",
  "roles": [],
  "perms": ["modules.whatsapp.view"],
  "public": false,
  "nav": { "group": "dropdown", "order": 50, "show": true }
}
```

## 📖 Uso del Módulo

### Paso 1: Acceder al Módulo

1. Inicia sesión en SestIA con un usuario que tenga el permiso `modules.whatsapp.view`
2. Ve al menú **Módulos** en la barra de navegación
3. Selecciona **WhatsApp Masivo**

### Paso 2: Configurar Campaña

1. **Seleccionar Buzón:** Elige el canal de WhatsApp desde el selector
   - Las credenciales se cargan automáticamente
   - Las plantillas disponibles se consultan desde Meta

2. **Título de Campaña:** Ingresa un título descriptivo

3. **Seleccionar Plantilla:** Elige una plantilla de las disponibles
   - Click en "Vista previa" para configurar variables
   - Las plantillas se filtran automáticamente por el buzón seleccionado

4. **Guardar Configuración:** Click en "Guardar Configuración"

### Paso 3: Preparar CSV

Descarga el template CSV y llénalo con los datos de tus destinatarios.

**Columnas obligatorias:**
- `numero`: Teléfono con código de país (sin +)
- `cedula`: Cédula del cliente
- `estatus_servicio`: activo | cortado | suspendido

**Columnas opcionales:**
- `variable1`: Se mapea a nombre_cliente
- `variable2`: Se mapea a saldo
- `variable3`, `variable4`, etc.: Variables adicionales
- `url_imagen`: URL de imagen (si la plantilla lo requiere)
- Cualquier otra columna se guarda en metadata

**Ejemplo:**
```csv
numero,cedula,estatus_servicio,variable1,variable2,variable3,url_imagen
584121234567,12345678,ACTIVO,Juan Pérez,25.00 USD,Promoción Enero,https://ejemplo.com/promo.jpg
584129876543,87654321,SUSPENDIDO,María López,30.00 USD,Descuento Especial,
```

### Paso 4: Cargar CSV e Iniciar Envío

1. Arrastra el archivo CSV o haz click para seleccionarlo
2. Revisa la vista previa (primeras 5 filas)
3. Click en **"Iniciar Envío"**

### Paso 5: Monitorear Progreso

El panel de progreso muestra:
- **Total:** Número de mensajes a enviar
- **Enviados:** Mensajes enviados exitosamente
- **Fallidos:** Mensajes con error
- **Pendientes:** Mensajes por enviar

**Acciones disponibles:**
- ✅ Cancelar envío en curso
- ✅ Exportar log de envíos
- ✅ Iniciar nueva campaña

## 📊 Registro de Leads

Cada envío se registra automáticamente en `instancia_sofia.leads_activos`:

```sql
{
  "user_id": "584121234567",           -- número del destinatario
  "nombre_cliente": "Juan Pérez",       -- variable1
  "canal": "mi_canal_whatsapp",         -- ID del canal usado
  "titulo_anuncio": "Campaña Enero",    -- título de la campaña
  "estado": "pendiente",                -- estado inicial
  "cedula": "12345678",                 -- cédula
  "estatus_servicio": "activo",         -- estatus del servicio
  "saldo": "25.00 USD",                 -- variable2
  "metadata": {                         -- campos adicionales + control de envío
    "variable3": "Promoción Enero",
    "envio_exitoso": true,
    "envio_intentos": 1,
    "envio_wamid": "wamid.XXX",
    "envio_fecha": "2026-01-06T..."
  }
}
```

## ⚙️ Configuración Avanzada

### Middleware API

El módulo usa un middleware en Railway:
```
https://smart-whatsapp-api-fibex-production-d80a.up.railway.app/enviar-mensaje
```

Si necesitas usar tu propia API, modifica la línea en `init.js`:
```javascript
state.config.apiUrl = 'TU_URL_DE_API';
```

### Delay entre Mensajes

Por defecto hay un delay de 2 segundos. Para modificarlo, edita en `init.js`:
```javascript
await sleep(2000); // Cambiar valor en milisegundos
```

### Estados de Canal

Los canales pueden tener tres estados:
- `live`: Producción (se muestra)
- `test`: Pruebas (se muestra)
- `off`: Desactivado (NO se muestra)

## 🔍 Troubleshooting

### No se muestran canales

**Problema:** El selector aparece vacío

**Soluciones:**
1. Verifica que existen canales con `canal = 14`
2. Verifica que el estado sea `live` o `test` (no `off`)
3. Revisa la consola del navegador para errores de Supabase

```sql
-- Verificar canales
SELECT * FROM instancia_sofia.instancias_inputs WHERE canal = 14;
```

### No se cargan las plantillas

**Problema:** El selector de plantillas está vacío

**Soluciones:**
1. Verifica que el campo `key` tenga los 3 valores: token, phone_id, idWaba
2. Verifica que el token sea válido y no haya expirado
3. Verifica que existan plantillas activas en Meta Business Manager
4. Revisa la consola del navegador para errores de API

### Error al enviar mensajes

**Problema:** Los envíos fallan

**Soluciones:**
1. Verifica que los números tengan WhatsApp activo
2. Verifica que la plantilla esté APROBADA en Meta
3. Verifica que las variables coincidan con la plantilla
4. Revisa los logs de error en el panel de progreso

### No se registran leads

**Problema:** Los leads no aparecen en la base de datos

**Soluciones:**
1. Verifica que la tabla `instancia_sofia.leads_activos` exista
2. Verifica los permisos de INSERT para el usuario de Supabase
3. Revisa la consola para errores de base de datos

## 📚 Referencias

- [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Crear Plantillas de Mensaje](https://business.facebook.com/wa/manage/message-templates/)
- [Meta Business Manager](https://business.facebook.com/)

## 🤝 Soporte

Para soporte técnico:
1. Revisa los logs en la consola del navegador
2. Revisa los logs de envío en el módulo
3. Exporta el log y revisa los errores
4. Consulta la documentación de Meta para códigos de error específicos

## 📝 Changelog

### v1.0.0 (Enero 2026)
- ✅ Integración inicial en SestIA Reloaded
- ✅ Selección dinámica de canales desde BD
- ✅ Consulta automática de plantillas
- ✅ Vista previa de mensajes
- ✅ Registro automático de leads
- ✅ Monitoreo en tiempo real
- ✅ Exportación de logs
