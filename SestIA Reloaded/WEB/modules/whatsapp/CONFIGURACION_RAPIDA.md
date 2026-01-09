# Configuración Rápida del Módulo WhatsApp

## 🚀 Método 1: Script de Configuración Automática (Recomendado)

### Paso 1: Abrir la Aplicación
1. Abre SestIA en tu navegador
2. Inicia sesión con un usuario admin o superadmin

### Paso 2: Ejecutar el Script
1. Abre la Consola del Desarrollador (F12)
2. Copia y pega el contenido de `configurar.js` en la consola
3. Presiona Enter

El script automáticamente:
- ✅ Verifica y crea los permisos necesarios
- ✅ Asigna permisos a roles admin y superadmin
- ✅ Verifica la configuración existente
- ✅ Te proporciona una función para agregar canales

### Paso 3: Configurar tu Primer Canal

Una vez ejecutado el script, usa esta función en la consola:

```javascript
configurarCanal({
  nombre: 'WhatsApp Principal',
  token: 'TU_TOKEN_AQUI',
  phoneId: 'TU_PHONE_ID_AQUI',
  wabaId: 'TU_WABA_ID_AQUI'
});
```

**Ejemplo real:**
```javascript
configurarCanal({
  nombre: 'Fibex WhatsApp Ventas',
  token: 'EAAGl2ZBBtZABoBAPxxx...',
  phoneId: '114235551234567',
  wabaId: '987654321098765'
});
```

---

## 📋 Método 2: Configuración Manual en Supabase

Si prefieres hacerlo directamente en Supabase:

### 1. Crear Permisos

```sql
INSERT INTO permissions (perm_key, name, description, module) VALUES 
('modules.whatsapp.view', 'Ver WhatsApp Masivo', 'Acceso al módulo de envío masivo de WhatsApp', 'whatsapp'),
('modules.whatsapp.send', 'Enviar WhatsApp Masivo', 'Permiso para realizar envíos masivos', 'whatsapp')
ON CONFLICT (perm_key) DO NOTHING;
```

### 2. Asignar Permisos a Roles

```sql
INSERT INTO role_permissions (role_key, perm_key) VALUES 
('admin', 'modules.whatsapp.view'),
('admin', 'modules.whatsapp.send'),
('superadmin', 'modules.whatsapp.view'),
('superadmin', 'modules.whatsapp.send')
ON CONFLICT (role_key, perm_key) DO NOTHING;
```

### 3. Configurar Canal de WhatsApp

```sql
INSERT INTO instancia_sofia.instancias_inputs (
  canal,
  key,
  nameid,
  custom_name,
  state,
  output_options
) VALUES (
  14,
  'TU_TOKEN, TU_PHONE_ID, TU_WABA_ID',
  'whatsapp_principal',
  'WhatsApp Principal',
  'live',
  '{"text": true, "photo": true, "video": false, "gallery": false, "sticker": false, "document": true, "location": false}'::jsonb
);
```

---

## 🔑 Cómo Obtener las Credenciales

### Token Permanente (Meta Business Manager)

1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. Configuración → System Users
3. Selecciona o crea un System User
4. Click en "Generate New Token"
5. Selecciona tu app de WhatsApp
6. Permisos necesarios:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
7. **Importante:** Selecciona "Never expires"
8. Copia el token generado

### Phone ID

1. En Meta Business Manager
2. Ve a WhatsApp → API Setup
3. Selecciona tu número de teléfono
4. Copia el "Phone number ID"

### WABA ID (WhatsApp Business Account ID)

1. En Meta Business Manager
2. Ve a WhatsApp → Información de la cuenta
3. Copia el "WhatsApp Business Account ID"

**O desde la URL:**
```
https://business.facebook.com/wa/manage/phone-numbers/?business_id=XXX&waba_id=123456789
                                                                         ↑
                                                                    Este es tu WABA ID
```

---

## ✅ Verificación

### Desde la Consola del Navegador

```javascript
// Ver canales configurados
const { data } = await window.App.supabase
  .schema('instancia_sofia')
  .from('instancias_inputs')
  .select('*')
  .eq('canal', 14);
console.table(data);
```

### Desde Supabase SQL Editor

```sql
-- Ver canales configurados
SELECT 
  id,
  custom_name,
  nameid,
  state,
  created_at
FROM instancia_sofia.instancias_inputs
WHERE canal = 14;

-- Ver permisos
SELECT * FROM permissions WHERE module = 'whatsapp';

-- Ver asignación de permisos
SELECT rp.*, p.name 
FROM role_permissions rp
JOIN permissions p ON rp.perm_key = p.perm_key
WHERE p.module = 'whatsapp';
```

---

## 🎯 Probar el Módulo

1. Recarga la aplicación (F5)
2. Ve a **Módulos** → **WhatsApp Masivo**
3. Deberías ver tu canal en el selector
4. Carga el archivo `ejemplo.csv`
5. Haz un envío de prueba con 1-2 números

---

## 🆘 Solución de Problemas

### "No aparece el módulo en el menú"
- Verifica que tu usuario tenga el permiso `modules.whatsapp.view`
- Refresca la aplicación con Ctrl+F5

### "No se cargan los canales"
- Verifica que el canal tenga estado `live` o `test`
- Verifica que `canal = 14`
- Revisa la consola del navegador (F12)

### "No se cargan las plantillas"
- Verifica que el formato del campo `key` sea correcto: `token, phone_id, waba_id`
- Verifica que el token sea válido
- Verifica que tengas plantillas activas en Meta

---

## 📞 Múltiples Canales

Para agregar más canales, simplemente ejecuta `configurarCanal()` con diferentes datos:

```javascript
// Canal 1: Ventas
configurarCanal({
  nombre: 'WhatsApp Ventas',
  token: 'TOKEN1...',
  phoneId: 'PHONE1',
  wabaId: 'WABA1'
});

// Canal 2: Soporte
configurarCanal({
  nombre: 'WhatsApp Soporte',
  token: 'TOKEN2...',
  phoneId: 'PHONE2',
  wabaId: 'WABA2'
});
```

---

## 📚 Recursos Adicionales

- [README.md](./README.md) - Documentación completa
- [INTEGRACION.md](./INTEGRACION.md) - Guía de integración
- [setup.sql](./setup.sql) - Scripts SQL completos
- [ejemplo.csv](./ejemplo.csv) - Archivo CSV de ejemplo

---

**¿Necesitas ayuda?** Revisa la consola del navegador (F12) para ver mensajes de error detallados.
