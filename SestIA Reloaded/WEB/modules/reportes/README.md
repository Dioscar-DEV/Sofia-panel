# Módulo de Reportes - Sofia

Sistema simplificado de tickets y reportes adaptado para la infraestructura de Sofia.

## ✅ Instalación Completada

El módulo de reportes ha sido completamente integrado en Sofia:

### Migraciones Aplicadas
- ✅ Tabla `reportes` creada con índices y triggers
- ✅ Políticas RLS configuradas
- ✅ Funciones RPC creadas
- ✅ Permisos insertados y asignados al rol admin
- ✅ Módulo registrado en manifest.json

### Características Implementadas
- Gestión de reportes/tickets con estados y prioridades
- Filtrado avanzado (búsqueda, categorías, fechas)
- Sistema de permisos completo
- Historial de cambios
- Soporte para evidencias
- Integración con Livechat
- Paginación eficiente

## Uso Rápido

### Para Usuarios
1. Recarga la aplicación
2. El módulo "Reportes" aparecerá en el menú dropdown
3. Los usuarios con permiso `reportes.view` podrán acceder

### Para Administradores
Asignar permisos en el módulo de usuarios:
- `reportes.view` - Ver reportes
- `reportes.create` - Crear reportes
- `reportes.manage` - Gestionar reportes
- `reportes.export` - Exportar a CSV
- `reportes.delete` - Eliminar reportes

### Crear Reporte de Prueba (SQL)

```sql
INSERT INTO public.reportes (titulo, descripcion, categoria, prioridad, estado, reportante_nombre, reportante_email)
VALUES ('Reporte de Prueba', 'Este es un reporte de prueba', 'Soporte', 'media', 'pendiente', 'Usuario Test', 'test@example.com');
```

## Seguridad

✅ Row Level Security (RLS) activo
✅ Los usuarios solo ven sus reportes o aquellos a los que tienen permiso
✅ Funciones RPC protegidas con SECURITY DEFINER

## Notas

- El módulo NO rompe funcionalidades existentes de Sofia
- Usa la configuración de Supabase existente
- Compatible con el sistema de permisos actual
- Responsive y adaptado al theme de Sofia

## Estructura de Archivos

```
modules/reportes/
├── init.js       # Lógica del módulo (simplificado para Sofia)
├── view.html     # Vista HTML del módulo
├── styles.css    # Estilos del módulo
├── setup.sql     # Script SQL completo de instalación
└── README.md     # Esta documentación
```

¡El módulo está listo para usarse! 🎉


