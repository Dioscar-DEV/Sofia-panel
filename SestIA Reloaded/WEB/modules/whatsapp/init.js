// Función global para seleccionar elementos por id
function qs(id){ return document.getElementById(id); }
// Función global para logs visuales
function addLog(message, type = 'info') {
  const logContainer = document.getElementById('wsp-loading-logs');
  if(!logContainer) return;
  const timestamp = new Date().toLocaleTimeString('es-ES');
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '🔵';
  const color = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : type === 'warning' ? '#ea580c' : '#3b82f6';
  const logLine = document.createElement('div');
  logLine.style.cssText = `margin-bottom: 0.25rem; color: ${color};`;
  logLine.textContent = `[${timestamp}] ${icon} ${message}`;
  logContainer.appendChild(logLine);
  logContainer.scrollTop = logContainer.scrollHeight;
}

(function(){
  let initialized = false;

  // Estado del módulo
  const state = {
    config: {
      channelId: '',
      campaignTitle: '',
      token: '',
      phoneId: '',
      apiUrl: '',
      templateName: '',
      language: 'es'
    },
    channels: [], // Canales disponibles desde Supabase
    csvData: [],
    currentFile: null,
    sending: false,
    cancelled: false,
    stats: {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0
    },
    logs: []
  };



  function addLog(message, type = 'info'){
    const logContainer = qs('wsp-loading-logs');
    if(!logContainer) return;
    
    const timestamp = new Date().toLocaleTimeString('es-ES');
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '🔵';
    const color = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : type === 'warning' ? '#ea580c' : '#3b82f6';
    
    const logLine = document.createElement('div');
    logLine.style.cssText = `margin-bottom: 0.25rem; color: ${color};`;
    logLine.textContent = `[${timestamp}] ${icon} ${message}`;
    
    logContainer.appendChild(logLine);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function setError(message){
    const errorWrap = qs('wsp-error');
    const errorText = qs('wsp-error-text');
    if(errorWrap && errorText){
      errorText.textContent = message || '';
      errorWrap.classList.toggle('hidden', !message);
    }
  }

  function showPanel(panelId, show = true){
    const panel = qs(panelId);
    if(panel) panel.classList.toggle('hidden', !show);
  }

  function openModal(modalId){
    const modal = qs(modalId);
    if(modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      // Accesibilidad: el modal activo no debe estar oculto
      modal.setAttribute('aria-hidden', 'false');
      // Enfocar botón de cerrar si existe
      const closeBtn = modal.querySelector('.wsp-modal-close');
      if(closeBtn) {
        try { closeBtn.focus(); } catch(_){}
      }
    }
  }

  function closeModal(modalId){
    const modal = qs(modalId);
    if(modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // Manejadores de eventos para modales
  function setupModalHandlers(){
    // Cerrar modal al hacer clic en overlay o botón cerrar
    document.addEventListener('click', (e) => {
      const closeTarget = e.target.getAttribute('data-close');
      if(closeTarget){
        e.preventDefault();
        closeModal(closeTarget);
        return;
      }

      // Cerrar modal si se hace clic en el overlay
      if(e.target.classList.contains('wsp-modal-overlay')){
        const modal = e.target.closest('.wsp-modal');
        if(modal && modal.classList.contains('active')){
          closeModal(modal.id);
        }
      }
    });

    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        const activeModal = qs('.wsp-modal.active');
        if(activeModal){
          closeModal(activeModal.id);
        }
      }
    });
  }

  // ==================== CHANNELS LOADING ====================
  async function loadChannels(){
    try {
      console.log('🛰️ loadChannels() iniciado');
      addLog('Iniciando carga de buzones...');
      
      if(!window.App || !window.App.supabase){
        console.error('Supabase client no está disponible');
        addLog('Error: Cliente de base de datos no disponible', 'error');
        setError('Error: Cliente de base de datos no disponible');
        // Forzar visibilidad del panel y selector aunque falle la carga
        showPanel('wsp-config-panel', true);
        const selector = qs('wsp-channel-selector');
        if(selector) selector.disabled = false;
        return;
      }

      addLog('Consultando canales de WhatsApp en Supabase...');
      console.log('🔍 Consultando canales de WhatsApp...');

      // Consultar la tabla instancia_sofia.instancias_inputs (filtrando por canal ID = 14)
        const { data, error } = await (window.App.supabase.schema ? window.App.supabase.schema('instancia_sofia') : window.App.supabase)
          .from('instancias_inputs')
          .select('*')
          .eq('canal', 14)
          .order('custom_name', { ascending: true });

      if(error){
        console.error('❌ Error cargando canales:', error);
        addLog(`Error al cargar canales: ${error.message}`, 'error');
        setError('Error al cargar los canales de WhatsApp: ' + error.message);
        // Forzar visibilidad del panel y selector aunque falle la carga
        showPanel('wsp-config-panel', true);
        const selector = qs('wsp-channel-selector');
        if(selector) selector.disabled = false;
        return;
      }

      console.log('📊 Datos recibidos:', data);

      state.channels = data || [];
      
      addLog(`${state.channels.length} canal(es) encontrado(s)`, state.channels.length > 0 ? 'success' : 'warning');
      
      if(state.channels.length > 0){
        // Mostrar detalles de cada canal
        state.channels.forEach(channel => {
          addLog(`  • Buzón: ${channel.custom_name}`, 'success');
        });
      }
      
      populateChannelSelector();
      console.log(`✅ ${state.channels.length} canales cargados`);
      
      if(state.channels.length === 0){
        console.warn('⚠️ No hay canales de WhatsApp configurados');
        addLog('No hay buzones configurados. Contacta al administrador.', 'warning');
        setError('No hay buzones de WhatsApp configurados. Por favor configura uno en la base de datos.');
        // Forzar visibilidad del panel y selector aunque no haya canales
        showPanel('wsp-config-panel', true);
        const selector = qs('wsp-channel-selector');
        if(selector) selector.disabled = false;
      } else {
        addLog('Buzones cargados correctamente. Puedes seleccionar uno.', 'success');
      }
    } catch(e){
      console.error('❌ Error en loadChannels:', e);
      addLog(`Error crítico: ${e.message}`, 'error');
      setError('Error al cargar los canales: ' + e.message);
    }
  }

  function populateChannelSelector(){
    const selector = qs('wsp-channel-selector');
    if(!selector) {
      console.error('❌ FATAL: No se encontró el elemento ID "wsp-channel-selector" en el HTML.');
      addLog('Error de interfaz: No se encontró el selector de buzones.', 'error');
      return;
    }

    // Limpiar opciones existentes excepto la primera
    selector.innerHTML = '<option value="">Seleccionar buzón...</option>';

    let count = 0;
    state.channels.forEach(channel => {
      const option = document.createElement('option');
      option.value = channel.nameid;
      option.textContent = channel.custom_name;
      option.dataset.channelData = JSON.stringify(channel);
      selector.appendChild(option);
      count++;
    });

    // Desocultar panel de configuración y habilitar selector
    showPanel('wsp-config-panel', true);
    selector.disabled = false;
    addLog(`Selector listo. Opciones cargadas: ${count}`, 'success');

    // Auto-seleccionar el primer canal si existe
    if(count > 0){
      const first = state.channels[0];
      selector.value = first.nameid;
      addLog(`Auto-seleccionado: ${first.custom_name}`, 'info');
      // Disparar el handler para cargar token/phone
      const event = new Event('change');
      selector.dispatchEvent(event);
    }
  }

  function parseChannelKey(keyString){
    // El formato es: {token},{phone_id},{idWaba}
    if(!keyString) return {};
    const parts = keyString.split(',').map(p => p.trim()).filter(Boolean);
    return {
      token: parts[0] || '',
      phone_id: parts[1] || '',
      idWaba: parts[2] || ''
    };
  }

  // ==================== TEMPLATE MODAL CONFIGURATION ====================
  let lastTemplates = [];

  function getCurrentTemplate() {
    const templateSelector = qs('wsp-template-selector');
    if(!templateSelector || !templateSelector.value) return null;

    const option = templateSelector.options[templateSelector.selectedIndex];
    if(!option || !option.dataset.template) return null;

    try {
      return JSON.parse(option.dataset.template);
    } catch (error) {
      console.error('Error al parsear template:', error);
      return null;
    }
  }

  function extractTemplateVariables(template) {
    const variables = [];
    const components = template.components || [];

    components.forEach(component => {
      if(component.type === 'HEADER' && component.format === 'TEXT' && component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if(matches) {
          matches.forEach(match => {
            const index = match.replace(/\{|\}/g, '');
            variables.push({
              index,
              name: 'Encabezado',
              type: 'text',
              example: 'Nombre del cliente',
              component: 'header'
            });
          });
        }
      }

      if(component.type === 'BODY' && component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if(matches) {
          matches.forEach(match => {
            const index = match.replace(/\{|\}/g, '');
            variables.push({
              index,
              name: 'Cuerpo del mensaje',
              type: component.text.length > 100 ? 'textarea' : 'text',
              example: 'Contenido personalizado',
              component: 'body'
            });
          });
        }
      }

      if(component.type === 'FOOTER' && component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if(matches) {
          matches.forEach(match => {
            const index = match.replace(/\{|\}/g, '');
            variables.push({
              index,
              name: 'Pie de mensaje',
              type: 'text',
              example: 'Información adicional',
              component: 'footer'
            });
          });
        }
      }
    });

    // Eliminar duplicados por índice
    const uniqueVars = variables.filter((v, i, arr) =>
      arr.findIndex(item => item.index === v.index) === i
    );

    return uniqueVars.sort((a, b) => parseInt(a.index) - parseInt(b.index));
  }

  function updateTemplatePreview(template) {
    const headerEl = qs('wsp-modal-header');
    const bodyEl = qs('wsp-modal-body');
    const footerEl = qs('wsp-modal-footer');

    if(!template || !template.components) return;

    // Limpiar contenido anterior
    if(headerEl) headerEl.textContent = '';
    if(bodyEl) bodyEl.textContent = '';
    if(footerEl) footerEl.textContent = '';

    // Obtener valores de variables
    const variableValues = {};
    const varInputs = document.querySelectorAll('[data-var-index]');
    varInputs.forEach(input => {
      const index = input.getAttribute('data-var-index');
      variableValues[index] = input.value || `{{${index}}}`;
    });

    template.components.forEach(component => {
      switch(component.type) {
        case 'HEADER':
          if(headerEl && component.format === 'TEXT') {
            let headerText = component.text || '';
            // Reemplazar variables
            Object.keys(variableValues).forEach(index => {
              const regex = new RegExp(`\\{\\{${index}\\}\\}`, 'g');
              headerText = headerText.replace(regex, variableValues[index]);
            });
            headerEl.textContent = headerText;
          }
          break;

        case 'BODY':
          if(bodyEl) {
            let bodyText = component.text || '';
            // Reemplazar variables
            Object.keys(variableValues).forEach(index => {
              const regex = new RegExp(`\\{\\{${index}\\}\\}`, 'g');
              bodyText = bodyText.replace(regex, variableValues[index]);
            });
            bodyEl.textContent = bodyText;
          }
          break;

        case 'FOOTER':
          if(footerEl) {
            let footerText = component.text || '';
            // Reemplazar variables
            Object.keys(variableValues).forEach(index => {
              const regex = new RegExp(`\\{\\{${index}\\}\\}`, 'g');
              footerText = footerText.replace(regex, variableValues[index]);
            });
            footerEl.textContent = footerText;
          }
          break;
      }
    });
  }

  function generateVariableConfig(template) {
    const varsContainer = qs('wsp-modal-vars');
    if(!varsContainer) return;

    varsContainer.innerHTML = '';

    // Extraer variables del template
    const variables = extractTemplateVariables(template);

    if(variables.length === 0) {
      varsContainer.innerHTML = '<p style="color: var(--text-muted); font-style: italic; text-align: center; padding: 2rem;">Esta plantilla no tiene variables configurables.</p>';
      return;
    }

    variables.forEach((variable, index) => {
      const varGroup = document.createElement('div');
      varGroup.className = 'wsp-modal-var-group';

      const label = document.createElement('label');
      label.textContent = `Variable {{${variable.index}}}: ${variable.name || `Parámetro ${variable.index}`}`;

      const input = document.createElement(variable.type === 'textarea' ? 'textarea' : 'input');
      input.type = variable.type === 'textarea' ? undefined : 'text';
      input.placeholder = variable.example || `Ingresa el valor para {{${variable.index}}}`;
      input.value = variable.default || '';
      input.setAttribute('data-var-index', variable.index);

      if(variable.type === 'textarea') {
        input.rows = 3;
      }

      // Event listener para actualizar preview en tiempo real
      input.addEventListener('input', () => updateTemplatePreview(template));

      varGroup.appendChild(label);
      varGroup.appendChild(input);

      if(variable.description) {
        const desc = document.createElement('div');
        desc.className = 'var-description';
        desc.textContent = variable.description;
        varGroup.appendChild(desc);
      }

      varsContainer.appendChild(varGroup);
    });
  }

  async function showTemplatePreview(){
    const selectedTemplate = getCurrentTemplate();
    if(!selectedTemplate){
      addLog('No hay plantilla seleccionada', 'warning');
      return;
    }

    try {
      addLog(`Mostrando configuración para: ${selectedTemplate.name}`, 'info');

      // Abrir modal
      openModal('wsp-message-config-modal');

      // Actualizar información de la plantilla
      const templateNameEl = qs('wsp-modal-template-name');
      const templateLangEl = qs('wsp-modal-template-lang');
      const templateCategoryEl = qs('wsp-modal-template-category');

      if(templateNameEl) templateNameEl.textContent = selectedTemplate.name;
      if(templateLangEl) templateLangEl.textContent = selectedTemplate.language;
      if(templateCategoryEl) templateCategoryEl.textContent = selectedTemplate.category || 'MARKETING';

      // Generar configuración de variables
      generateVariableConfig(selectedTemplate);

      // Actualizar preview inicial
      updateTemplatePreview(selectedTemplate);

    } catch (error) {
      console.error('Error al mostrar preview:', error);
      addLog(`Error al mostrar configuración: ${error.message}`, 'error');
    }
  }

  function onChannelSelect(event){
    const selectedOption = event.target.options[event.target.selectedIndex];
    if(!selectedOption || !selectedOption.dataset.channelData){
      return;
    }

    try {
      const channelData = JSON.parse(selectedOption.dataset.channelData);

      // Parsear el campo key (SIN mostrar información sensible)
      const keyData = parseChannelKey(channelData.key || '');

      // Auto-rellenar los campos técnicos (ocultos en la interfaz)
      state.config.channelId = channelData.nameid;
      state.config.canal = channelData.canal; // Guardar canal (ID numérico) para API de colas
      state.config.token = keyData.token || '';
      state.config.phoneId = keyData.phone_id || '';
      state.config.idWaba = keyData.idWaba || '';
      state.config.apiUrl = 'https://smart-whatsapp-api-fibex-production-d80a.up.railway.app/enviar-mensaje';

      // Solo mostrar nombre del buzón en logs
      addLog(`Buzón seleccionado: ${channelData.custom_name}`, 'success');
      setError('');

      if(!state.config.idWaba || !state.config.token){
        addLog('No se puede consultar plantillas: falta idWaba o token', 'error');
        addLog('Sugerencia: agregue el idWaba como tercer valor en "key": token, phone_id, idWaba', 'warning');
        populateTemplateSelector([]);
        return;
      }

      addLog('Consultando plantillas disponibles...', 'info');
      fetchTemplatesForWaba(state.config.idWaba, state.config.token);
      // ==================== CONSULTA DE PLANTILLAS ====================
      async function fetchTemplatesForWaba(idWaba, token){
        if(!idWaba || !token){
          addLog('No se puede consultar plantillas: falta idWaba o token', 'error');
          return;
        }
        try {
          addLog('Consultando plantillas de WhatsApp...');
          const url = `https://graph.facebook.com/v21.0/${idWaba}/message_templates?fields=name,status,language,components,category&limit=100`;
          const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
          });
          addLog(`Status HTTP: ${resp.status}`, resp.ok ? 'info' : 'error');
          if(!resp.ok){
            addLog('No se pudo conectar con la API de Meta. Revisa el token y permisos.', 'error');
            console.error('Error HTTP Meta:', await resp.text());
            populateTemplateSelector([]);
            return;
          }
          const json = await resp.json();
          if(json.data && Array.isArray(json.data) && json.data.length > 0){
            populateTemplateSelector(json.data);
            addLog(`Plantillas recibidas: ${json.data.length}`, 'success');
          } else {
            addLog('No se recibieron plantillas o el formato es incorrecto', 'warning');
            populateTemplateSelector([]);
          }
        } catch(e){
          addLog('Error consultando plantillas: ' + e.message, 'error');
          console.error('Error fetchTemplatesForWaba:', e);
          populateTemplateSelector([]);
        }
      }

      function populateTemplateSelector(templates){
        lastTemplates = templates;
        const selector = qs('wsp-template-selector');
        if(!selector) return;
        selector.innerHTML = '<option value="">Seleccionar plantilla...</option>';
        templates.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.name;
          opt.textContent = `${t.name} (${t.language}) [${t.category}]`;
          opt.dataset.template = JSON.stringify(t);
          selector.appendChild(opt);
        });
        // Eliminar listeners previos para evitar duplicados
        selector.onchange = null;
        selector.addEventListener('change', e => {
          if(e.target.value) {
            // Guardar selección en config para el envío
            state.config.templateName = e.target.value;
            try {
              const opt = e.target.options[e.target.selectedIndex];
              const tmpl = opt?.dataset?.template ? JSON.parse(opt.dataset.template) : null;
              if (tmpl?.language) state.config.language = tmpl.language;
            } catch(_){ }
            // Cambiar a showTemplatePreview sin parámetros
            showTemplatePreview();
          }
        });
      }
    } catch(e){
      console.error('Error parseando datos del canal:', e);
      setError('Error al cargar la configuración del buzón');
    }
  }

  // ==================== CONFIG ====================
  function saveConfig(){
    state.config.channelId = qs('wsp-channel-selector')?.value || '';
    state.config.campaignTitle = qs('wsp-campaign-title')?.value.trim() || '';
    // Tomar del selector dinámico con fallback
    state.config.templateName = qs('wsp-template-selector')?.value || state.config.templateName || 'servicio_suspendido';
    state.config.language = qs('wsp-language')?.value || 'es';

    if(!state.config.channelId){
      setError('Por favor selecciona un buzón de envío');
      addLog('Error: Debes seleccionar un buzón', 'error');
      return false;
    }

    if(!state.config.campaignTitle){
      setError('Por favor ingresa un título para la campaña');
      addLog('Error: Debes ingresar un título', 'error');
      return false;
    }

    // Guardar en localStorage
    localStorage.setItem('wsp_config', JSON.stringify(state.config));
    setError('');
    addLog('Configuración guardada correctamente', 'success');
    alert('✅ Configuración guardada correctamente');
    return true;
  }

  function loadConfig(){
    try {
      const saved = localStorage.getItem('wsp_config');
      if(saved){
        const config = JSON.parse(saved);
        state.config = config;
        
        if(qs('wsp-channel-selector')) qs('wsp-channel-selector').value = config.channelId || '';
        if(qs('wsp-campaign-title')) qs('wsp-campaign-title').value = config.campaignTitle || '';
        if(qs('wsp-template-selector')) qs('wsp-template-selector').value = config.templateName || '';
        if(qs('wsp-language')) qs('wsp-language').value = config.language || 'es';
      }
    } catch(e){
      console.error('Error cargando config:', e);
    }
  }

  // ==================== FILE HANDLING ====================
  function handleFileSelect(file){
    if(!file || !file.name.endsWith('.csv')){
      setError('Por favor selecciona un archivo CSV válido');
      return;
    }

    state.currentFile = file;
    
    // Mostrar info del archivo
    if(qs('wsp-file-name')) qs('wsp-file-name').textContent = file.name;
    if(qs('wsp-file-size')) qs('wsp-file-size').textContent = formatBytes(file.size);
    showPanel('wsp-file-info', true);

    // Leer y parsear CSV
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target.result);
    reader.onerror = () => setError('Error leyendo el archivo');
    reader.readAsText(file);
  }

  function parseCSV(text){
    try {
      // Parser simple con soporte para comillas dobles y comas en valores
      const rows = [];
      let i = 0, field = '', row = [], inQuotes = false;
      const pushField = () => { row.push(field); field = ''; };
      const pushRow = () => { rows.push(row); row = []; };
      for (; i < text.length; i++){
        const ch = text[i];
        if (inQuotes){
          if (ch === '"'){
            if (text[i+1] === '"'){ field += '"'; i++; }
            else { inQuotes = false; }
          } else {
            field += ch;
          }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { pushField(); }
          else if (ch === '\n' || ch === '\r'){
            // soporte CRLF/ LF
            if (ch === '\r' && text[i+1] === '\n') i++;
            pushField();
            pushRow();
          } else { field += ch; }
        }
      }
      // último campo/fila si quedó algo
      if (field.length > 0 || row.length > 0){ pushField(); pushRow(); }

      // Eliminar filas vacías
      const trimmedRows = rows.filter(r => r.join('').trim().length > 0);
      if (trimmedRows.length < 2){
        setError('El CSV debe tener encabezados y al menos una fila de datos');
        return;
      }

      // Procesar encabezados
      let headers = trimmedRows[0].map(h => (h || '').trim());
      if (headers[0].charCodeAt(0) === 0xFEFF){
        headers[0] = headers[0].replace(/^\uFEFF/, '');
      }
      const headersLc = headers.map(h => h.toLowerCase());

      // Validaciones obligatorias
      const required = ['numero','cedula','estatus_servicio'];
      const missing = required.filter(k => !headersLc.includes(k));
      if (missing.length){
        setError(`Faltan columnas obligatorias en el CSV: ${missing.join(', ')}`);
        return;
      }

      const data = [];
      for (let r = 1; r < trimmedRows.length; r++){
        const values = trimmedRows[r];
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = (values[idx] ?? '').toString().trim(); });

        // Normalizar numero (mantener solo dígitos)
        if (obj.numero) obj.numero = obj.numero.replace(/\D+/g, '');
        // Normalizar estatus_servicio
        if (obj.estatus_servicio){
          obj.estatus_servicio = obj.estatus_servicio.toLowerCase();
          const allowed = ['activo','cortado','suspendido'];
          if (!allowed.includes(obj.estatus_servicio)){
            addLog('❌', `Fila ${r}: estatus_servicio inválido: ${obj.estatus_servicio}`, 'error');
            continue; // descartar fila inválida
          }
        }

        // Requisito mínimo: numero, cedula, estatus_servicio
        if (obj.numero && obj.cedula && obj.estatus_servicio){
          data.push(obj);
        }
      }

      if (data.length === 0){
        setError('No se encontraron filas válidas con numero, cedula y estatus_servicio');
        return;
      }

      state.csvData = data;
      renderPreview(headers, data);
      setError('');
    } catch(e){
      console.error('Error parseando CSV:', e);
      setError('Error al procesar el archivo CSV');
    }
  }

  function renderPreview(headers, data){
    const previewTable = qs('wsp-preview-table');
    if(!previewTable) return;

    const preview = data.slice(0, 5);
    let html = '<table><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    
    preview.forEach(row => {
      html += '<tr>';
      headers.forEach(h => html += `<td>${row[h] || '-'}</td>`);
      html += '</tr>';
    });
    html += '</tbody></table>';
    
    previewTable.innerHTML = html;
    
    if(qs('wsp-total-rows')){
      qs('wsp-total-rows').textContent = `Total de registros: ${data.length}`;
    }
    
    showPanel('wsp-preview', true);
  }

  function clearFile(){
    state.currentFile = null;
    state.csvData = [];
    showPanel('wsp-file-info', false);
    showPanel('wsp-preview', false);
    if(qs('wsp-file-input')) qs('wsp-file-input').value = '';
  }

  // ==================== SENDING WITH QUEUE (NUEVO) ====================
  async function startSendingWithQueue(){
    // Validar configuración
    if(!state.config.channelId || !state.config.token || !state.config.phoneId){
      setError('Por favor selecciona un buzón de envío primero');
      return;
    }

    if(!state.config.templateName){
      setError('Por favor ingresa el nombre de la plantilla');
      return;
    }

    if(!state.config.campaignTitle){
      setError('Por favor ingresa un título para la campaña');
      return;
    }

    if(state.csvData.length === 0){
      setError('Por favor carga un archivo CSV con destinatarios');
      return;
    }

    // Mostrar panel de progreso
    state.sending = true;
    state.cancelled = false;
    state.stats = {
      total: state.csvData.length,
      success: 0,
      failed: 0,
      pending: state.csvData.length
    };
    state.logs = [];
    
    showPanel('wsp-progress-panel', true);
    updateStats();
    clearLog();
    
    const startBtn = qs('wsp-start-send-queue');
    if(startBtn) startBtn.disabled = true;

    try {
      addLog('🚀', 'Preparando envío con sistema de colas (procesamiento paralelo)...', 'info');
      
      // Convertir csvData a Blob
      const csvHeader = 'numero,cedula,variable1,variable2,variable3\n';
      const csvRows = state.csvData.map(row => {
        return `${row.numero || ''},${row.cedula || ''},${row.variable1 || ''},${row.variable2 || ''},${row.variable3 || ''}`;
      }).join('\n');
      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      // Crear FormData
      const formData = new FormData();
      formData.append('archivo_csv', blob, 'campana.csv');
      formData.append('titulo_campana', state.config.campaignTitle);
      formData.append('plantilla', state.config.templateName);
      formData.append('buzon', state.config.canal); // Enviar canal (ID numérico)
      formData.append('idioma', state.config.language || 'es');
      formData.append('estatus', state.config.status || 'pendiente'); // Nuevo campo estatus

      // Log para debugging
      console.log('📤 Enviando a API:', {
        titulo_campana: state.config.campaignTitle,
        plantilla: state.config.templateName,
        buzon: state.config.canal, // canal (ID numérico, ej: 14)
        idioma: state.config.language || 'es',
        estatus: state.config.status || 'pendiente',
        rows: state.csvData.length
      });

      addLog('📤', `Enviando ${state.csvData.length} mensajes a la cola...`, 'info');

      // Llamar a la API de colas
      const response = await fetch('https://api-gestor-de-colas-para-campanas-whatsapp-production.up.railway.app/api/crear-campana', {
        method: 'POST',
        body: formData
      });

      if(!response.ok){
        const error = await response.json();
        throw new Error(error.detail || 'Error al crear campaña');
      }

      const result = await response.json();

      addLog('✅', `Campaña creada: ${result.campaign_id}`, 'success');
      addLog('📊', `Total de mensajes en cola: ${result.total_mensajes}`, 'info');
      addLog('⚡', 'Los mensajes se están procesando en paralelo (100x más rápido)', 'success');
      
      // Iniciar monitoreo del estado
      monitorCampaignStatus(result.campaign_id);

    } catch(error){
      console.error('Error en envío con cola:', error);
      addLog('❌', `Error: ${error.message}`, 'error');
      state.sending = false;
      if(startBtn) startBtn.disabled = false;
    }
  }

  // Monitorear estado de la campaña
  async function monitorCampaignStatus(campaignId){
    const checkInterval = 2000; // Revisar cada 2 segundos
    const maxChecks = 300; // Máximo 10 minutos
    let checks = 0;

    const monitor = setInterval(async () => {
      if(state.cancelled || checks >= maxChecks){
        clearInterval(monitor);
        state.sending = false;
        const startBtn = qs('wsp-start-send-queue');
        if(startBtn) startBtn.disabled = false;
        return;
      }

      checks++;

      try {
        const response = await fetch(`https://api-gestor-de-colas-para-campanas-whatsapp-production.up.railway.app/api/estado-cola/${campaignId}`);
        const status = await response.json();

        // Actualizar stats
        state.stats.success = status.exitosos || 0;
        state.stats.failed = status.fallidos || 0;
        state.stats.pending = status.pendientes || 0;
        state.stats.total = status.total || 0;
        updateStats();

        // Si ya terminó
        if(status.pendientes === 0){
          clearInterval(monitor);
          state.sending = false;
          const startBtn = qs('wsp-start-send-queue');
          if(startBtn) startBtn.disabled = false;
          
          if(status.exitosos === status.total){
            addLog('🎉', `¡Campaña completada! ${status.exitosos} mensajes enviados exitosamente`, 'success');
          } else {
            addLog('⚠️', `Campaña finalizada: ${status.exitosos} exitosos, ${status.fallidos} fallidos`, 'warning');
          }
        }

      } catch(error){
        console.error('Error monitoreando campaña:', error);
      }
    }, checkInterval);
  }

  // ==================== SENDING (LEGACY - DIRECTO) ====================
  async function startSending(){
    // Validar que se hayan configurado los datos necesarios
    if(!state.config.channelId || !state.config.token || !state.config.phoneId){
      setError('Por favor selecciona un buzón de envío primero');
      return;
    }

    if(!state.config.templateName){
      setError('Por favor ingresa el nombre de la plantilla');
      return;
    }

    if(state.csvData.length === 0){
      setError('Por favor carga un archivo CSV con destinatarios');
      return;
    }

    state.sending = true;
    state.cancelled = false;
    state.stats = {
      total: state.csvData.length,
      success: 0,
      failed: 0,
      pending: state.csvData.length
    };
    state.logs = [];

    // Mostrar panel de progreso
    showPanel('wsp-progress-panel', true);
    updateStats();
    clearLog();

    // Deshabilitar botón de inicio
    const startBtn = qs('wsp-start-send');
    if(startBtn) startBtn.disabled = true;

    // Procesar cada fila
    for(let i = 0; i < state.csvData.length; i++){
      if(state.cancelled){
        addLog('⚠️', 'Envío cancelado por el usuario', 'warning');
        break;
      }

      const row = state.csvData[i];
      await sendMessage(row, i + 1);
      
      // Delay de 2 segundos entre mensajes
      if(i < state.csvData.length - 1 && !state.cancelled){
        await sleep(2000);
      }
    }

    state.sending = false;
    if(startBtn) startBtn.disabled = false;
    
    if(!state.cancelled){
      addLog('✅', 'Envío completado', 'success');
    }
  }

  async function sendMessage(row, index){
    const { numero, variable1, variable2, variable3, variable4 } = row;
    
    if(!numero){
      state.stats.failed++;
      state.stats.pending--;
      updateStats();
      addLog('❌', `Fila ${index}: Sin número de teléfono`, 'error');
      return;
    }

    // Preparar variables (filtrar vacíos)
    const variables = [variable1, variable2, variable3, variable4].filter(v => v);

    // Registrar lead en BD antes de enviar
    try {
      const leadId = await insertLeadRecord(row);
      if (leadId) row.__lead_id = leadId;
    } catch (e){
      console.warn('No se pudo registrar lead:', e?.message || e);
      addLog('⚠️', `Fila ${index}: No se pudo registrar en BD (${e.message || 'error desconocido'})`, 'warning');
    }

    // Preparar body de la request (formato exacto que espera la API)
    const body = {
      token: state.config.token,
      phone_id: state.config.phoneId,
      numero: numero,
      template_name: state.config.templateName
    };

    // Solo agregar variables si existen
    if(variables.length > 0) body.variables = variables;

    // Debug: mostrar body en consola
    console.log('📤 Enviando request:', JSON.stringify(body, null, 2));

    try {
      // 🔧 Llamada directa a la API (sin proxy CORS)
      const response = await fetch(state.config.apiUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if(response.ok && result.status === 'success'){
        state.stats.success++;
        state.stats.pending--;
        updateStats();
        addLog('✅', `${numero} - Enviado correctamente (ID: ${result.id || 'N/A'})`, 'success');
        // Asegurar inserción y actualizar metadata de envío (éxito)
        try {
          if (!row.__lead_id) {
            const leadId = await insertLeadRecord(row);
            if (leadId) row.__lead_id = leadId;
          }
          if (row.__lead_id) {
            await updateLeadSendResult(row.__lead_id, { success: true, wamid: result.id || null });
          }
        } catch (e){
          console.warn('No se pudo registrar/actualizar el lead (éxito):', e?.message || e);
        }
      } else {
        throw new Error(result.meta_error || result.message || 'Error desconocido');
      }
    } catch(error){
      state.stats.failed++;
      state.stats.pending--;
      updateStats();
      addLog('❌', `${numero} - Error: ${error.message}`, 'error');
      // Asegurar inserción y actualizar metadata de envío (fallo)
      try {
        if (!row.__lead_id) {
          const leadId = await insertLeadRecord(row);
          if (leadId) row.__lead_id = leadId;
        }
        if (row.__lead_id) {
          await updateLeadSendResult(row.__lead_id, { success: false, errorMessage: error.message });
        }
      } catch (e){
        console.warn('No se pudo registrar/actualizar el lead (fallo):', e?.message || e);
      }
    }
  }

  async function insertLeadRecord(row){
    const supabase = window.App?.supabase;
    if (!supabase) throw new Error('Supabase no disponible');

    // Campos base
    const user_id = row.numero;
    const nombre_cliente = row.variable1 || '';
    const canal = state.config.channelId || 'whatsapp';
    const titulo_anuncio = state.config.campaignTitle || '';
    const estado = 'pendiente';
    const cedula = row.cedula || null;
    const estatus_servicio = (row.estatus_servicio || '').toLowerCase();
    const saldo = row.variable2 || null;

    // Construir metadata con campos adicionales dinámicos
    const baseKeys = new Set(['numero','cedula','estatus_servicio','variable1','variable2','url_imagen']);
    const metadata = {};
    Object.keys(row).forEach(k => {
      if (!baseKeys.has(k)){
        // Incluir variable3,4,5... y cualquier campo extra (franquicia, etc.)
        metadata[k] = row[k];
      }
    });
    // Campo de control de envío siempre presente
    if (typeof metadata.envio_exitoso === 'undefined') metadata.envio_exitoso = false;
    if (typeof metadata.envio_intentos === 'undefined') metadata.envio_intentos = 0;

    const payload = {
      user_id,
      nombre_cliente,
      canal,
      titulo_anuncio,
      estado,
      metadata,
      cedula,
      estatus_servicio,
      saldo
    };

    const { data, error } = await (supabase.schema ? supabase.schema('instancia_sofia') : supabase)
      .from('leads_activos')
      .insert(payload)
      .select('id, metadata')
      .single();
    if (error) throw error;
    return data?.id;
  }

  async function updateLeadSendResult(leadId, { success, wamid = null, errorMessage = null }){
    const supabase = window.App?.supabase;
    if (!supabase || !leadId) return;

    try {
      // Leer metadata actual
      const { data: existing, error: selErr } = await (supabase.schema ? supabase.schema('instancia_sofia') : supabase)
        .from('leads_activos')
        .select('id, metadata')
        .eq('id', leadId)
        .single();
      if (selErr) throw selErr;

      const prev = existing?.metadata || {};
      const intentos = (prev.envio_intentos || 0) + 1;
      const merged = {
        ...prev,
        envio_exitoso: !!success,
        envio_intentos: intentos,
        envio_wamid: wamid || prev.envio_wamid || null,
        envio_error: success ? null : (errorMessage || 'error'),
        envio_fecha: new Date().toISOString()
      };

      const { error: updErr } = await (supabase.schema ? supabase.schema('instancia_sofia') : supabase)
        .from('leads_activos')
        .update({ metadata: merged })
        .eq('id', leadId);
      if (updErr) throw updErr;
    } catch (e){
      console.warn('updateLeadSendResult error:', e?.message || e);
    }
  }

  function updateStats(){
    if(qs('wsp-stat-total')) qs('wsp-stat-total').textContent = state.stats.total;
    if(qs('wsp-stat-success')) qs('wsp-stat-success').textContent = state.stats.success;
    if(qs('wsp-stat-failed')) qs('wsp-stat-failed').textContent = state.stats.failed;
    if(qs('wsp-stat-pending')) qs('wsp-stat-pending').textContent = state.stats.pending;

    const progress = state.stats.total > 0 
      ? ((state.stats.success + state.stats.failed) / state.stats.total) * 100 
      : 0;
    
    const progressBar = qs('wsp-progress-bar');
    if(progressBar){
      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `${Math.round(progress)}%`;
    }
  }

  function addLog(icon, message, type = 'info'){
    const timestamp = new Date().toLocaleTimeString('es-CO');
    state.logs.push({ icon, message, type, timestamp });

    const logContainer = qs('wsp-log');
    if(!logContainer) return;

    const entry = document.createElement('div');
    entry.className = 'wsp-log-entry';
    entry.innerHTML = `
      <div class="wsp-log-icon">${icon}</div>
      <div class="wsp-log-content">
        <div class="wsp-log-number">${message}</div>
        <div class="wsp-log-time">${timestamp}</div>
      </div>
    `;
    
    logContainer.insertBefore(entry, logContainer.firstChild);
    
    // Scroll al top para ver el último mensaje
    logContainer.scrollTop = 0;
  }

  function clearLog(){
    const logContainer = qs('wsp-log');
    if(logContainer) logContainer.innerHTML = '';
  }

  function cancelSending(){
    if(confirm('¿Estás seguro de cancelar el envío en curso?')){
      state.cancelled = true;
      state.sending = false;
    }
  }

  function resetCampaign(){
    if(state.sending){
      alert('No puedes resetear mientras hay un envío en curso');
      return;
    }

    if(confirm('¿Iniciar una nueva campaña? Esto limpiará todos los datos actuales.')){
      clearFile();
      state.stats = { total: 0, success: 0, failed: 0, pending: 0 };
      state.logs = [];
      updateStats();
      clearLog();
      showPanel('wsp-progress-panel', false);
      setError('');
    }
  }

  function exportLog(){
    if(state.logs.length === 0){
      alert('No hay registros para exportar');
      return;
    }

    let csv = 'Hora,Icono,Mensaje\n';
    state.logs.forEach(log => {
      csv += `${log.timestamp},"${log.icon}","${log.message}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp_log_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==================== HELPERS ====================
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function formatBytes(bytes){
    if(bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // ==================== DOWNLOAD TEMPLATE ====================
  function downloadTemplate(){
    const csvContent = `numero,cedula,estatus_servicio,variable1,variable2,variable3,variable4,url_imagen
584121234567,12345678,ACTIVO,Juan,25.00,Promoción,Mes de Enero,https://ejemplo.com/promo.jpg
584129876543,87654321,SUSPENDIDO,María,30.00,Descuento,Mes de Febrero,
584125555555,55555555,CORTADO,Pedro,15.50,Oferta,Mes de Marzo,https://ejemplo.com/oferta.png`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_whatsapp.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==================== EVENT LISTENERS ====================
  function attachEvents(){
    console.log('🔍 Buscando elementos del DOM...');
    
    // Channel selector
    const channelSelector = qs('wsp-channel-selector');
    if(channelSelector){
      console.log('✓ Selector de canal encontrado');
      channelSelector.addEventListener('change', onChannelSelect);
    } else {
      console.warn('✗ Selector de canal NO encontrado');
    }

    // Config - Prevenir submit del form
    const configForm = qs('wsp-config-form');
    if(configForm){
      console.log('✓ Form de config encontrado');
      configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('📝 Submit del form interceptado');
        saveConfig();
      });
    } else {
      console.warn('✗ Form de config NO encontrado');
    }

    const saveConfigBtn = qs('wsp-save-config');
    if(saveConfigBtn){
      console.log('✓ Botón guardar config encontrado');
      saveConfigBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('💾 Click en guardar configuración');
        saveConfig();
      });
    } else {
      console.warn('✗ Botón guardar config NO encontrado');
    }

    // Download template
    const downloadTemplateBtn = qs('wsp-download-template');
    if(downloadTemplateBtn){
      console.log('✓ Botón descargar template encontrado');
      downloadTemplateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('📥 Click en descargar template');
        downloadTemplate();
      });
    } else {
      console.warn('✗ Botón descargar template NO encontrado');
    }

    // File upload
    const selectFileBtn = qs('wsp-select-file');
    const fileInput = qs('wsp-file-input');
    const dropZone = qs('wsp-drop-zone');

    if(selectFileBtn && fileInput){
      console.log('✓ Botón seleccionar archivo encontrado');
      selectFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📂 Click en seleccionar archivo');
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        console.log('📄 Archivo seleccionado');
        if(e.target.files.length > 0) handleFileSelect(e.target.files[0]);
      });
    } else {
      console.warn('✗ Botón o input de archivo NO encontrados');
    }

    if(dropZone){
      console.log('✓ Zona de drop encontrada');
      dropZone.addEventListener('click', (e) => {
        // Solo abrir el file input si se hace clic en el dropZone pero no en el botón
        if(e.target.id === 'wsp-select-file' || e.target.closest('#wsp-select-file')){
          return; // El botón ya tiene su propio handler
        }
        console.log('📂 Click en zona de drop');
        fileInput?.click();
      });
      
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });
      
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        console.log('📄 Archivo dropeado');
        if(e.dataTransfer.files.length > 0){
          handleFileSelect(e.dataTransfer.files[0]);
        }
      });
    } else {
      console.warn('✗ Zona de drop NO encontrada');
    }

    const clearFileBtn = qs('wsp-clear-file');
    if(clearFileBtn){
      console.log('✓ Botón limpiar archivo encontrado');
      clearFileBtn.addEventListener('click', () => clearFile());
    } else {
      console.warn('✗ Botón limpiar archivo NO encontrado');
    }

    // Sending (Queue API - NUEVO)
    const startSendQueueBtn = qs('wsp-start-send-queue');
    if(startSendQueueBtn){
      console.log('✓ Botón iniciar envío con cola encontrado');
      startSendQueueBtn.addEventListener('click', () => startSendingWithQueue());
    } else {
      console.warn('✗ Botón iniciar envío con cola NO encontrado');
    }

    // Sending (Direct - Legacy)
    const startSendBtn = qs('wsp-start-send');
    if(startSendBtn){
      console.log('✓ Botón iniciar envío directo encontrado');
      startSendBtn.addEventListener('click', () => startSending());
    } else {
      console.warn('✗ Botón iniciar envío directo NO encontrado');
    }

    const cancelBtn = qs('wsp-cancel-send');
    if(cancelBtn){
      console.log('✓ Botón cancelar encontrado');
      cancelBtn.addEventListener('click', () => cancelSending());
    } else {
      console.warn('✗ Botón cancelar NO encontrado');
    }

    const resetBtn = qs('wsp-reset');
    if(resetBtn){
      console.log('✓ Botón reset encontrado');
      resetBtn.addEventListener('click', () => resetCampaign());
    } else {
      console.warn('✗ Botón reset NO encontrado');
    }

    const exportLogBtn = qs('wsp-export-log');
    if(exportLogBtn){
      console.log('✓ Botón exportar log encontrado');
      exportLogBtn.addEventListener('click', () => exportLog());
    } else {
      console.warn('✗ Botón exportar log NO encontrado');
    }

    // Help modal
    const helpBtn = qs('wsp-help');
    if(helpBtn){
      console.log('✓ Botón ayuda encontrado');
      helpBtn.addEventListener('click', () => openModal('wsp-help-modal'));
    } else {
      console.warn('✗ Botón ayuda NO encontrado');
    }

    // Modal close handlers
    const closeButtons = document.querySelectorAll('[data-close]');
    console.log(`✓ ${closeButtons.length} botones de cerrar modal encontrados`);
    closeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.target.getAttribute('data-close') || e.target.closest('[data-close]')?.getAttribute('data-close');
        if(modalId) closeModal(modalId);
      });
    });
    
    console.log('✅ Todos los event listeners adjuntados');
  }

  // ==================== LIFECYCLE ====================
  function init(){
    if(initialized) return;
    
    console.log('🚀 Iniciando módulo WhatsApp...');
    
    // Función de inicialización que se ejecuta cuando el DOM está listo
    const doInit = async () => {
      if(initialized) return;
      
      console.log('🧭 doInit disparado (WhatsApp)');
      addLog('Iniciando inicialización de WhatsApp...', 'info');

      // Verificar que el DOM objetivo existe antes de continuar
      const selectorExists = qs('wsp-channel-selector');
      if(!selectorExists){
        console.warn('⚠️ DOM no listo para WhatsApp. Reintentando en 100ms...');
        addLog('DOM no listo, reintentando...', 'warning');
        setTimeout(doInit, 100);
        return;
      }

      initialized = true;

      try {
        console.log('🚚 Entrando a loadChannels()');
        addLog('Solicitando buzones a Supabase...', 'info');
        console.log('📡 Cargando canales desde Supabase...');
        await loadChannels();
        console.log('✅ Canales cargados, continuando...');
        
        console.log('📋 Cargando configuración...');
        loadConfig();
        
        console.log('🔗 Adjuntando event listeners...');
        attachEvents();
        
        // Configurar handlers de modales
        setupModalHandlers();
        
        // Event listener para el botón "Aplicar Configuración"
        const applyConfigBtn = qs('wsp-apply-config');
        if(applyConfigBtn){
          applyConfigBtn.addEventListener('click', () => {
            addLog('✅', 'Configuración aplicada correctamente', 'success');
            closeModal('wsp-message-config-modal');
          });
        }

        // Event listener para el botón de vista previa de plantilla
        const previewBtn = qs('wsp-preview-template');
        if(previewBtn){
          previewBtn.addEventListener('click', () => {
            showTemplatePreview();
          });
        }

        // Habilitar botón de vista previa cuando se seleccione una plantilla
        const templateSelector = qs('wsp-template-selector');
        if(templateSelector){
          templateSelector.addEventListener('change', () => {
            if(previewBtn){
              previewBtn.disabled = !templateSelector.value;
            }
          });
        }

        showPanel('wsp-progress-panel', false);
        
        console.log('✅ Módulo WhatsApp inicializado correctamente');
      } catch(error) {
        console.error('❌ Error en inicialización:', error);
      }
    };
    
    // Si el DOM ya está listo, inicializar inmediatamente
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', doInit);
    } else {
      // DOM ya está listo, usar un pequeño delay para asegurar que todo esté montado
      setTimeout(doInit, 50);
    }
  }

  function destroy(){
    initialized = false;
    // Cancelar envío si está en curso
    if(state.sending){
      state.cancelled = true;
      state.sending = false;
    }
    console.log('🗑️ Módulo WhatsApp destruido');
  }

  // Exportar funciones públicas
  window.WhatsAppModule = { init, destroy };
})();

// NO auto-init aquí, el router lo llamará cuando cargue la vista
