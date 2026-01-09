/**
 * Script de Configuración Automática del Módulo WhatsApp
 * 
 * Este script te guía paso a paso para configurar tu primer canal de WhatsApp.
 * Ejecuta este archivo en la consola del navegador cuando estés en la aplicación SestIA.
 */

(async function setupWhatsAppModule() {
  console.log('🚀 Iniciando configuración del Módulo WhatsApp...\n');

  // Verificar que tenemos acceso a Supabase
  if (!window.App || !window.App.supabase) {
    console.error('❌ Error: Cliente de Supabase no disponible');
    console.log('Por favor, inicia sesión en la aplicación primero.');
    return;
  }

  const supabase = window.App.supabase;
  console.log('✅ Cliente de Supabase conectado\n');

  // Paso 1: Verificar permisos
  console.log('📋 Paso 1: Verificando permisos...');
  try {
    const { data: perms, error: permError } = await supabase
      .from('permissions')
      .select('*')
      .eq('module', 'whatsapp');

    if (permError) throw permError;

    if (perms && perms.length > 0) {
      console.log('✅ Permisos encontrados:', perms.length);
      perms.forEach(p => console.log(`   - ${p.perm_key}: ${p.name}`));
    } else {
      console.log('⚠️ No se encontraron permisos. Creándolos...');
      
      // Crear permisos
      const { error: createError } = await supabase
        .from('permissions')
        .insert([
          {
            perm_key: 'modules.whatsapp.view',
            name: 'Ver WhatsApp Masivo',
            description: 'Acceso al módulo de envío masivo de WhatsApp',
            module: 'whatsapp'
          },
          {
            perm_key: 'modules.whatsapp.send',
            name: 'Enviar WhatsApp Masivo',
            description: 'Permiso para realizar envíos masivos',
            module: 'whatsapp'
          }
        ]);

      if (createError) throw createError;
      console.log('✅ Permisos creados correctamente');
    }
  } catch (error) {
    console.error('❌ Error verificando permisos:', error.message);
  }

  // Paso 2: Asignar permisos a roles
  console.log('\n📋 Paso 2: Asignando permisos a roles...');
  try {
    const rolesToAssign = ['admin', 'superadmin'];
    const permsToAssign = ['modules.whatsapp.view', 'modules.whatsapp.send'];

    for (const role of rolesToAssign) {
      for (const perm of permsToAssign) {
        const { error } = await supabase
          .from('role_permissions')
          .upsert({ role_key: role, perm_key: perm }, { onConflict: 'role_key,perm_key' });
        
        if (error && error.code !== '23505') { // Ignorar duplicados
          console.warn(`⚠️ Error asignando ${perm} a ${role}:`, error.message);
        }
      }
    }
    console.log('✅ Permisos asignados a admin y superadmin');
  } catch (error) {
    console.error('❌ Error asignando permisos:', error.message);
  }

  // Paso 3: Verificar canal ID 14
  console.log('\n📋 Paso 3: Verificando canal de WhatsApp Business...');
  try {
    const { data: channel, error: channelError } = await (supabase.schema 
      ? supabase.schema('instancia_sofia') 
      : supabase)
      .from('input_channels')
      .select('*')
      .eq('id', 14)
      .single();

    if (channelError && channelError.code !== 'PGRST116') {
      console.warn('⚠️ Error verificando canal:', channelError.message);
    } else if (channel) {
      console.log('✅ Canal WhatsApp Business (ID: 14) encontrado:', channel.name || 'WhatsApp');
    } else {
      console.log('⚠️ Canal ID 14 no encontrado. Esto es normal si tu estructura es diferente.');
    }
  } catch (error) {
    console.log('⚠️ No se pudo verificar el canal:', error.message);
  }

  // Paso 4: Listar canales existentes
  console.log('\n📋 Paso 4: Verificando canales de WhatsApp configurados...');
  try {
    const { data: existing, error: existError } = await (supabase.schema 
      ? supabase.schema('instancia_sofia') 
      : supabase)
      .from('instancias_inputs')
      .select('*')
      .eq('canal', 14);

    if (existError) {
      console.warn('⚠️ Error consultando canales:', existError.message);
    } else if (existing && existing.length > 0) {
      console.log(`✅ Encontrados ${existing.length} canal(es) configurado(s):`);
      existing.forEach(c => {
        console.log(`   - ${c.custom_name} (${c.nameid})`);
        console.log(`     Estado: ${c.state || 'N/A'}`);
      });
      console.log('\n✅ ¡Ya tienes canales configurados! El módulo está listo para usar.');
    } else {
      console.log('⚠️ No hay canales de WhatsApp configurados aún.');
      console.log('\n📝 Para configurar un canal, necesitas:');
      console.log('   1. Token Permanente de Meta Business Manager');
      console.log('   2. Phone ID de tu número de WhatsApp Business');
      console.log('   3. WABA ID (WhatsApp Business Account ID)');
      console.log('\n💡 Ejecuta la función configurarCanal() con tus credenciales:');
      console.log('\nEjemplo:');
      console.log(`configurarCanal({
  nombre: 'WhatsApp Principal',
  token: 'EAAGl2ZBBtZABoBAPxxx...',
  phoneId: '114235551234567',
  wabaId: '987654321098765'
});`);
    }
  } catch (error) {
    console.error('❌ Error listando canales:', error.message);
  }

  // Función auxiliar para configurar un canal
  window.configurarCanal = async function(config) {
    console.log('\n🔧 Configurando nuevo canal de WhatsApp...');
    
    if (!config.nombre || !config.token || !config.phoneId || !config.wabaId) {
      console.error('❌ Error: Faltan parámetros requeridos');
      console.log('Uso: configurarCanal({ nombre, token, phoneId, wabaId })');
      return;
    }

    const nameid = config.nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const key = `${config.token}, ${config.phoneId}, ${config.wabaId}`;

    try {
      const { data, error } = await (supabase.schema 
        ? supabase.schema('instancia_sofia') 
        : supabase)
        .from('instancias_inputs')
        .insert({
          canal: 14,
          key: key,
          nameid: nameid,
          custom_name: config.nombre,
          state: 'live',
          output_options: {
            text: true,
            photo: true,
            video: false,
            gallery: false,
            sticker: false,
            document: true,
            location: false
          }
        })
        .select();

      if (error) throw error;

      console.log('✅ Canal configurado exitosamente:');
      console.log(`   Nombre: ${config.nombre}`);
      console.log(`   ID: ${nameid}`);
      console.log(`   Estado: live`);
      console.log('\n🎉 ¡El canal está listo! Recarga el módulo WhatsApp para verlo.');
      
      return data;
    } catch (error) {
      console.error('❌ Error configurando canal:', error.message);
      if (error.code === '23505') {
        console.log('💡 Este canal ya existe. Usa un nombre diferente.');
      }
    }
  };

  console.log('\n✅ Configuración inicial completada!');
  console.log('\n📚 Comandos disponibles:');
  console.log('   configurarCanal(config) - Agregar un nuevo canal de WhatsApp');
  console.log('\n📖 Para más información, consulta: WEB/modules/whatsapp/README.md');
})();
