# Guía de Desarrollo de Módulos Personalizados

Este directorio contiene la estructura base para crear nuevos módulos en la aplicación Sofia.

## Estructura de Archivos

Cada módulo debe residir en su propia carpeta dentro de `WEB/modules/` y contener al menos:

- `init.js`: Lógica principal del módulo (controlador).
- `view.html`: Estructura HTML del módulo (vista).
- `styles.css`: Estilos específicos del módulo.

## ⚠️ IMPORTANTE: Estándares CSS para Evitar Colisiones

**Problema:** Los estilos CSS de los módulos pueden chocar entre sí y con la página principal, causando problemas visuales.

**Solución:** Todos los módulos DEBEN seguir el estándar de **CSS con namespace**.

### Reglas Obligatorias:

1. **Contenedor con ID único en `view.html`:**
   ```html
   <div id="mi-modulo-module">
     <!-- Todo el contenido del módulo -->
   </div>
   ```

2. **Todos los selectores CSS deben usar el namespace:**
   ```css
   /* ✅ CORRECTO */
   #mi-modulo-module .btn {
     background: blue;
   }

   /* ❌ INCORRECTO */
   .btn {
     background: blue;
   }
   ```

3. **Variables globales disponibles:**
   Puedes usar las variables CSS globales sin conflicto:
   - `var(--panel)`, `var(--border)`, `var(--text)`, `var(--brand)`, etc.

**📖 Documentación completa:** Lee [WEB/modules/CSS-STANDARDS.md](../CSS-STANDARDS.md) antes de comenzar tu módulo.

## Pasos para Crear un Nuevo Módulo

### 1. Crear la Carpeta del Módulo
Copia esta carpeta `template` y renómbrala con el nombre de tu módulo (ej. `mi_modulo`).

### 2. Registrar el Módulo
Edita el archivo `WEB/modules/manifest.json` y agrega tu módulo a la lista:

```json
{
    "key": "mi_modulo",
    "moduleName": "MiModulo",
    "script": "modules/mi_modulo/init.js",
    "view": "modules/mi_modulo/view.html",
    "perms": ["modules.mi_modulo.view"]
}
```

### 3. Base de Datos (SQL)
Si tu módulo requiere tablas personalizadas, estas deben ir en el esquema `modules`.

Agrega las definiciones de tabla y permisos en `SUPABASE/sql definitivo.sql` (o ejecuta en SQL Editor):

```sql
-- 1. Crear tabla en esquema modules
CREATE TABLE IF NOT EXISTS modules.mi_tabla (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- tus campos aquí
    nombre TEXT,
    user_id UUID REFERENCES auth.users(id)
);

-- 2. Habilitar RLS
ALTER TABLE modules.mi_tabla ENABLE ROW LEVEL SECURITY;

-- 3. Crear Permisos (en tabla permissions)
INSERT INTO permissions (perm_key, name, description, module) VALUES 
('modules.mi_modulo.view', 'Ver Mi Módulo', 'Acceso de lectura a mi módulo', 'mi_modulo'),
('modules.mi_modulo.manage', 'Gestionar Mi Módulo', 'Acceso de escritura a mi módulo', 'mi_modulo')
ON CONFLICT (perm_key) DO NOTHING;

-- 4. Asignar Permisos a Roles (opcional, por defecto admin/superadmin)
INSERT INTO role_permissions (role_key, perm_key) VALUES 
('admin', 'modules.mi_modulo.view'),
('admin', 'modules.mi_modulo.manage')
ON CONFLICT (role_key, perm_key) DO NOTHING;

-- 5. Crear Políticas de Seguridad (RLS)
-- Lectura
CREATE POLICY "Usuarios con permiso view pueden ver" ON modules.mi_tabla
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('modules.mi_modulo.view'));

-- Escritura
CREATE POLICY "Usuarios con permiso manage pueden editar" ON modules.mi_tabla
    FOR ALL TO authenticated
    USING (public.current_user_has_permission('modules.mi_modulo.manage'))
    WITH CHECK (public.current_user_has_permission('modules.mi_modulo.manage'));
```

### 4. Desarrollo Frontend (`init.js`)
Usa el patrón de verificación de permisos al inicio de tu `init()`:

```javascript
async function init() {
    // Verificar permisos
    const hasView = window.App?.hasPerm && window.App.hasPerm('modules.mi_modulo.view');
    if (!hasView) {
        const root = document.getElementById('mi-modulo-container');
        if (root) {
            root.innerHTML = `
                <div class="state-message">
                    <div class="empty-icon">🔒</div>
                    <h3>Acceso Denegado</h3>
                    <p>No tienes permisos para ver este módulo.</p>
                </div>
            `;
        }
        return;
    }
    
    // Tu lógica de carga...
}
```
