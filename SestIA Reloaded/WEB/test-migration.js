/**
 * ════════════════════════════════════════════════════════════════════════════
 * SCRIPT DE PRUEBA - Nueva Estructura de Base de Datos
 * ════════════════════════════════════════════════════════════════════════════
 * Ejecutar en la consola del navegador para verificar la migración
 */

async function testDatabaseMigration() {
  console.log('🧪 Iniciando pruebas de migración...\n');
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  // Test 1: Verificar que el helper está disponible
  console.log('Test 1: Verificar helper ConversationQueries...');
  if (window.ConversationQueries) {
    console.log('✅ Helper disponible');
    results.passed.push('Helper ConversationQueries disponible');
  } else {
    console.error('❌ Helper no encontrado');
    results.failed.push('Helper ConversationQueries no disponible');
    return results;
  }
  
  // Test 2: Verificar Supabase
  console.log('\nTest 2: Verificar cliente Supabase...');
  if (window.App && window.App.supabase) {
    console.log('✅ Supabase disponible');
    results.passed.push('Cliente Supabase disponible');
  } else {
    console.error('❌ Supabase no disponible');
    results.failed.push('Cliente Supabase no disponible');
    return results;
  }
  
  try {
    // Test 3: Obtener conversaciones recientes
    console.log('\nTest 3: Obtener conversaciones recientes...');
    const recent = await ConversationQueries.getRecentConversations(5);
    console.log(`✅ ${recent.length} conversaciones obtenidas`);
    console.table(recent.map(c => ({
      chat_id: c.chat_id,
      title: c.title.substring(0, 30) + '...',
      updated_at: new Date(c.updated_at).toLocaleString()
    })));
    results.passed.push(`${recent.length} conversaciones recientes obtenidas`);
    
    if (recent.length === 0) {
      results.warnings.push('No hay conversaciones en la base de datos');
      console.log('\n⚠️ Fin de pruebas: No hay conversaciones para continuar\n');
      return results;
    }
    
    // Test 4: Obtener conversación con mensajes
    console.log('\nTest 4: Obtener conversación con mensajes...');
    const testChatId = recent[0].chat_id;
    const { conversation, messages } = await ConversationQueries
      .getConversationWithMessages(testChatId);
    
    console.log(`✅ Conversación obtenida: "${conversation.title}"`);
    console.log(`✅ ${messages.length} mensajes obtenidos`);
    results.passed.push(`Conversación con ${messages.length} mensajes`);
    
    // Mostrar distribución de roles
    const roleCount = messages.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});
    console.log('   Distribución de roles:', roleCount);
    
    // Test 5: Obtener resumen de conversación
    console.log('\nTest 5: Obtener resumen (vista agregada)...');
    const summary = await ConversationQueries.getConversationSummary(testChatId);
    console.log('✅ Resumen obtenido:');
    console.log('   • Total mensajes:', summary.total_messages);
    console.log('   • Total tokens:', summary.total_tokens);
    console.log('   • Último mensaje:', new Date(summary.last_message_at).toLocaleString());
    results.passed.push('Vista de resumen funciona correctamente');
    
    // Test 6: Verificar metadata
    console.log('\nTest 6: Verificar metadata de conversación...');
    if (conversation.metadata) {
      console.log('✅ Metadata presente:');
      console.log('   • Canal:', conversation.metadata.user_channel);
      console.log('   • Total mensajes en migración:', conversation.metadata.total_messages_at_migration);
      console.log('   • Migrado en:', new Date(conversation.metadata.migrated_at).toLocaleString());
      results.passed.push('Metadata correctamente poblada');
    } else {
      console.warn('⚠️ Sin metadata');
      results.warnings.push('Conversación sin metadata');
    }
    
    // Test 7: Buscar mensajes
    console.log('\nTest 7: Buscar mensajes por contenido...');
    const searchResults = await ConversationQueries.searchMessages('hola', 5);
    console.log(`✅ ${searchResults.length} resultados de búsqueda`);
    results.passed.push(`Búsqueda funciona (${searchResults.length} resultados)`);
    
    // Test 8: Verificar estadísticas por fecha
    console.log('\nTest 8: Estadísticas por rango de fechas...');
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const stats = await ConversationQueries.getConversationStats(
      weekAgo.toISOString(),
      now.toISOString()
    );
    console.log('✅ Estadísticas obtenidas:');
    console.log('   • Conversaciones (última semana):', stats.total_conversations);
    console.log('   • Mensajes totales:', stats.total_messages);
    console.log('   • Tokens consumidos:', stats.total_tokens);
    console.log('   • Promedio mensajes/conv:', stats.avg_messages_per_conversation);
    results.passed.push('Estadísticas por fecha funcionan');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    results.failed.push(`Error: ${error.message}`);
  }
  
  // Resumen final
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  RESUMEN DE PRUEBAS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`✅ Pruebas exitosas: ${results.passed.length}`);
  console.log(`❌ Pruebas fallidas: ${results.failed.length}`);
  console.log(`⚠️  Advertencias: ${results.warnings.length}`);
  console.log('════════════════════════════════════════════════════════════════\n');
  
  if (results.failed.length === 0) {
    console.log('🎉 ¡Todas las pruebas pasaron exitosamente!');
    console.log('   La migración está completa y funcionando correctamente.\n');
  } else {
    console.warn('⚠️ Algunas pruebas fallaron. Revisar los errores arriba.\n');
  }
  
  return results;
}

// Ejecutar automáticamente si se desea
// testDatabaseMigration();

console.log('📝 Script de prueba cargado.');
console.log('   Ejecutar: testDatabaseMigration()');
console.log('   Para ver resultados detallados.\n');
