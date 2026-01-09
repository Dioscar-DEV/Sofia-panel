// Módulo de Reportes para Sofia
// Sistema simplificado de tickets/reportes
(function(){
  let initialized = false;
  let listenersAttached = false;

  const state = {
    items: [],
    selectedId: null,
    loading: false,
    error: '',
    currentPage: 1,
    pageSize: 50,
    totalItems: 0,
    hasMorePages: false
  };

  function qs(id){ return document.getElementById(id); }

  function setLoading(isLoading){
    state.loading = isLoading;
    const loadingEl = qs('rep-loading');
    const contentEl = qs('rep-content');
    if(loadingEl){ loadingEl.classList.toggle('hidden', !isLoading); }
    if(contentEl){ contentEl.classList.toggle('hidden', isLoading); }
  }

  function setError(message){
    state.error = message || '';
    const errorWrap = qs('rep-error');
    const errorText = qs('rep-error-text');
    if(errorWrap && errorText){
      errorText.textContent = message || '';
      errorWrap.classList.toggle('hidden', !message);
    }
  }

  function htmlText(v){
    const s = v == null ? '—' : String(v);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeText(v){
    if(v == null) return '—';
    if(typeof v === 'string') return v || '—';
    try{ return JSON.stringify(v); }catch(_){ return String(v); }
  }

  function short(str, n){
    const s = (str || '').toString();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function getStateClass(estado){
    const e = (estado || '').toLowerCase();
    if(e.includes('pendiente') || e.includes('recibido')) return 'rep-state-pendiente';
    if(e.includes('proceso')) return 'rep-state-proceso';
    if(e.includes('resuelto') || e.includes('cerrado')) return 'rep-state-cerrado';
    if(e.includes('rechazado')) return 'rep-state-rechazado';
    return 'rep-state-otro';
  }

  async function renderList(){
    const listEl = qs('rep-list');
    const emptyEl = qs('rep-empty');
    if(!listEl || !emptyEl){ return; }

    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', state.items.length > 0);

    state.items.forEach(r => {
      const el = document.createElement('div');
      el.className = 'rep-item' + (r.id === state.selectedId ? ' active' : '');
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      
      const title = htmlText(r.titulo || `Reporte #${r.id}`);
      const categoria = htmlText(r.categoria || 'Sin categoría');
      const estado = htmlText(r.estado || 'pendiente');
      const fecha = r.created_at ? new Date(r.created_at).toLocaleString('es-ES') : '—';
      
      el.innerHTML = `
        <div class="rep-item-header">
          <div class="rep-item-title">${title}</div>
          <span class="rep-chip ${getStateClass(estado)}">${estado}</span>
        </div>
        <div class="rep-item-meta">
          <span class="rep-category">${categoria}</span>
          <span class="rep-date">${fecha}</span>
        </div>
      `;
      
      el.addEventListener('click', () => selectItem(r.id));
      el.addEventListener('keypress', (e) => { if(e.key==='Enter'){ selectItem(r.id); } });
      listEl.appendChild(el);
    });

    updateKpis();
  }

  function updateKpis(){
    const totalEl = qs('rep-kpi-total');
    const pendientesEl = qs('rep-kpi-pendientes');
    const progresoEl = qs('rep-kpi-progreso');
    const resueltosEl = qs('rep-kpi-resueltos');

    if(totalEl) totalEl.textContent = state.totalItems || 0;
    
    const pendientes = state.items.filter(r => (r.estado || '').toLowerCase().includes('pendiente')).length;
    const progreso = state.items.filter(r => (r.estado || '').toLowerCase().includes('proceso')).length;
    const resueltos = state.items.filter(r => (r.estado || '').toLowerCase().includes('resuelto') || (r.estado || '').toLowerCase().includes('cerrado')).length;
    
    if(pendientesEl) pendientesEl.textContent = pendientes;
    if(progresoEl) progresoEl.textContent = progreso;
    if(resueltosEl) resueltosEl.textContent = resueltos;
  }

  function renderEvidencias(evidencias){
    if(!evidencias || (Array.isArray(evidencias) && evidencias.length === 0)){
      return '<div class="rep-muted">Sin evidencias</div>';
    }

    const items = Array.isArray(evidencias) ? evidencias : [];
    if(items.length === 0 || (items.length === 1 && Object.keys(items[0]).length === 0)){
      return '<div class="rep-muted">Sin evidencias</div>';
    }

    const html = items.filter(ev => ev && Object.keys(ev).length > 0).map((ev, idx) => {
      const url = typeof ev === 'string' ? ev : (ev?.url || ev?.href || '');
      const nombre = typeof ev === 'string' ? url.split('/').pop() : (ev?.nombre_archivo || ev?.nombre || ev?.name || `Archivo ${idx+1}`);
      
      if(!url) return '';
      
      if(/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url)){
        return `
          <div class="rep-evidence-item">
            <div class="rep-evidence-link-img" data-image-url="${encodeURI(url)}" data-image-name="${htmlText(nombre)}">
              <img src="${encodeURI(url)}" alt="${htmlText(nombre)}" class="rep-evidence-img" loading="lazy" />
              <div class="rep-evidence-overlay">
                <span>🔍 Ver imagen completa</span>
              </div>
            </div>
            <div class="rep-evidence-name">${htmlText(nombre)}</div>
          </div>`;
      }
      
      if(/\.(pdf)$/i.test(url)){
        return `
          <div class="rep-evidence-item">
            <a href="${encodeURI(url)}" target="_blank" class="rep-evidence-link">
              <div class="rep-evidence-icon">📄</div>
              <div class="rep-evidence-name">${htmlText(nombre)}</div>
            </a>
          </div>`;
      }
      
      return `
        <div class="rep-evidence-item">
          <a href="${encodeURI(url)}" target="_blank" class="rep-evidence-link">
            <div class="rep-evidence-icon">📎</div>
            <div class="rep-evidence-name">${htmlText(nombre)}</div>
          </a>
        </div>`;
    }).filter(Boolean).join('');

    return html ? `<div class="rep-evidences-grid">${html}</div>` : '<div class="rep-muted">Sin evidencias</div>';
  }

  function renderHistorial(historial){
    if(!historial || (Array.isArray(historial) && historial.length === 0)){
      return '<div class="rep-muted">Sin historial</div>';
    }

    const items = Array.isArray(historial) ? historial : [];
    if(items.length === 0) return '<div class="rep-muted">Sin historial</div>';

    const html = items.map(h => {
      // Parsear si viene como string JSON
      let item = h;
      if(typeof h === 'string'){
        try{ item = JSON.parse(h); }catch(_){ item = {evento: h}; }
      }
      
      const fecha = item?.fecha || item?.created_at || '—';
      const usuario = item?.usuario || item?.user || '—';
      const accion = item?.accion || item?.action || item?.evento || '—';
      const comentario = item?.comentario || item?.comment || '';
      
      return `
        <div class="rep-historial-item">
          <div class="rep-historial-header">
            <span class="rep-historial-fecha">${htmlText(typeof fecha === 'string' ? fecha : new Date(fecha).toLocaleString('es-ES'))}</span>
            <span class="rep-historial-usuario">${htmlText(usuario)}</span>
          </div>
          <div class="rep-historial-accion">${htmlText(accion)}</div>
          ${comentario ? `<div class="rep-historial-comentario">${htmlText(comentario)}</div>` : ''}
        </div>`;
    }).join('');

    return `<div class="rep-historial-list">${html}</div>`;
  }

  async function fetchContratos(userId){
    if(!userId) return null;
    
    const { supabase } = window.App || {};
    if(!supabase) return null;

    try{
      const { data, error } = await supabase.rpc('get_contratos_by_user_id', {
        p_user_id: userId
      });

      if(error) throw error;
      return data && data.length > 0 ? data[0] : null;
    }catch(err){
      console.error('Error fetching contratos:', err);
      return null;
    }
  }

  function renderContratos(contratosData){
    if(!contratosData || !contratosData.contratos){
      return '<p class="rep-muted">No hay contratos registrados para este usuario</p>';
    }

    const contratos = contratosData.contratos;
    const cantidad = contratosData.cantidad_contratos || contratos.length;

    const contratosHtml = contratos.map((contrato, idx) => {
      const idAbonado = htmlText(contrato.id_abonado || '—');
      const contractId = htmlText(contrato.contract_id || '—');
      const fechaContrato = contrato.contract_date ? new Date(contrato.contract_date).toLocaleDateString('es-ES') : '—';
      const total = contrato.subscription_total ? `$${contrato.subscription_total}` : '—';
      const tipo = htmlText(contrato.subscriber_type || '—');
      
      // Dirección
      const addr = contrato.address || {};
      const direccion = addr.fiscal_address 
        ? htmlText(addr.fiscal_address)
        : `${addr.sector || ''} ${addr.house_number || ''} ${addr.city || ''}`.trim() || '—';
      
      // Servicios
      const servicios = contrato.services && contrato.services.length > 0
        ? contrato.services.map(s => `<span class="rep-chip">${htmlText(s.service_name || s.service_type || '—')}</span>`).join('')
        : '<span class="rep-muted">Sin servicios</span>';

      return `
        <div class="rep-contrato-card">
          <div class="rep-contrato-header">
            <div class="rep-contrato-title">Contrato #${idx + 1}</div>
            <span class="rep-chip rep-state-proceso">${tipo}</span>
          </div>
          <div class="rep-contrato-grid">
            <div><div class="rep-label">ID Abonado</div><div><strong>${idAbonado}</strong></div></div>
            <div><div class="rep-label">Contract ID</div><div>${contractId}</div></div>
            <div><div class="rep-label">Fecha Contrato</div><div>${fechaContrato}</div></div>
            <div><div class="rep-label">Total Mensual</div><div><strong>${total}</strong></div></div>
            <div class="rep-colspan2"><div class="rep-label">Dirección</div><div>${direccion}</div></div>
            <div class="rep-colspan2"><div class="rep-label">Servicios</div><div class="rep-servicios-wrap">${servicios}</div></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="rep-contratos-summary">
        <div class="rep-chip rep-state-cerrado">Total: ${cantidad} contrato(s)</div>
        ${contratosData.contact_docid ? `<div class="rep-label">Cédula: ${htmlText(contratosData.contact_docid)}</div>` : ''}
      </div>
      <div class="rep-contratos-list">${contratosHtml}</div>
    `;
  }

  function renderDetail(){
    const wrap = qs('rep-detail');
    const empty = qs('rep-detail-empty');
    if(!wrap || !empty){ return; }

    const it = state.items.find(x => x.id === state.selectedId) || null;
    if(!it){
      wrap.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }
    
    empty.classList.add('hidden');
    wrap.classList.remove('hidden');

    const title = qs('rep-detail-title');
    const meta = qs('rep-detail-meta');
    if(title) title.textContent = it.titulo || `Reporte #${it.id}`;
    if(meta){
      const fecha = it.created_at ? new Date(it.created_at).toLocaleString('es-ES') : '—';
      meta.textContent = `ID ${it.id} • ${fecha} • ${it.estado || 'pendiente'}`;
    }

    const tagsWrap = qs('rep-tags');
    if(tagsWrap){
      const chips = [];
      if(it.estado) chips.push(`<span class="rep-chip ${getStateClass(it.estado)}">${htmlText(it.estado)}</span>`);
      if(it.categoria) chips.push(`<span class="rep-chip category">${htmlText(it.categoria)}</span>`);
      tagsWrap.innerHTML = chips.join('');
    }

    const actionsBar = qs('rep-actions-bar');
    if(actionsBar){
      const canManage = window.App?.hasPerm && window.App.hasPerm('reportes.manage');
      if(canManage){
        actionsBar.innerHTML = `
          <button id="rep-cambiar-estado" class="rep-btn primary" data-reporte-id="${it.id}">Cambiar Estado</button>
          <button id="rep-asignar-usuario" class="rep-btn" data-reporte-id="${it.id}">Asignar usuario</button>
        `;
        actionsBar.classList.remove('hidden');
        // Asignar evento para asignar usuario
        setTimeout(()=>{
          const btn = document.getElementById('rep-asignar-usuario');
          if(btn){
            btn.onclick = async function(){
              // Mostrar selector de usuario
              const supabase = window.App?.supabase;
              if(!supabase){
                window.UI?.toast('Supabase no disponible','error');
                return;
              }
              // Buscar usuarios (máx 30)
              const { data: users, error } = await supabase.from('profiles').select('user_id, email, name').limit(30);
              if(error || !users){
                window.UI?.toast('Error cargando usuarios','error');
                return;
              }
              // Crear selector
              const options = users.map(u=>`<option value="${u.user_id}">${u.name||u.email||u.user_id}</option>`).join('');
              const html = `<div style='min-width:300px;'>
                <h3>Asignar usuario a reporte</h3>
                <select id='asignar-user-select' style='width:100%;margin:12px 0;'>
                  <option value=''>Selecciona usuario...</option>
                  ${options}
                </select>
                <div style='text-align:right;margin-top:12px;'>
                  <button class='ui-btn' id='asignar-user-cancel'>Cancelar</button>
                  <button class='ui-btn primary' id='asignar-user-confirm'>Asignar</button>
                </div>
              </div>`;
              
              const modal = window.UI?.modal(html);
              if(!modal) return;
              
              document.getElementById('asignar-user-cancel')?.addEventListener('click', () => modal.close());
              document.getElementById('asignar-user-confirm')?.addEventListener('click', async () => {
                const selectedUserId = document.getElementById('asignar-user-select')?.value;
                if(!selectedUserId){
                  window.UI?.toast('Selecciona un usuario','warning');
                  return;
                }
                try{
                  const { error } = await supabase.rpc('reportes_asignar_usuario', {
                    p_reporte_id: it.id,
                    p_user_id: selectedUserId
                  });
                  if(error) throw error;
                  window.UI?.toast('Usuario asignado','success');
                  modal.close();
                  await fetchReports();
                }catch(err){
                  console.error('Error asignando usuario:', err);
                  window.UI?.toast('Error al asignar usuario','error');
                }
              });
            };
          }
        }, 100);
      } else {
        actionsBar.innerHTML = '';
        actionsBar.classList.add('hidden');
      }
    }

    const basic = qs('rep-basic');
    if(basic){
      if(it.user_id){
        // Buscar el chat_id real (contact_chat) en Supabase
        const supabase = window.App?.supabase;
        if(supabase){
          supabase
            .schema('instancias')
            .from('agent_contact_list')
            .select('contact_chat')
            .eq('user_id', it.user_id)
            .maybeSingle()
            .then(({ data, error }) => {
              let chatId = it.user_id;
              if(data && data.contact_chat){
                chatId = data.contact_chat;
              }
              var userIdLink = '<a href="#/livechat?chat_id=' + encodeURIComponent(chatId) + '" class="rep-contact-link">' + htmlText(it.user_id) + '</a>';
              basic.innerHTML = '<div class="rep-grid2">' +
                '<div><div class="rep-label">Nombre Completo</div><div>' + htmlText(it.nombre_completo || '—') + '</div></div>' +
                '<div><div class="rep-label">Cédula</div><div>' + htmlText(it.cedula_identidad || '—') + '</div></div>' +
                '<div><div class="rep-label">Teléfono/User ID</div><div>' + userIdLink + '</div></div>' +
                '<div><div class="rep-label">Fecha Creación</div><div>' + (it.fecha_creacion ? new Date(it.fecha_creacion).toLocaleString('es-ES') : '—') + '</div></div>' +
                '<div><div class="rep-label">Categoría</div><div>' + htmlText(it.categoria || '—') + '</div></div>' +
                '<div class="rep-colspan2"><div class="rep-label">Descripción</div><div>' + htmlText(it.descripcion || '—') + '</div></div>' +
                '</div>';
            });
        } else {
          // Fallback si no hay supabase
          var userIdLink = '<a href="#/livechat?chat_id=' + encodeURIComponent(it.user_id) + '" class="rep-contact-link">' + htmlText(it.user_id) + '</a>';
          basic.innerHTML = '<div class="rep-grid2">' +
            '<div><div class="rep-label">Nombre Completo</div><div>' + htmlText(it.nombre_completo || '—') + '</div></div>' +
            '<div><div class="rep-label">Cédula</div><div>' + htmlText(it.cedula_identidad || '—') + '</div></div>' +
            '<div><div class="rep-label">Teléfono/User ID</div><div>' + userIdLink + '</div></div>' +
            '<div><div class="rep-label">Fecha Creación</div><div>' + (it.fecha_creacion ? new Date(it.fecha_creacion).toLocaleString('es-ES') : '—') + '</div></div>' +
            '<div><div class="rep-label">Categoría</div><div>' + htmlText(it.categoria || '—') + '</div></div>' +
            '<div class="rep-colspan2"><div class="rep-label">Descripción</div><div>' + htmlText(it.descripcion || '—') + '</div></div>' +
            '</div>';
        }
      } else {
        basic.innerHTML = `
          <div class="rep-grid2">
            <div><div class="rep-label">Nombre Completo</div><div>${htmlText(it.nombre_completo || '—')}</div></div>
            <div><div class="rep-label">Cédula</div><div>${htmlText(it.cedula_identidad || '—')}</div></div>
            <div><div class="rep-label">Teléfono/User ID</div><div>—</div></div>
            <div><div class="rep-label">Fecha Creación</div><div>${it.fecha_creacion ? new Date(it.fecha_creacion).toLocaleString('es-ES') : '—'}</div></div>
            <div><div class="rep-label">Categoría</div><div>${htmlText(it.categoria || '—')}</div></div>
            <div class="rep-colspan2"><div class="rep-label">Descripción</div><div>${htmlText(it.descripcion || '—')}</div></div>
          </div>`;
      }
    }

    const evidencias = qs('rep-evidencias');
    if(evidencias) evidencias.innerHTML = renderEvidencias(it.evidencias);

    const historial = qs('rep-historial');
    if(historial) historial.innerHTML = renderHistorial(it.historial);

    // Cargar contratos del usuario
    const contratosEl = qs('rep-contratos');
    if(contratosEl && it.user_id){
      contratosEl.innerHTML = '<p class="rep-muted">Cargando contratos...</p>';
      fetchContratos(it.user_id).then(contratosData => {
        if(contratosEl) contratosEl.innerHTML = renderContratos(contratosData);
      });
    } else if(contratosEl){
      contratosEl.innerHTML = '<p class="rep-muted">No hay user_id para buscar contratos</p>';
    }
  }

  function selectItem(id){
    state.selectedId = id;
    renderList();
    renderDetail();
  }

  async function fetchReports(){
    setLoading(true);
    setError('');
    
    const { supabase } = window.App || {};
    if(!supabase){
      setError('Supabase no inicializado');
      setLoading(false);
      return;
    }

    // Validar que los elementos del DOM existan
    const listEl = qs('rep-list');
    if(!listEl){
      console.warn('[Reportes] Elementos del DOM no encontrados, esperando...');
      setTimeout(() => fetchReports(), 100);
      return;
    }

    try{
      // Determinar el filtro de usuario
      let userIdFilter = null;
      const isAdmin = ['admin', 'superadmin'].includes(window.App?.profile?.role) || window.App?.can(['admin', 'superadmin']);
      
      if(isAdmin){
        // Admin: usar el filtro seleccionado o null para ver todos
        userIdFilter = (qs('rep-filter-user')?.value || '').trim() || null;
      } else {
        // No admin: solo ve sus propios reportes
        userIdFilter = window.App?.session?.user?.id || null;
      }

      const params = {
        p_page: state.currentPage,
        p_limit: state.pageSize,
        p_search_text: (qs('rep-search')?.value || '').trim() || null,
        p_id: (qs('rep-filter-id')?.value || '').trim() || null,
        p_estado: (qs('rep-filter-estado')?.value || '').trim() || null,
        p_categoria: (qs('rep-filter-categoria')?.value || '').trim() || null,
        p_periodo: (qs('rep-filter-periodo')?.value || '').trim() || null,
        p_desde: (qs('rep-filter-desde')?.value || '').trim() || null,
        p_hasta: (qs('rep-filter-hasta')?.value || '').trim() || null,
        p_user_id: userIdFilter
      };

      const { data, error } = await supabase.rpc('reportes_list_filtrado', params);
      
      if(error) throw error;
      if(!data || !data.data) throw new Error('Respuesta inválida del servidor');

      state.items = data.data || [];
      state.totalItems = data.total || 0;
      state.hasMorePages = (state.currentPage * state.pageSize) < state.totalItems;

      await renderList();
      updatePagination();

      if(!state.selectedId || !state.items.find(item => item.id === state.selectedId)){
        if(state.items.length > 0){
          selectItem(state.items[0].id);
        } else {
          renderDetail();
        }
      }
    }catch(err){
      console.error('[Reportes] Error:', err);
      setError('No se pudieron cargar los reportes. Por favor, intenta nuevamente.');
      state.items = [];
      state.totalItems = 0;
      state.hasMorePages = false;
      await renderList();
      updatePagination();
    }finally{
      setLoading(false);
    }
  }

  function updatePagination(){
    const paginationEl = qs('rep-pagination');
    if(!paginationEl) return;

    const totalPages = Math.ceil(state.totalItems / state.pageSize);
    const hasPrev = state.currentPage > 1;
    const hasNext = state.hasMorePages;

    paginationEl.innerHTML = `
      <div class="rep-pagination-info">
        Página ${state.currentPage} de ${totalPages || 1} (${state.totalItems} reportes)
      </div>
      <div class="rep-pagination-controls">
        <button id="rep-prev-page" class="rep-btn" ${!hasPrev ? 'disabled' : ''}>Anterior</button>
        <button id="rep-next-page" class="rep-btn" ${!hasNext ? 'disabled' : ''}>Siguiente</button>
      </div>
    `;

    const prevBtn = qs('rep-prev-page');
    const nextBtn = qs('rep-next-page');
    
    if(prevBtn) prevBtn.addEventListener('click', () => { state.currentPage--; fetchReports(); });
    if(nextBtn) nextBtn.addEventListener('click', () => { state.currentPage++; fetchReports(); });
  }

  async function loadFilterOptions(){
    const { supabase } = window.App || {};
    if(!supabase) return;

    // Validar que los elementos del DOM existan antes de cargar opciones
    const catSelect = qs('rep-filter-categoria');
    if(!catSelect){
      console.warn('[Reportes] Elementos de filtro no encontrados todavía');
      return;
    }

    try{
      const { data, error } = await supabase.rpc('get_reportes_filter_options');
      if(error) throw error;

      const options = data || {};
      
      const catSelect = qs('rep-filter-categoria');
      if(catSelect && options.categorias){
        options.categorias.forEach(cat => {
          if(cat) catSelect.innerHTML += `<option value="${htmlText(cat)}">${htmlText(cat)}</option>`;
        });
      }

      const estSelect = qs('rep-filter-estado');
      if(estSelect && options.estados){
        estSelect.innerHTML = '<option value="">Todos</option>';
        options.estados.forEach(est => {
          if(est) estSelect.innerHTML += `<option value="${htmlText(est)}">${htmlText(est)}</option>`;
        });
      }

      // Cargar usuarios solo para admins
      const isAdmin = ['admin', 'superadmin'].includes(window.App?.profile?.role) || window.App?.can(['admin', 'superadmin']);
      console.log('[Reportes] Verificando permisos admin:', {
        isAdmin,
        profileRole: window.App?.profile?.role,
        canAdmin: window.App?.can(['admin', 'superadmin'])
      });
      
      if(isAdmin){
        const userSelectWrap = qs('rep-filter-user-wrap');
        const userSelect = qs('rep-filter-user');
        if(userSelectWrap && userSelect){
          console.log('[Reportes] Mostrando filtro de usuarios para admin');
          userSelectWrap.style.display = '';
          const { data: users, error: userError } = await supabase.from('profiles').select('user_id, email, name').order('name').limit(100);
          if(!userError && users){
            console.log(`[Reportes] ${users.length} usuarios cargados`);
            userSelect.innerHTML = '<option value="">Todos los usuarios</option>';
            users.forEach(u => {
              userSelect.innerHTML += `<option value="${htmlText(u.user_id)}">${htmlText(u.name || u.email || u.user_id)}</option>`;
            });
          } else {
            console.error('[Reportes] Error cargando usuarios:', userError);
          }
        }
      } else {
        console.log('[Reportes] Usuario no es admin, filtro oculto');
      }
    }catch(err){
      console.error('[Reportes] Error cargando opciones de filtros:', err);
    }
  }

  function setupEventListeners(){
    // Evitar duplicar listeners si ya están configurados
    if(listenersAttached){
      console.log('[Reportes] Event listeners ya configurados, omitiendo...');
      return;
    }
    
    listenersAttached = true;
    console.log('[Reportes] Configurando event listeners...');
    
    const searchBtn = qs('rep-search-btn');
    const searchInput = qs('rep-search');
    const clearBtn = qs('clear-filters-help');
    const refreshBtn = qs('refresh-reports-help');
    const periodoSelect = qs('rep-filter-periodo');

    // ✅ Búsqueda con debounce para mejor performance
    const debouncedSearch = window.debounce ? window.debounce(() => {
      state.currentPage = 1;
      fetchReports();
    }, 300) : (() => { state.currentPage = 1; fetchReports(); });

    if(searchBtn) searchBtn.addEventListener('click', () => { state.currentPage = 1; fetchReports(); });
    if(searchInput) {
      // Buscar mientras escribe (con debounce)
      searchInput.addEventListener('input', debouncedSearch);
      // Enter también busca
      searchInput.addEventListener('keypress', (e) => { if(e.key === 'Enter'){ state.currentPage = 1; fetchReports(); } });
    }
    
    if(clearBtn) clearBtn.addEventListener('click', () => {
      const inputs = document.querySelectorAll('.rep-filter-input');
      inputs.forEach(input => { if(input.tagName === 'SELECT') input.selectedIndex = 0; else input.value = ''; });
      state.currentPage = 1;
      fetchReports();
    });

    if(refreshBtn) refreshBtn.addEventListener('click', () => fetchReports());

    if(periodoSelect){
      periodoSelect.addEventListener('change', (e) => {
        const customDates = document.querySelectorAll('.rep-filter-custom-dates');
        customDates.forEach(el => el.classList.toggle('hidden', e.target.value !== 'custom'));
        state.currentPage = 1;
        fetchReports();
      });
    }

    const filterInputs = document.querySelectorAll('.rep-filter-input:not(#rep-filter-periodo):not(#rep-search)');
    filterInputs.forEach(input => {
      input.addEventListener('change', () => { state.currentPage = 1; fetchReports(); });
    });

    // Event listener para abrir modal de imágenes
    document.addEventListener('click', async (e) => {
      const imageLink = e.target.closest('.rep-evidence-link-img');
      if(imageLink){
        e.preventDefault();
        const imageUrl = imageLink.getAttribute('data-image-url');
        const imageName = imageLink.getAttribute('data-image-name');
        if(imageUrl) openImageModal(imageUrl, imageName);
        return;
      }
      if(e.target.id === 'rep-cambiar-estado' || e.target.closest('#rep-cambiar-estado')){
        const reporteId = state.selectedId;
        if(!reporteId) return;
        
        const item = state.items.find(x => x.id === reporteId);
        const estadoActual = item?.estado || 'pendiente';
        
        // Crear modal con selector de estados
        const html = `<div style='min-width:350px;'>
          <h3>Cambiar estado del reporte</h3>
          <p style='color:#64748b;margin:8px 0 16px;'>Reporte #${reporteId}</p>
          <label style='display:block;margin-bottom:12px;'>
            <span style='display:block;margin-bottom:4px;font-weight:500;'>Nuevo estado:</span>
            <select id='cambiar-estado-select' style='width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;'>
              <option value='pendiente' ${estadoActual === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value='en_proceso' ${estadoActual === 'en_proceso' ? 'selected' : ''}>En Proceso</option>
              <option value='resuelto' ${estadoActual === 'resuelto' ? 'selected' : ''}>Resuelto</option>
              <option value='cerrado' ${estadoActual === 'cerrado' ? 'selected' : ''}>Cerrado</option>
              <option value='rechazado' ${estadoActual === 'rechazado' ? 'selected' : ''}>Rechazado</option>
            </select>
          </label>
          <label style='display:block;margin-bottom:16px;'>
            <span style='display:block;margin-bottom:4px;font-weight:500;'>Comentario (opcional):</span>
            <textarea id='cambiar-estado-comentario' rows='3' style='width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;' placeholder='Agrega un comentario sobre el cambio...'></textarea>
          </label>
          <div style='text-align:right;margin-top:16px;'>
            <button class='ui-btn' id='cambiar-estado-cancel'>Cancelar</button>
            <button class='ui-btn primary' id='cambiar-estado-confirm'>Cambiar Estado</button>
          </div>
        </div>`;
        
        const modal = window.UI?.modal(html);
        if(!modal) return;
        
        document.getElementById('cambiar-estado-cancel')?.addEventListener('click', () => modal.close());
        document.getElementById('cambiar-estado-confirm')?.addEventListener('click', async () => {
          const nuevoEstado = document.getElementById('cambiar-estado-select')?.value;
          const comentario = document.getElementById('cambiar-estado-comentario')?.value || '';
          
          if(!nuevoEstado){
            window.UI?.toast('Selecciona un estado','warning');
            return;
          }
          
          try{
            const { supabase, session } = window.App || {};
            if(!supabase) throw new Error('Supabase no disponible');
            
            const { data, error } = await supabase.rpc('reportes_cambiar_estado', {
              p_reporte_id: reporteId,
              p_nuevo_estado: nuevoEstado,
              p_comentario: comentario,
              p_usuario_email: session?.user?.email || null
            });
            
            if(error) throw error;
            
            window.UI?.toast('Estado actualizado correctamente','success');
            modal.close();
            await fetchReports();
          }catch(err){
            console.error('[Reportes] Error cambiando estado:', err);
            window.UI?.toast('Error al cambiar el estado: ' + err.message,'error');
          }
        });
      }
    });

    // Event listener para cerrar modal con tecla Escape
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') closeImageModal();
    });
  }

  async function init(){
    console.log('[Reportes] Inicializando módulo...', { initialized });
    
    // Validar que el DOM esté listo
    const outlet = document.getElementById('app-outlet');
    if(!outlet || !qs('rep-list')){
      console.warn('[Reportes] DOM no listo, reintentando en 100ms...');
      setTimeout(() => init(), 100);
      return;
    }
    
    // Si ya está inicializado, solo recargar datos
    if(initialized) {
      console.log('[Reportes] Ya inicializado, recargando datos...');
      await fetchReports();
      return;
    }
    
    initialized = true;
    
    await loadFilterOptions();
    setupEventListeners();
    await fetchReports();

    console.log('[Reportes] Módulo inicializado completamente');
  }

  function destroy(){
    initialized = false;
    listenersAttached = false;
    state.items = [];
    state.selectedId = null;
    state.currentPage = 1;
    console.log('[Reportes] Módulo destruido');
  }

  function openImageModal(imageUrl, imageName){
    let modal = qs('rep-image-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'rep-image-modal';
      modal.className = 'rep-image-modal';
      modal.innerHTML = `
        <div class="rep-image-modal-backdrop"></div>
        <div class="rep-image-modal-content">
          <button class="rep-image-modal-close" title="Cerrar">×</button>
          <img class="rep-image-modal-img" src="" alt="" />
          <div class="rep-image-modal-name"></div>
          <div class="rep-image-modal-actions">
            <a class="rep-btn" target="_blank" rel="noopener">Abrir en nueva pestaña</a>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      modal.querySelector('.rep-image-modal-close').addEventListener('click', closeImageModal);
      modal.querySelector('.rep-image-modal-backdrop').addEventListener('click', closeImageModal);
    }
    
    const img = modal.querySelector('.rep-image-modal-img');
    const nameEl = modal.querySelector('.rep-image-modal-name');
    const linkEl = modal.querySelector('.rep-image-modal-actions a');
    
    img.src = imageUrl;
    img.alt = imageName;
    nameEl.textContent = imageName;
    linkEl.href = imageUrl;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeImageModal(){
    const modal = qs('rep-image-modal');
    if(modal){
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if(!window.ReportesModule){
    window.ReportesModule = { init, destroy };
  }
})();
