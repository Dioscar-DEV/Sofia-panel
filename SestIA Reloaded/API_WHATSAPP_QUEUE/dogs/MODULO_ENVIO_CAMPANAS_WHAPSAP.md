# Módulo WhatsApp - Envío Masivo de Plantillas

## 📋 Descripción

Módulo para enviar plantillas de WhatsApp Business de forma masiva mediante carga de archivos CSV. Utiliza la API de WhatsApp Business Cloud a través de un middleware personalizado.

**NUEVO:** Ahora con **selección dinámica de canales** desde la base de datos. Gestiona múltiples cuentas de WhatsApp sin modificar código.

## ✨ Características

- ✅ **Selección de canales** desde base de datos (instancias_inputs)
- ✅ **Auto-completado** de credenciales al seleccionar canal
- ✅ **Multi-cuenta** - Gestiona varios números de WhatsApp
- ✅ Envío masivo mediante CSV
- ✅ Soporte para variables dinámicas ({{1}}, {{2}}, etc.)
- ✅ Soporte para imágenes en cabecera
- ✅ Monitoreo en tiempo real del progreso
- ✅ Logs detallados de cada envío
- ✅ Exportación de logs en CSV
- ✅ Delay automático entre mensajes (2 seg)
- ✅ Cancelación de envíos en curso
- ✅ Guardado de configuración en localStorage

## 🚀 Instalación

### 1. Configurar Canales en Base de Datos

Antes de usar el módulo, debes configurar al menos un canal de WhatsApp en la tabla `instancia_sofia.instancias_inputs`.

Consulta el archivo [CONFIG_CANALES.md](./CONFIG_CANALES.md) para instrucciones detalladas.

**Ejemplo rápido:**

```sql
INSERT INTO instancia_sofia.instancias_inputs (
  canal, key, nameid, custom_name, output_options
) VALUES (
  14,
  'TU_TOKEN, TU_PHONE_ID, TU_WABA_ID',
  'mi_canal_whatsapp',
  'Mi Canal WhatsApp',
  '{"text": true, "photo": true, "video": false, "gallery": false, "sticker": false, "document": true, "location": false}'::jsonb
);
```

Ver archivo [EJEMPLO_INSERTS.sql](./EJEMPLO_INSERTS.sql) para más ejemplos.

### 2. Registro del Módulo

El módulo ya está registrado en `manifest.json`:

```json
{
  "key": "whatsapp",
  "moduleName": "WhatsAppModule",
  "script": "modules/whatsapp/init.js",
  "view": "modules/whatsapp/view.html",
  "label": "WhatsApp Masivo",
  "roles": [],
  "perms": ["modules.whatsapp.view"],
  "public": false,
  "nav": { "group": "dropdown", "order": 50, "show": true }
}
```

### 3. Permisos en Base de Datos

Ejecuta en Supabase SQL Editor:

```sql
-- Crear permiso para el módulo
INSERT INTO permissions (perm_key, name, description, module) VALUES 
('modules.whatsapp.view', 'Ver WhatsApp Masivo', 'Acceso al módulo de envío masivo de WhatsApp', 'whatsapp'),
('modules.whatsapp.send', 'Enviar WhatsApp Masivo', 'Permiso para realizar envíos masivos', 'whatsapp')
ON CONFLICT (perm_key) DO NOTHING;

-- Asignar a admin y superadmin
INSERT INTO role_permissions (role_key, perm_key) VALUES 
('admin', 'modules.whatsapp.view'),
('admin', 'modules.whatsapp.send'),
('superadmin', 'modules.whatsapp.view'),
('superadmin', 'modules.whatsapp.send')
ON CONFLICT (role_key, perm_key) DO NOTHING;
```

## 📖 Uso

### Paso 1: Configurar API

1. Obtén tu **Token Permanente** del System User en Meta Business Manager
2. Obtén el **Phone ID** de tu número de WhatsApp Business
3. Obtén el **WABA ID** (ID de la cuenta de WhatsApp Business) para listar plantillas
4. Configura la **URL de tu API** en Railway (middleware)
5. Especifica el **nombre de la plantilla** (debe existir y estar activa en Meta)
6. Selecciona el **idioma** de la plantilla

### Paso 2: Preparar CSV

Crea un archivo CSV con el siguiente formato (campos obligatorios indicados):

```csv
numero,cedula,estatus_servicio,variable1,variable2,url_imagen
584121234567,12345678,ACTIVO,Juan Pérez,25.00 USD,https://ejemplo.com/img1.jpg
584129876543,87654321,SUSPENDIDO,María López,30.00 USD,
584125555555,55555555,CORTADO,Pedro García,15.50 USD,https://ejemplo.com/promo.png
```

**Columnas:**
- `numero` (obligatorio): Teléfono con código de país (sin +)
- `cedula` (obligatorio): Identificador del abonado
- `estatus_servicio` (obligatorio): activo | cortado | suspendido (se normaliza a minúsculas)
- `variable1`: Nombre del cliente (se registra como nombre_cliente)
- `variable2`: Saldo del cliente (se registra como saldo)
- `url_imagen`: (Opcional) URL de imagen si la plantilla tiene cabecera de imagen
- `variable3..N` y cualquier otra columna extra (p.ej. `franquicia`, `direccion`): se guardan en metadata

### Paso 3: Cargar y Enviar

1. Arrastra el CSV o haz clic para seleccionar
2. Revisa la vista previa (primeras 5 filas)
3. Haz clic en "🚀 Iniciar Envío" (se registran leads en BD como pendientes y se envían mensajes)
4. Monitorea el progreso en tiempo real

