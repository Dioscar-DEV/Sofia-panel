(function(){
  async function init(){
    const { supabase } = window.App;

    // ==================== ELEMENTOS DEL DOM ====================
    const clientesGrid = document.getElementById('clientes-grid');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    
    // KPIs
    const kpiTotal = document.getElementById('kpi-total');
    const kpiUrgent = document.getElementById('kpi-urgent');
    const kpiUnassigned = document.getElementById('kpi-unassigned');
    const kpiAngry = document.getElementById('kpi-angry');
    const kpiResolved = document.getElementById('kpi-resolved');
    
    // Filtros y búsqueda
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterSentimiento = document.getElementById('filter-sentimiento');
    const filterUrgencia = document.getElementById('filter-urgencia');
    const filterEstado = document.getElementById('filter-estado');
    const filterCanal = document.getElementById('filter-canal');
    const refreshBtn = document.getElementById('refresh-btn');
    const showLowPriorityToggle = document.getElementById('show-low-priority');
    
    // Modal de asignación
    const assignModal = document.getElementById('assign-modal');
    const assignModalClose = document.getElementById('assign-modal-close');
    const assignClientName = document.getElementById('assign-client-name');
    const assignClientSummary = document.getElementById('assign-client-summary');
    const assignClientSentiment = document.getElementById('assign-client-sentiment');
    const assignClientUrgency = document.getElementById('assign-client-urgency');
    const assignUserSelect = document.getElementById('assign-user-select');
    const assignNotes = document.getElementById('assign-notes');
    const confirmAssignBtn = document.getElementById('confirm-assign-btn');
    const cancelAssignBtn = document.getElementById('cancel-assign-btn');

    // ==================== ESTADO ====================
    let clientes = [];
    let filteredClientes = [];
    let currentClientToAssign = null;
    let isAdmin = false;
    let assignableUsers = [];
    let showLowPriority = false; // Control para mostrar/ocultar casos de baja prioridad

    // ==================== FUNCIONES AUXILIARES ====================
    
    function formatDate(isoString) {
      if (!isoString) return '-';
      try {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (minutes < 1) return 'Hace un momento';
        if (minutes < 60) return `Hace ${minutes} min`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days}d`;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      } catch (e) {
        return '-';
      }
    }

    function getSentimentEmoji(sentimiento) {
      const map = {
        'Enojado': '😠',
        'Enojo': '😠',
        'Molesto': '😠',
        'Neutro': '😐',
        'Normal': '😐',
        'Satisfecho': '😊',
        'Feliz': '😊',
        'Contento': '😊'
      };
      return map[sentimiento] || '😐';
    }

    function getChannelIcon(canal) {
      const map = {
        'WEBPAGE': '🌐',
        'WHATSAPP': '💬',
        'WHATSAPP_1': '💬',
        'WHATSAPP_2': '💬',
        'EMAIL': '📧',
        'TELEGRAM': '✈️'
      };
      return map[canal] || '📱';
    }

    // ==================== VERIFICAR ROL DE USUARIO ====================
    
    async function checkAdminStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
        
        console.log(`👤 Usuario admin: ${isAdmin}`);
        return isAdmin;
      } catch (err) {
        console.error('Error verificando rol:', err);
        return false;
      }
    }

    // ==================== CARGAR USUARIOS ASIGNABLES ====================
    
    async function loadAssignableUsers() {
      if (!isAdmin) return;

      try {
        const { data, error } = await supabase.rpc('get_assignable_users');
        if (error) throw error;

        assignableUsers = data || [];
        
        // Poblar select
        assignUserSelect.innerHTML = '<option value="">Seleccionar usuario...</option>';
        assignableUsers.forEach(user => {
          const option = document.createElement('option');
          option.value = user.user_id;
          option.textContent = `${user.name} (${user.email})`;
          assignUserSelect.appendChild(option);
        });

        console.log(`✅ ${assignableUsers.length} usuarios asignables cargados`);
      } catch (err) {
        console.error('Error cargando usuarios:', err);
      }
    }

    // ==================== CARGAR CLIENTES ====================
    
    async function loadClientes() {
      try {
        loadingState.classList.remove('hidden');
        clientesGrid.innerHTML = '';
        emptyState.classList.add('hidden');

        const { data, error } = await supabase.schema('kpidata').rpc('list_monitor_clientes_with_priority', {
          p_limit: 100,
          p_offset: 0
        });

        if (error) throw error;

        clientes = data || [];
        console.log(`📊 ${clientes.length} clientes cargados`);

        applyFilters();
        await updateKPIs();
      } catch (err) {
        console.error('Error cargando clientes:', err);
        clientes = [];
        renderClientes([]);
      } finally {
        loadingState.classList.add('hidden');
      }
    }

    // ==================== BUSCAR CLIENTES ====================
    
    async function searchClientes(query) {
      if (!query || query.trim().length < 2) {
        filteredClientes = clientes;
        renderClientes(filteredClientes);
        return;
      }

      try {
        loadingState.classList.remove('hidden');
        
        const { data, error } = await supabase.schema('kpidata').rpc('search_monitor_clientes_with_priority', {
          p_query: query.trim(),
          p_limit: 100
        });

        if (error) throw error;

        filteredClientes = data || [];
        renderClientes(filteredClientes);
      } catch (err) {
        console.error('Error buscando clientes:', err);
        renderClientes([]);
      } finally {
        loadingState.classList.add('hidden');
      }
    }

    // ==================== APLICAR FILTROS ====================

    function applyFilters() {
      let filtered = [...clientes];

      // Filtro de prioridad baja (solo si existe el campo priority_score)
      if (!showLowPriority && clientes.length > 0 && clientes[0].priority_score !== undefined) {
        filtered = filtered.filter(c => (c.priority_score || 0) >= 10);
      }

      // Filtro de sentimiento
      if (filterSentimiento.value) {
        filtered = filtered.filter(c => c.sentimiento === filterSentimiento.value);
      }

      // Filtro de urgencia
      if (filterUrgencia.value) {
        filtered = filtered.filter(c => c.nivel_urgencia === filterUrgencia.value);
      }

      // Filtro de estado
      if (filterEstado.value) {
        if (filterEstado.value === 'sin_asignar') {
          filtered = filtered.filter(c => !c.assigned_user_id);
        } else {
          filtered = filtered.filter(c => c.estado === filterEstado.value);
        }
      }

      // Filtro de canal
      if (filterCanal.value) {
        filtered = filtered.filter(c => c.canal_origen === filterCanal.value);
      }

      filteredClientes = filtered;
      renderClientes(filteredClientes);
    }

    // ==================== ACTUALIZAR KPIS ====================

    async function updateKPIs() {
      const total = clientes.length;
      const urgent = clientes.filter(c => c.nivel_urgencia === 'alta').length;
      const unassigned = clientes.filter(c => !c.assigned_user_id).length;
      const angry = clientes.filter(c =>
        c.sentimiento && c.sentimiento.toLowerCase().includes('enoj')
      ).length;

      kpiTotal.textContent = total;
      kpiUrgent.textContent = urgent;
      kpiUnassigned.textContent = unassigned;
      kpiAngry.textContent = angry;

      // Cargar estadísticas de conversaciones resueltas
      await loadConversationStats();
    }

    // Cargar estadísticas de conversaciones resueltas
    async function loadConversationStats() {
      try {
        const { data, error } = await supabase.rpc('get_conversation_stats');

        if (error) throw error;

        if (data && kpiResolved) {
          kpiResolved.textContent = data.total_resolved || 0;
          console.log('📊 Stats de conversaciones:', data);
        }
      } catch (err) {
        console.error('Error cargando stats de conversaciones:', err);
        if (kpiResolved) kpiResolved.textContent = '0';
      }
    }

    // ==================== RENDERIZAR CLIENTES ====================
    
    function renderClientes(clientesList) {
      clientesGrid.innerHTML = '';

      if (clientesList.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');

      clientesList.forEach(cliente => {
        const card = createClienteCard(cliente);
        clientesGrid.appendChild(card);
      });
    }

    // ==================== CREAR CARD DE CLIENTE ====================
    
    function createClienteCard(cliente) {
      const card = document.createElement('div');
      card.className = `cliente-card urgencia-${cliente.nivel_urgencia || 'baja'}`;

      // Header
      const header = document.createElement('div');
      header.className = 'cliente-header';

      const info = document.createElement('div');
      info.className = 'cliente-info';

      const name = document.createElement('h3');
      name.textContent = cliente.contact_name || cliente.user_id || 'Cliente Anónimo';
      info.appendChild(name);

      const id = document.createElement('div');
      id.className = 'cliente-id';
      id.textContent = `ID: ${cliente.user_id}`;
      info.appendChild(id);

      header.appendChild(info);

      // Badge de urgencia
      const urgBadge = document.createElement('div');
      urgBadge.className = `urgencia-badge ${cliente.nivel_urgencia || 'baja'}`;
      urgBadge.textContent = `${cliente.puntuacion_urgencia || '0'}/10`;
      header.appendChild(urgBadge);

      card.appendChild(header);

      // Badges
      const badgesDiv = document.createElement('div');
      badgesDiv.className = 'cliente-badges';

      // Badge de prioridad (solo si existe el campo priority_score)
      if (cliente.priority_score !== undefined && cliente.priority_score !== null) {
        const priorityScore = cliente.priority_score;
        let priorityClass = 'baja';
        let priorityIcon = '➖';
        let priorityText = 'Baja';

        if (priorityScore >= 20) {
          priorityClass = 'alta';
          priorityIcon = '⚡';
          priorityText = 'Alta';
        } else if (priorityScore >= 10) {
          priorityClass = 'media';
          priorityIcon = '⚠️';
          priorityText = 'Media';
        }

        const priorityBadge = document.createElement('span');
        priorityBadge.className = `badge priority-badge priority-${priorityClass}`;
        priorityBadge.textContent = `${priorityIcon} Prioridad ${priorityText}`;
        priorityBadge.title = `Score: ${priorityScore}`;
        badgesDiv.appendChild(priorityBadge);
      }

      if (cliente.sentimiento) {
        const sentBadge = document.createElement('span');
        sentBadge.className = 'badge sentimiento';
        sentBadge.textContent = `${getSentimentEmoji(cliente.sentimiento)} ${cliente.sentimiento}`;
        badgesDiv.appendChild(sentBadge);
      }

      if (cliente.intencion) {
        const intBadge = document.createElement('span');
        intBadge.className = 'badge intencion';
        intBadge.textContent = `🎯 ${cliente.intencion}`;
        badgesDiv.appendChild(intBadge);
      }

      if (cliente.canal_origen) {
        const canalBadge = document.createElement('span');
        canalBadge.className = 'badge canal';
        canalBadge.textContent = `${getChannelIcon(cliente.canal_origen)} ${cliente.canal_origen}`;
        badgesDiv.appendChild(canalBadge);
      }

      if (cliente.assigned_user_name) {
        const assignBadge = document.createElement('span');
        assignBadge.className = 'badge assigned';
        assignBadge.textContent = `👤 ${cliente.assigned_user_name}`;
        badgesDiv.appendChild(assignBadge);
      }

      card.appendChild(badgesDiv);

      // Resumen
      if (cliente.resumen) {
        const resumen = document.createElement('p');
        resumen.className = 'cliente-resumen';
        resumen.textContent = cliente.resumen;
        card.appendChild(resumen);
      }

      // Footer
      const footer = document.createElement('div');
      footer.className = 'cliente-footer';

      const time = document.createElement('span');
      time.className = 'cliente-time';
      time.textContent = `⏰ ${formatDate(cliente.update_at || cliente.created_at)}`;
      footer.appendChild(time);

      const actions = document.createElement('div');
      actions.className = 'cliente-actions';

      // Botón ver conversación
      if (cliente.tiene_conversacion && cliente.contact_id) {
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-icon';
        viewBtn.innerHTML = '💬 Ver';
        viewBtn.title = 'Ver conversación en Livechat';
        viewBtn.addEventListener('click', () => {
          window.location.hash = `/livechat?contact=${cliente.contact_id}`;
        });
        actions.appendChild(viewBtn);
      }

      // Botón asignar (solo admin)
      if (isAdmin) {
        const assignBtn = document.createElement('button');
        assignBtn.className = 'btn-icon assign';
        assignBtn.innerHTML = '👤 Asignar';
        assignBtn.title = 'Asignar a usuario';
        assignBtn.addEventListener('click', () => openAssignModal(cliente));
        actions.appendChild(assignBtn);
      }

      footer.appendChild(actions);
      card.appendChild(footer);

      return card;
    }

    // ==================== MODAL DE ASIGNACIÓN ====================
    
    function openAssignModal(cliente) {
      currentClientToAssign = cliente;
      
      assignClientName.textContent = cliente.contact_name || cliente.user_id || 'Cliente Anónimo';
      assignClientSummary.textContent = cliente.resumen || 'Sin resumen';
      
      assignClientSentiment.textContent = cliente.sentimiento ? 
        `${getSentimentEmoji(cliente.sentimiento)} ${cliente.sentimiento}` : 
        '😐 Neutro';
      assignClientSentiment.className = 'badge sentimiento';
      
      assignClientUrgency.textContent = `🚨 Urgencia ${cliente.puntuacion_urgencia || '0'}/10`;
      assignClientUrgency.className = `badge urgencia-badge ${cliente.nivel_urgencia || 'baja'}`;
      
      assignUserSelect.value = cliente.assigned_user_id || '';
      assignNotes.value = '';
      
      assignModal.classList.remove('hidden');
    }

    function closeAssignModal() {
      assignModal.classList.add('hidden');
      currentClientToAssign = null;
    }

    async function assignCliente() {
      if (!currentClientToAssign) return;

      const userId = assignUserSelect.value;
      if (!userId) {
        alert('Por favor selecciona un usuario');
        return;
      }

      try {
        confirmAssignBtn.disabled = true;
        confirmAssignBtn.textContent = 'Asignando...';

        const { data, error } = await supabase.schema('kpidata').rpc('assign_from_monitor', {
          p_user_id: currentClientToAssign.user_id,
          p_assigned_to: userId,
          p_notes: assignNotes.value || null
        });

        if (error) throw error;

        if (data && data.success) {
          console.log('✅ Cliente asignado exitosamente');
          closeAssignModal();
          await loadClientes(); // Recargar lista
        } else {
          throw new Error(data?.error || 'Error desconocido');
        }
      } catch (err) {
        console.error('Error asignando cliente:', err);
        alert('Error al asignar: ' + err.message);
      } finally {
        confirmAssignBtn.disabled = false;
        confirmAssignBtn.textContent = 'Asignar';
      }
    }

    // ==================== EVENT LISTENERS ====================
    
    // Búsqueda
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      
      if (query) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if (query.trim().length >= 2) {
          searchClientes(query);
        } else if (query.trim().length === 0) {
          applyFilters();
        }
      }, 300);
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      applyFilters();
    });

    // Filtros
    filterSentimiento.addEventListener('change', applyFilters);
    filterUrgencia.addEventListener('change', applyFilters);
    filterEstado.addEventListener('change', applyFilters);
    filterCanal.addEventListener('change', applyFilters);

    // Toggle de prioridad baja
    showLowPriorityToggle.addEventListener('change', (e) => {
      showLowPriority = e.target.checked;
      console.log(`📊 Mostrar baja prioridad: ${showLowPriority}`);
      applyFilters();
    });

    // Refresh
    refreshBtn.addEventListener('click', loadClientes);

    // Modal
    assignModalClose.addEventListener('click', closeAssignModal);
    cancelAssignBtn.addEventListener('click', closeAssignModal);
    confirmAssignBtn.addEventListener('click', assignCliente);
    
    assignModal.addEventListener('click', (e) => {
      if (e.target === assignModal) {
        closeAssignModal();
      }
    });

    // Escape para cerrar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !assignModal.classList.contains('hidden')) {
        closeAssignModal();
      }
    });

    // ==================== INICIALIZACIÓN ====================
    
    console.log('🚀 Inicializando Monitor de Clientes...');
    
    await checkAdminStatus();
    await loadAssignableUsers();
    await loadClientes();

    console.log('✅ Monitor de Clientes iniciado');
  }

  window.MonitorClientesModule = { init };
})();
