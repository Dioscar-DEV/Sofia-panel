# Integración del Módulo WhatsApp en SestIA Reloaded

## 📋 Resumen de Integración

Se ha integrado exitosamente el módulo **WhatsApp Masivo** en el proyecto SestIA Reloaded. Este módulo permite el envío masivo de plantillas de WhatsApp Business mediante carga de archivos CSV.

**Fecha de integración:** Enero 6, 2026  
**Versión:** 1.0.0

---

## 📁 Archivos Agregados

### Módulo Principal
```
WEB/modules/whatsapp/
├── init.js           # Lógica del módulo (1382 líneas)
├── view.html         # Interfaz de usuario (339 líneas)
├── styles.css        # Estilos personalizados (1024 líneas)
├── setup.sql         # Script de configuración SQL
├── ejemplo.csv       # Archivo CSV de ejemplo
└── README.md         # Documentación completa del módulo
```

### Archivos Modificados
```
WEB/modules/manifest.json    # Agregado registro del módulo WhatsApp
```

---

## ✨ Funcionalidades Integradas

### 1. Selección Dinámica de Canales
- ✅ Carga automática de canales desde `instancia_sofia.instancias_inputs`
- ✅ Filtrado por canal ID = 14 (WhatsApp Business)
- ✅ Auto-completado de credenciales al seleccionar canal
- ✅ Soporte para múltiples cuentas de WhatsApp

### 2. Gestión de Plantillas
- ✅ Consulta dinámica de plantillas desde Meta Business Manager
- ✅ Vista previa de mensajes con configuración de variables
- ✅ Detección automática de variables en plantillas ({{1}}, {{2}}, etc.)
- ✅ Actualización en tiempo real del preview

### 3. Envío Masivo
- ✅ Carga de CSV con validación de formato
- ✅ Validación de columnas obligatorias (numero, cedula, estatus_servicio)
- ✅ Soporte para variables dinámicas
- ✅ Registro automático de leads en base de datos
- ✅ Delay de 2 segundos entre mensajes
- ✅ Cancelación de envíos en curso

### 4. Monitoreo y Logs
- ✅ Panel de progreso en tiempo real
- ✅ Estadísticas (Total, Enviados, Fallidos, Pendientes)
- ✅ Barra de progreso visual
- ✅ Logs detallados de cada envío
- ✅ Exportación de logs a CSV

### 5. Persistencia de Datos
- ✅ Guardado de configuración en localStorage
- ✅ Registro de leads en `instancia_sofia.leads_activos`
- ✅ Metadata de envío (éxito, intentos, wamid, error, fecha)

---

## 🔧 Configuración Requerida

### 1. Base de Datos (Supabase)

#### Ejecutar Script SQL
```sql
-- Archivo: WEB/modules/whatsapp/setup.sql
-- Configura permisos y ejemplos de canales
```

#### Permisos Creados
```
modules.whatsapp.view  → Ver WhatsApp Masivo
modules.whatsapp.send  → Enviar WhatsApp Masivo
```

#### Roles con Acceso
- ✅ admin
- ✅ superadmin

### 2. Configurar Canales

```sql
-- Ejemplo de configuración de canal
INSERT INTO instancia_sofia.instancias_inputs (
  canal,        -- 14 (WhatsApp Business)
  key,          -- 'token, phone_id, idWaba'
  nameid,       -- Identificador único
  custom_name,  -- Nombre descriptivo
  output_options
) VALUES (
  14,
  'EAAGl2ZBBtZABoBAPxxx..., 114235551234567, 987654321098765',
  'whatsapp_principal',
  'WhatsApp Principal',
  '{"text": true, "photo": true}'::jsonb
);
```

#### Formato del Campo `key`
```
token, phone_id, idWaba
```
- **token:** Token permanente del System User (Meta)
- **phone_id:** ID del número de WhatsApp Business
- **idWaba:** ID de la cuenta WhatsApp Business (para consultar plantillas)

### 3. Tabla de Leads

El módulo requiere que exista la tabla `instancia_sofia.leads_activos` con los campos:

