(function(){
  const DEFAULT_RANGE = 30; // días
  const PAGE_SIZE = 400;
  const SUCCESS_STATES = ['verificado','aprobado','conciliado','completado','pagado','exitoso'];

  let initialized = false;
  const state = {
    rangeDays: DEFAULT_RANGE,
    loading: false,
    error: '',
    reportes: [],
    pagos: [],
    summary: {
      enviados: 0,
      abiertos: 0,
      respondidos: 0,
      informes: 0,
      abonados: 0,
      cobros: 0,
      monto: 0
    }
  };

  const qs = (id) => document.getElementById(id);

  function setLoading(on){
    state.loading = on;
    qs('sd-loading')?.classList.toggle('hidden', !on);
    qs('sd-content')?.classList.toggle('hidden', on);
  }

  function setError(msg){
    state.error = msg || '';
    const box = qs('sd-error');
    const text = qs('sd-error-text');
    if(box && text){
      text.textContent = msg || '';
      box.classList.toggle('hidden', !msg);
    }
  }

  function fmtNumber(n){
    return new Intl.NumberFormat('es-VE').format(n || 0);
  }

  function fmtMoney(n, currency){
    const val = Number(n || 0);
    if(!Number.isFinite(val)){ return '—'; }
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: currency || 'VES', maximumFractionDigits: 2 }).format(val);
  }

  function fmtDate(iso){
    if(!iso) return '—';
    try{
      return new Date(iso).toLocaleString('es-VE');
    }catch(_){ return iso; }
  }

  function computeSummary(){
    const reportes = state.reportes || [];
    const pagos = state.pagos || [];
    const success = new Set(SUCCESS_STATES);

    const enviados = reportes.filter(r => r.email_sent).length;
    const abiertos = reportes.filter(r => r.email_opened).length;
    const respondidos = reportes.filter(r => (r.estado_actual || '').toLowerCase() !== 'recibido' && r.estado_actual).length;
    const informes = reportes.filter(r => r.notificado === true).length;

    const pagosOk = pagos.filter(p => success.has((p.estado_pago || '').toLowerCase()));
    const cobros = pagosOk.length;
    const monto = pagosOk.reduce((acc, p) => acc + (Number(p.monto_pagado) || 0), 0);
    const abonados = Array.from(new Set(pagosOk.map(p => p.user_id).filter(Boolean))).length;

    state.summary = { enviados, abiertos, respondidos, informes, cobros, monto, abonados };
  }

  function renderSummary(){
    const s = state.summary;
    qs('sd-card-aperturas').textContent = fmtNumber(s.enviados);
    qs('sd-card-lecturas').textContent = fmtNumber(s.abiertos);
    qs('sd-card-respuestas').textContent = fmtNumber(s.respondidos);
    qs('sd-card-informes').textContent = fmtNumber(s.informes);
    qs('sd-card-abonados').textContent = fmtNumber(s.abonados);
    qs('sd-card-cobros').textContent = fmtNumber(s.cobros);
    qs('sd-card-monto').textContent = `Monto total: ${fmtMoney(s.monto)}`;
    qs('sd-card-aperturas-sub').textContent = 'Emails enviados';
    qs('sd-card-lecturas-sub').textContent = 'Emails abiertos';
    qs('sd-card-respuestas-sub').textContent = 'Casos con estado distinto de "Recibido"';
  }

  function renderList(containerId, rows, type){
    const wrap = qs(containerId);
    if(!wrap) return;
    wrap.innerHTML = '';
    if(!rows || rows.length === 0){
      wrap.innerHTML = '<div class="sd-empty">Sin registros en el rango seleccionado.</div>';
      return;
    }
    rows.slice(0, 6).forEach(row => {
      const div = document.createElement('div');
      div.className = 'sd-item';
      if(type === 'pagos'){
        div.innerHTML = `
          <div class="sd-item-main">
            <strong>${row.tipo_de_pago || 'Pago'}</strong>
            <span class="sd-chip muted">${fmtMoney(row.monto_pagado, row.moneda)}</span>
          </div>
          <div class="sd-item-meta">${row.estado_pago || '—'} • ${fmtDate(row.fecha_pago || row.created_at)}</div>
          <div class="sd-item-sub">Usuario: ${row.user_id || 'N/D'}</div>
        `;
      } else {
        div.innerHTML = `
          <div class="sd-item-main">
            <strong>${row.titulo || 'Reporte'}</strong>
            <span class="sd-chip ${row.estado_actual ? 'ok' : 'muted'}">${row.estado_actual || '—'}</span>
          </div>
          <div class="sd-item-meta">${row.nombre_completo || 'Anonimo'} • ${fmtDate(row.created_at)}</div>
          <div class="sd-item-sub">Instancia: ${row.instancia || 'N/D'}</div>
        `;
      }
      wrap.appendChild(div);
    });
  }

  async function fetchPaged(table, columns, fromIso, toIso){
    const supabase = window.App?.supabase;
    if(!supabase){ throw new Error('Supabase no disponible'); }
    let from = 0;
    let all = [];
    while(true){
      const { data, error } = await supabase
        .from(table)
        .select(columns, { count: 'exact' })
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if(error){ throw error; }
      all = all.concat(data || []);
      if(!data || data.length < PAGE_SIZE){ break; }
      from += PAGE_SIZE;
    }
    return all;
  }

  async function loadData(){
    setLoading(true);
    setError('');
    const now = new Date();
    const toIso = now.toISOString();
    const from = new Date(now.getTime() - state.rangeDays * 24 * 60 * 60 * 1000);
    const fromIso = from.toISOString();

    try {
      const [reportes, pagos] = await Promise.all([
        fetchPaged('kpi_data_sofia.reportes', 'id,created_at,user_id,estado_actual,email_sent,email_opened,notificado,titulo,nombre_completo,instancia', fromIso, toIso),
        fetchPaged('instancia_sofia.pagos', 'id,created_at,user_id,estado_pago,monto_pagado,moneda,fecha_pago,tipo_de_pago', fromIso, toIso)
      ]);
      state.reportes = reportes;
      state.pagos = pagos;
      computeSummary();
      renderSummary();
      renderList('sd-pagos-list', pagos, 'pagos');
      renderList('sd-reportes-list', reportes, 'reportes');
      qs('sd-pagos-count').textContent = `${fmtNumber(pagos.length)} pagos`;
      qs('sd-reportes-count').textContent = `${fmtNumber(reportes.length)} reportes`;
      qs('sd-content')?.classList.remove('hidden');
    } catch(err){
      console.error('Error cargando dashboard Sofía:', err);
      setError(err?.message || 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }

  function bindEvents(){
    const rangeSel = qs('sd-range');
    if(rangeSel){
      rangeSel.value = String(state.rangeDays);
      rangeSel.addEventListener('change', () => {
        state.rangeDays = Number(rangeSel.value) || DEFAULT_RANGE;
        loadData();
      });
    }
    qs('sd-refresh')?.addEventListener('click', loadData);
  }

  function denyAccess(){
    const root = document.getElementById('sofia-dashboard-module');
    if(root){
      root.innerHTML = `
        <div class="sd-denied">
          <div class="sd-empty">🔒 No tienes permisos para ver este módulo.</div>
        </div>
      `;
    }
  }

  async function init(){
    const hasView = window.App?.hasPerm ? window.App.hasPerm('dashboard.sofia.view') : true;
    if(!hasView){ denyAccess(); return; }
    if(initialized){ return; }
    initialized = true;

    // Cargar hoja de estilos del módulo
    try{
      if(!document.querySelector('link[data-sd-style="1"]')){
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'modules/sofia-dashboard/styles.css';
        l.setAttribute('data-sd-style','1');
        document.head.appendChild(l);
      }
    }catch(_){/* ignore */}

    bindEvents();
    loadData();
  }

  window.SofiaDashboardModule = { init };
})();
