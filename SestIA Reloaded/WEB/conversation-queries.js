/**
 * ════════════════════════════════════════════════════════════════════════════
 * SUPABASE QUERIES HELPER - Nueva Estructura Normalizada
 * ════════════════════════════════════════════════════════════════════════════
 * Helper para trabajar con las tablas normalizadas de conversaciones y mensajes
 * 
 * Tablas:
 * - kpidata.conversations: Conversaciones/chats únicos
 * - kpidata.messages: Mensajes individuales dentro de cada conversación
 * 
 * Fecha: 2025-12-29
 * ════════════════════════════════════════════════════════════════════════════
 */

const ConversationQueries = {
  
  /**
   * Obtener una conversación con todos sus mensajes
   * @param {string} chatId - ID de la conversación
   * @returns {Promise<{conversation: Object, messages: Array}>}
   */
  async getConversationWithMessages(chatId) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const [convRes, msgsRes] = await Promise.all([
      supabase
        .schema('kpidata')
        .from('conversations')
        .select('*')
        .eq('chat_id', chatId)
        .single(),
      
      supabase
        .schema('kpidata')
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
    ]);
    
    if (convRes.error) throw convRes.error;
    if (msgsRes.error) throw msgsRes.error;
    
    return {
      conversation: convRes.data,
      messages: msgsRes.data || []
    };
  },
  
  /**
   * Obtener conversaciones recientes
   * @param {number} limit - Cantidad de conversaciones a obtener
   * @returns {Promise<Array>}
   */
  async getRecentConversations(limit = 10) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('conversations')
      .select('chat_id, title, created_at, updated_at, metadata')
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },
  
  /**
   * Obtener resumen de conversación usando la vista
   * @param {string} chatId - ID de la conversación
   * @returns {Promise<Object>}
   */
  async getConversationSummary(chatId) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('v_conversations_summary')
      .select('*')
      .eq('chat_id', chatId)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Buscar conversaciones por canal
   * @param {string} channel - Canal (ej: 'Whatsapp_Chatwoot')
   * @returns {Promise<Array>}
   */
  async getConversationsByChannel(channel) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('conversations')
      .select('*')
      .filter('metadata->user_channel', 'eq', channel)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },
  
  /**
   * Obtener estadísticas de conversaciones en un rango de fechas
   * @param {string} fromDate - Fecha inicio (ISO)
   * @param {string} toDate - Fecha fin (ISO)
   * @returns {Promise<Object>}
   */
  async getConversationStats(fromDate, toDate) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('v_conversations_summary')
      .select('*')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);
    
    if (error) throw error;
    
    const conversations = data || [];
    
    return {
      total_conversations: conversations.length,
      total_messages: conversations.reduce((sum, c) => sum + (c.total_messages || 0), 0),
      total_tokens: conversations.reduce((sum, c) => sum + (c.total_tokens || 0), 0),
      avg_messages_per_conversation: conversations.length > 0 
        ? Math.round(conversations.reduce((sum, c) => sum + (c.total_messages || 0), 0) / conversations.length)
        : 0
    };
  },
  
  /**
   * Crear nueva conversación
   * @param {Object} conversationData - Datos de la conversación
   * @returns {Promise<Object>}
   */
  async createConversation(conversationData) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('conversations')
      .insert({
        chat_id: conversationData.chat_id,
        title: conversationData.title || 'Nueva conversación',
        metadata: conversationData.metadata || {}
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Agregar mensaje a una conversación
   * @param {Object} messageData - Datos del mensaje
   * @returns {Promise<Object>}
   */
  async addMessage(messageData) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('messages')
      .insert({
        chat_id: messageData.chat_id,
        role: messageData.role, // 'user', 'assistant', 'system'
        content: messageData.content,
        message_type: messageData.message_type || 'text',
        user_id: messageData.user_id,
        tokens: messageData.tokens || 0,
        input_tokens: messageData.input_tokens,
        output_tokens: messageData.output_tokens
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Buscar mensajes por contenido
   * @param {string} searchTerm - Término de búsqueda
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>}
   */
  async searchMessages(searchTerm, limit = 50) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('messages')
      .select('*, conversations!inner(chat_id, title)')
      .ilike('content', `%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },
  
  /**
   * Obtener mensajes por usuario
   * @param {string} userId - ID del usuario
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>}
   */
  async getMessagesByUser(userId, limit = 100) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },
  
  /**
   * Actualizar metadata de conversación
   * @param {string} chatId - ID de la conversación
   * @param {Object} metadata - Nuevos datos de metadata (se mezclan con los existentes)
   * @returns {Promise<Object>}
   */
  async updateConversationMetadata(chatId, metadata) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    // Obtener metadata actual
    const { data: current } = await supabase
      .schema('kpidata')
      .from('conversations')
      .select('metadata')
      .eq('chat_id', chatId)
      .single();
    
    // Mezclar metadata
    const newMetadata = { ...(current?.metadata || {}), ...metadata };
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('conversations')
      .update({ metadata: newMetadata })
      .eq('chat_id', chatId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Asignar conversación a usuario
   * @param {string} chatId - ID de la conversación
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Object>}
   */
  async assignConversation(chatId, userId) {
    const { supabase } = window.App;
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { data, error } = await supabase
      .schema('kpidata')
      .from('conversations')
      .update({ user_assign: userId })
      .eq('chat_id', chatId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Exportar como global
window.ConversationQueries = ConversationQueries;