```sql
user_id           TEXT      -- Número de teléfono
nombre_cliente    TEXT      -- Nombre del destinatario
canal             TEXT      -- Identificador del canal
titulo_anuncio    TEXT      -- Título de la campaña
estado            TEXT      -- 'pendiente', 'activo', etc.
metadata          JSONB     -- Información adicional
cedula            TEXT      -- Cédula del cliente
estatus_servicio  TEXT      -- 'activo', 'cortado', 'suspendido'
saldo             TEXT      -- Saldo del cliente
```

---

## 📖 Cómo Usar

### Paso 1: Acceder al Módulo
1. Iniciar sesión con usuario admin o superadmin
2. Ir a **Módulos** → **WhatsApp Masivo**

### Paso 2: Configurar Campaña
1. Seleccionar buzón de WhatsApp
2. Ingresar título de campaña
3. Seleccionar plantilla
4. Click en "Vista previa" para configurar variables
5. Guardar configuración

### Paso 3: Cargar CSV
1. Descargar template CSV
2. Llenar con datos de destinatarios
3. Arrastrar archivo o seleccionar manualmente

**Formato CSV:**
```csv
numero,cedula,estatus_servicio,variable1,variable2,url_imagen
584121234567,12345678,ACTIVO,Juan,25.00,https://ejemplo.com/img.jpg
```

### Paso 4: Iniciar Envío
1. Revisar vista previa
2. Click en "Iniciar Envío"
3. Monitorear progreso
4. Exportar log al finalizar

---

## 🎨 Integración Visual

El módulo sigue la estética del sistema SestIA:
- ✅ CSS con namespace `#whatsapp-module`
- ✅ Variables CSS del tema principal
- ✅ Animaciones suaves y transiciones
- ✅ Diseño responsivo
- ✅ Tooltips informativos
- ✅ Modales accesibles

---

## 🔌 API Middleware

El módulo utiliza un middleware en Railway:
```
https://smart-whatsapp-api-fibex-production-d80a.up.railway.app/enviar-mensaje
```

**Request Format:**
```json
{
  "token": "EAAGl2ZBBtZABoBAPxxx...",
  "phone_id": "114235551234567",
  "numero": "584121234567",
  "template_name": "nombre_plantilla",
  "variables": ["valor1", "valor2"]
}
```

**Response Format:**
```json
{
  "status": "success",
  "id": "wamid.XXX...",
  "message": "Mensaje enviado"
}
```

---

## 📊 Flujo de Datos

```
1. Usuario selecciona canal
   ↓
2. Sistema consulta instancia_sofia.instancias_inputs
   ↓
3. Auto-completa credenciales (token, phone_id, idWaba)
   ↓
4. Consulta plantillas desde Meta API
   ↓
5. Usuario carga CSV
   ↓
6. Sistema valida formato y columnas
   ↓
7. Usuario inicia envío
   ↓
8. Para cada fila:
   - Inserta registro en leads_activos
   - Envía mensaje vía API
   - Actualiza metadata con resultado
   - Registra en logs
   ↓
9. Muestra estadísticas finales
```

---

## ⚠️ Consideraciones Importantes

### 1. Límites de WhatsApp Business
- Delay mínimo de 2 segundos entre mensajes
- Las plantillas deben estar APROBADAS en Meta
- Los números deben tener WhatsApp activo

### 2. Seguridad
- Las credenciales se cargan dinámicamente (no hardcodeadas)
- Los tokens no se muestran en la interfaz
- La configuración se guarda solo en localStorage del cliente

### 3. Validaciones
- Columnas obligatorias: numero, cedula, estatus_servicio
- estatus_servicio solo acepta: activo, cortado, suspendido
- Los números se normalizan (solo dígitos)

### 4. Registro de Leads
- Cada envío crea un registro en leads_activos
- El metadata incluye control de envío:
  - `envio_exitoso`: boolean
  - `envio_intentos`: number
  - `envio_wamid`: string (ID del mensaje)
  - `envio_error`: string (mensaje de error si falla)
  - `envio_fecha`: timestamp ISO

---

## 🧪 Testing

