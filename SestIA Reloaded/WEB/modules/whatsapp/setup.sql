-- =====================================================
-- SETUP SQL PARA MÓDULO WHATSAPP - SestIA
-- =====================================================
-- Este archivo configura los permisos y canales necesarios
-- para el módulo de WhatsApp Masivo en SestIA Reloaded
-- =====================================================

-- ==================== PERMISOS ====================

-- 1. Crear permisos para el módulo WhatsApp
INSERT INTO permissions (perm_key, name, description, module) VALUES 
('modules.whatsapp.view', 'Ver WhatsApp Masivo', 'Acceso al módulo de envío masivo de WhatsApp', 'whatsapp'),
('modules.whatsapp.send', 'Enviar WhatsApp Masivo', 'Permiso para realizar envíos masivos', 'whatsapp')
ON CONFLICT (perm_key) DO NOTHING;

-- 2. Asignar permisos al rol admin
INSERT INTO role_permissions (role_key, perm_key) VALUES 
('admin', 'modules.whatsapp.view'),
('admin', 'modules.whatsapp.send')
ON CONFLICT (role_key, perm_key) DO NOTHING;

-- 3. Asignar permisos al rol superadmin
INSERT INTO role_permissions (role_key, perm_key) VALUES 
('superadmin', 'modules.whatsapp.view'),
('superadmin', 'modules.whatsapp.send')
ON CONFLICT (role_key, perm_key) DO NOTHING;

-- 4. Verificar que los permisos se crearon correctamente
SELECT * FROM permissions WHERE module = 'whatsapp';

-- 5. Verificar asignación a roles
SELECT rp.*, p.name 
FROM role_permissions rp
JOIN permissions p ON rp.perm_key = p.perm_key
WHERE p.module = 'whatsapp';

-- ==================== CANAL DE WHATSAPP ====================

-- Nota: El módulo requiere que exista un input_channel con ID = 14
-- para el tipo "WhatsApp Business". Verificar que este canal exista:

SELECT * FROM instancia_sofia.input_channels WHERE id = 14;

-- Si no existe, crear el canal (ajustar según tu estructura):
-- INSERT INTO instancia_sofia.input_channels (id, name, type) VALUES 
-- (14, 'WhatsApp Business', 'whatsapp') 
-- ON CONFLICT (id) DO NOTHING;

-- ==================== EJEMPLOS DE CONFIGURACIÓN DE CANALES ====================

-- Ejemplo 1: Configurar un buzón de WhatsApp Business
INSERT INTO instancia_sofia.instancias_inputs (
  canal,
  key,
  nameid,
  custom_name,
  output_options
) VALUES (
  14,
  'TU_TOKEN_AQUI, TU_PHONE_ID_AQUI, TU_WABA_ID_AQUI',  -- Reemplazar con credenciales reales
  'whatsapp_principal',
  'WhatsApp Principal',
  '{"text": true, "photo": true, "video": false, "gallery": false, "sticker": false, "document": true, "location": false}'::jsonb
) ON CONFLICT (nameid) DO NOTHING;

-- Ejemplo 2: Múltiples buzones
INSERT INTO instancia_sofia.instancias_inputs (
  canal,
  key,
  nameid,
  custom_name,
  output_options
) VALUES 
(14, 'TOKEN2, PHONE_ID2, WABA_ID2', 'whatsapp_ventas', 'WhatsApp Ventas', '{"text": true, "photo": true}'::jsonb),
(14, 'TOKEN3, PHONE_ID3, WABA_ID3', 'whatsapp_soporte', 'WhatsApp Soporte', '{"text": true, "photo": true}'::jsonb)
ON CONFLICT (nameid) DO NOTHING;

-- ==================== VERIFICACIÓN ====================

-- Listar todos los buzones de WhatsApp configurados
SELECT 
  id,
  canal,
  nameid,
  custom_name,
  created_at,
  state
FROM instancia_sofia.instancias_inputs
WHERE canal = 14
ORDER BY custom_name;

-- ==================== NOTAS IMPORTANTES ====================

/*
1. FORMATO DEL CAMPO 'key':
   Debe contener tres valores separados por comas:
   'token, phone_id, idWaba'
   
   Ejemplo:
   'EAAGl2ZBBtZABoBAPxxx..., 114235551234567, 987654321098765'

2. CREDENCIALES NECESARIAS:
   - Token Permanente: System User token de Meta Business Manager
   - Phone ID: ID del número de WhatsApp Business
   - WABA ID: ID de la cuenta de WhatsApp Business (para consultar plantillas)

3. ESTADOS DE CANAL:
   - 'live': Canal activo en producción (se muestra en el selector)
   - 'test': Canal en pruebas (se muestra en el selector)
   - 'off': Canal desactivado (NO aparece en el selector)

4. TABLA DE LEADS:
   El módulo registra automáticamente los leads enviados en la tabla:
   instancia_sofia.leads_activos
   
   Asegúrate de que esta tabla existe y tiene los campos:
   - user_id (texto): número de teléfono
   - nombre_cliente (texto): nombre del destinatario
   - canal (texto): identificador del canal
   - titulo_anuncio (texto): título de la campaña
   - estado (texto): 'pendiente', 'activo', etc.
   - metadata (jsonb): información adicional del envío
   - cedula (texto): cédula del cliente
   - estatus_servicio (texto): 'activo', 'cortado', 'suspendido'
   - saldo (texto): saldo del cliente

5. PERMISOS DE BASE DE DATOS:
   El usuario que ejecuta la aplicación debe tener permisos de:
   - SELECT en: instancia_sofia.instancias_inputs
   - INSERT/UPDATE en: instancia_sofia.leads_activos
*/