## 🗄️ Registro en Base de Datos

Cada fila del CSV se registra en `instancia_sofia.leads_activos` con el siguiente mapeo:

- `user_id` ← `numero`
- `nombre_cliente` ← `variable1`
- `canal` ← `channelId` seleccionado (o `whatsapp`)
- `titulo_anuncio` ← Título de campaña configurado
- `estado` ← `pendiente`
- `cedula` ← `cedula`
- `estatus_servicio` ← `estatus_servicio` (normalizado a minúsculas)
- `saldo` ← `variable2`
- `metadata` ← resto de columnas (p.ej. `variable3`, `variable4`, `franquicia`, etc.)
  - Nota: campos adicionales como `direccion` se guardan dentro de `metadata`

Nota: Debes contar con políticas RLS adecuadas para permitir `insert` en esa tabla desde el cliente.

## 🔧 API del Middleware

### Endpoint
```
POST https://tu-proyecto.railway.app/enviar-mensaje
```

### Body (JSON)
```json
{
  "token": "EAAG...",
  "phone_id": "1142...",
  "numero": "584121234567",
  "template_name": "promo_fibra_visual",
  "idioma": "es",
  "variables": ["Juan", "25.00 USD"],
  "url_imagen": "https://ejemplo.com/imagen.jpg"
}
```

### Respuestas

**200 OK - Éxito**
```json
{
  "status": "success",
  "id": "wamid.HBgLM..."
}
```

**400 Bad Request - Datos faltantes**
```json
{
  "error": "Faltan datos obligatorios"
}
```

**500 Internal Server Error - Error de Meta**
```json
{
  "status": "error",
  "meta_error": "Descripción del error de Meta"
}
```

## 📊 Funcionalidades del Panel

### Estadísticas en Tiempo Real
- **Total**: Número total de mensajes a enviar
- **Enviados**: Mensajes enviados exitosamente
- **Fallidos**: Mensajes que no se pudieron enviar
- **Pendientes**: Mensajes en cola

### Barra de Progreso
Muestra el porcentaje de avance del envío masivo.

### Log de Envíos
Registro detallado con:
- Hora de cada intento
- Número de teléfono
- Estado (éxito/error)
- Mensaje de error (si aplica)
- ID del mensaje de WhatsApp (si fue exitoso)

### Exportar Log
Descarga un CSV con todos los registros del envío para auditoría.

## ⚙️ Configuración Avanzada

### Delay entre Mensajes
El delay predeterminado es de **2 segundos**. Para modificarlo, edita en `init.js`:

```javascript
// Línea ~287
await sleep(2000); // Cambiar 2000 por el valor deseado en ms
```

### Guardar Configuración
La configuración se guarda automáticamente en `localStorage` del navegador, así no tienes que reingresarla cada vez.

## ⚠️ Notas Importantes

1. **Plantillas Aprobadas**: Solo puedes enviar plantillas que estén aprobadas y activas en Meta Business Manager
2. **Límites de Meta**: Respeta los límites de envío de tu cuenta de WhatsApp Business
3. **Números Válidos**: Los números deben tener WhatsApp activo
4. **Variables**: El número de variables en el CSV debe coincidir con las de la plantilla
5. **Imágenes**: Solo envía `url_imagen` si la plantilla tiene cabecera de imagen configurada

## 🐛 Troubleshooting

### Error: "Token inválido"
- Verifica que el token sea del System User, no del usuario temporal
- Asegúrate de que tenga los permisos necesarios

### Error: "Plantilla no existe"
- Confirma que el nombre de la plantilla sea exacto (case-sensitive)
- Verifica que esté en estado "Approved" en Meta
 - Si no ves plantillas en el selector: asegúrate de haber incluido `idWaba` como tercer valor en el campo `key` del canal

### Error: "Número no válido"
- El número debe incluir código de país sin el símbolo +
- Ejemplo correcto: 584121234567

### Envíos lentos
- Es normal, hay un delay de 2 segundos entre mensajes para evitar bloqueos de Meta
- Para envíos grandes, considera dividir en múltiples campañas

## 📝 Ejemplos de Plantillas

### Plantilla Simple (Sin variables)
```
Nombre: hello_world
Contenido: Hola, este es un mensaje de prueba.
```

CSV:
```csv
numero
584121234567
584129876543
```

### Plantilla con Variables
```
Nombre: notificacion_pago
Contenido: Hola {{1}}, tu pago de {{2}} ha sido procesado.
```

CSV:
```csv
numero,cedula,estatus_servicio,variable1,variable2
584121234567,12345678,ACTIVO,Juan,100 USD
584129876543,87654321,SUSPENDIDO,María,250 USD
```

### Plantilla con Imagen
```
Nombre: promo_visual
Header: [IMAGEN]
Contenido: Hola {{1}}, mira nuestra promo de {{2}} Mbps.
```

CSV:
```csv
numero,cedula,estatus_servicio,variable1,variable2,url_imagen
584121234567,12345678,ACTIVO,Juan,600,https://i.imgur.com/promo.jpg
584129876543,87654321,CORTADO,María,1000,https://i.imgur.com/promo.jpg
```

## 🔐 Seguridad

- El token se almacena en localStorage (solo accesible desde tu dominio)
- Todas las comunicaciones con la API deben ser HTTPS
- No expongas el token en repositorios públicos
- Considera usar variables de entorno para datos sensibles

## 📄 Licencia

Este módulo es parte de SestIA y sigue la misma licencia del proyecto principal.

---

**Desarrollado para SestIA v2.0**