### Verificar Instalación
```sql
-- 1. Verificar permisos
SELECT * FROM permissions WHERE module = 'whatsapp';

-- 2. Verificar canales configurados
SELECT * FROM instancia_sofia.instancias_inputs WHERE canal = 14;

-- 3. Verificar registro en manifest
-- Abrir: WEB/modules/manifest.json
-- Buscar: "key": "whatsapp"
```

### Probar Funcionalidad
1. ✅ Acceder al módulo (verificar que aparece en menú)
2. ✅ Cargar canales (verificar que el selector se llena)
3. ✅ Consultar plantillas (verificar que se cargan desde Meta)
4. ✅ Cargar CSV de ejemplo (usar ejemplo.csv)
5. ✅ Hacer envío de prueba (1-2 números)
6. ✅ Verificar registro en leads_activos

---

## 🚀 Próximos Pasos

### Configuración Inicial
1. ✅ Ejecutar `setup.sql` en Supabase
2. ✅ Configurar al menos un canal de WhatsApp
3. ✅ Crear plantillas en Meta Business Manager
4. ✅ Asignar permisos a usuarios según roles
5. ✅ Realizar envío de prueba

### Personalización (Opcional)
- Modificar URL de API si usas tu propio middleware
- Ajustar delay entre mensajes según necesidades
- Personalizar estados de canal según tu flujo
- Agregar campos personalizados al CSV

---

## 📚 Documentación Adicional

### Archivos de Referencia
- `WEB/modules/whatsapp/README.md` - Documentación completa del módulo
- `WEB/modules/whatsapp/setup.sql` - Script de configuración SQL
- Carpeta original `whatsapp/` - Documentación de desarrollo:
  - `CONFIG_CANALES.md` - Guía de configuración de canales
  - `SETUP_SQL.md` - Instrucciones SQL detalladas
  - `README.md` - Documentación original

### Enlaces Útiles
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Meta Business Manager](https://business.facebook.com/)
- [Crear Plantillas](https://business.facebook.com/wa/manage/message-templates/)

---

## ✅ Checklist de Integración

- [x] Crear carpeta módulo en `WEB/modules/whatsapp/`
- [x] Copiar archivos (init.js, view.html, styles.css)
- [x] Actualizar `manifest.json` con registro del módulo
- [x] Crear script SQL de configuración
- [x] Crear documentación completa (README.md)
- [x] Crear este documento de integración
- [ ] Ejecutar `setup.sql` en Supabase
- [ ] Configurar al menos un canal de WhatsApp
- [ ] Asignar permisos a usuarios
- [ ] Realizar envío de prueba

---

## 🤝 Soporte y Troubleshooting

### Problemas Comunes

**1. No aparece el módulo en el menú**
- Verifica que el usuario tenga el permiso `modules.whatsapp.view`
- Verifica que el módulo esté en `manifest.json`
- Refres ca la aplicación (Ctrl+F5)

**2. No se cargan los canales**
- Verifica que existan registros con `canal = 14`
- Verifica que el estado sea `live` o `test`
- Revisa la consola del navegador

**3. No se cargan las plantillas**
- Verifica que el campo `key` tenga los 3 valores
- Verifica que el token sea válido
- Verifica que existan plantillas aprobadas en Meta

**4. Error al enviar mensajes**
- Verifica que los números tengan WhatsApp
- Verifica que la plantilla esté APROBADA
- Revisa los logs de error en el panel

### Logs de Debug

**Consola del navegador:**
```javascript
// Verificar estado del módulo
window.WhatsAppModule

// Ver configuración actual
localStorage.getItem('wsp_config')
```

**SQL para verificar leads:**
```sql
SELECT * FROM instancia_sofia.leads_activos 
WHERE titulo_anuncio = 'tu_titulo_de_campaña'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 Changelog de Integración

### v1.0.0 - Enero 6, 2026
- ✅ Integración inicial del módulo WhatsApp Masivo
- ✅ Creación de estructura de archivos
- ✅ Configuración de permisos en base de datos
- ✅ Registro en manifest.json
- ✅ Documentación completa
- ✅ Archivos de ejemplo (CSV)
- ✅ Script SQL de setup

---

**Módulo integrado por:** GitHub Copilot  
**Fecha:** Enero 6, 2026  
**Estado:** ✅ Completado - Listo para configuración y uso
