(function(){
    let state = {
        chatId: null,
        messages: [],
        conversation: null,
        loading: false,
        recentChats: []
    };

    let elements = {};

    async function init() {
        console.log('💬 Inicializando módulo Livechat...');

        // 1. Verificar permisos
        const hasView = window.App?.hasPerm && window.App.hasPerm('agent.livechat.view');
        if (!hasView) {
            renderAccessDenied();
            return;
        }

        // 2. Cargar estilos y preparar DOM
        await loadStyles();
        mapElements();
        bindEvents();

        // 3. Resolver chat_id inicial (si existe)
        state.chatId = getChatIdFromHash();

        // 4. Sin chat seleccionado → mostrar placeholder con sugerencias
        if (!state.chatId) {
            await showNoChatSelected();
            return;
        }

        // 5. Cargar datos del chat actual
        await loadChatData();
    }

    function mapElements() {
        elements = {
            container: document.getElementById('livechat-module'),
            messagesContainer: document.getElementById('livechat-messages'),
            title: document.getElementById('chat-title'),
            subtitle: document.getElementById('chat-subtitle'),
            conversationsList: document.getElementById('conversations-list'),
            conversationsCount: document.getElementById('conversations-count'),
            searchInput: document.getElementById('search-conversations'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
            emptyState: document.getElementById('empty-state'),
            refreshBtn: document.getElementById('livechat-refresh-btn'),
            scrollToBottomBtn: document.getElementById('scroll-to-bottom-btn')
        };
    }

    function bindEvents() {
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', loadChatData);
        }
        if (elements.scrollToBottomBtn) {
            elements.scrollToBottomBtn.addEventListener('click', scrollToBottom);
        }
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }
        if (elements.clearSearchBtn) {
            elements.clearSearchBtn.addEventListener('click', clearSearch);
        }
        
        // Cargar conversaciones al iniciar
        loadConversationsList();
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.trim().toLowerCase();
        if (searchTerm) {
            elements.clearSearchBtn?.classList.remove('hidden');
        } else {
            elements.clearSearchBtn?.classList.add('hidden');
        }
        
        // Filtrar conversaciones
        const items = elements.conversationsList?.querySelectorAll('.conversation-item');
        let visibleCount = 0;
        
        items?.forEach(item => {
            const name = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
            const chatId = item.getAttribute('data-chat') || '';
            
            if (name.includes(searchTerm) || chatId.includes(searchTerm)) {
                item.style.display = 'flex';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Mostrar estado vacío si no hay resultados
        if (elements.emptyState) {
            if (visibleCount === 0) {
                elements.emptyState.classList.remove('hidden');
            } else {
                elements.emptyState.classList.add('hidden');
            }
        }
    }

    function clearSearch() {
        if (elements.searchInput) {
            elements.searchInput.value = '';
            elements.clearSearchBtn?.classList.add('hidden');
        }
        
        // Mostrar todas las conversaciones
        const items = elements.conversationsList?.querySelectorAll('.conversation-item');
        items?.forEach(item => {
            item.style.display = 'flex';
        });
        
        elements.emptyState?.classList.add('hidden');
    }

    async function loadConversationsList() {
        if (!elements.conversationsList) return;
        
        try {
            const { supabase } = window.App;
            if (!supabase) throw new Error('Supabase no está disponible.');

            const { data, error } = await supabase
                .schema('kpidata')
                .from('conversations')
                .select('chat_id, title, updated_at, created_at')
                .order('updated_at', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            
            state.recentChats = data || [];
            renderConversationsList(data || []);
        } catch (err) {
            console.error('Error cargando conversaciones:', err);
            elements.conversationsList.innerHTML = '<p class="recent-empty error">Error al cargar conversaciones</p>';
        }
    }

    function renderConversationsList(conversations) {
        if (!elements.conversationsList) return;
        
        if (!conversations || conversations.length === 0) {
            elements.conversationsList.innerHTML = '';
            elements.emptyState?.classList.remove('hidden');
            if (elements.conversationsCount) {
                elements.conversationsCount.textContent = '0';
            }
            return;
        }
        
        elements.emptyState?.classList.add('hidden');
        if (elements.conversationsCount) {
            elements.conversationsCount.textContent = conversations.length;
        }
        
        const html = conversations.map(chat => {
            const rawTitle = chat.title || 'Sin título';
            const title = cleanTitle(rawTitle);
            const initials = getInitials(rawTitle);
            const time = formatTimestamp(chat.updated_at || chat.created_at);
            const isActive = state.chatId === chat.chat_id;
            
            return `
                <button class="conversation-item ${isActive ? 'active' : ''}" data-chat="${chat.chat_id}">
                    <div class="conversation-avatar">${initials}</div>
                    <div class="conversation-details">
                        <span class="conversation-name">${title}</span>
                        <span class="conversation-time">${time}</span>
                    </div>
                </button>
            `;
        }).join('');
        
        elements.conversationsList.innerHTML = html;
        
        // Bind click events
        elements.conversationsList.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.getAttribute('data-chat');
                if (chatId) {
                    selectConversation(chatId);
                }
            });
        });
    }

    function selectConversation(chatId) {
        // Actualizar estado activo en la lista
        elements.conversationsList?.querySelectorAll('.conversation-item').forEach(item => {
            if (item.getAttribute('data-chat') === chatId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Navegar a la conversación
        window.location.hash = `#/livechat?chat_id=${encodeURIComponent(chatId)}`;
    }

    async function loadChatData() {
        state.chatId = getChatIdFromHash();
        if (!state.chatId) {
            await showNoChatSelected(true);
            return;
        }

        setLoading(true);
        try {
            state.conversation = null;
            state.messages = [];
            await Promise.all([
                fetchConversation(),
                fetchMessages()
            ]);
            renderHeader();
            renderMessages();
            scrollToBottom();
        } catch (err) {
            console.error('Error cargando chat:', err);
            const message = err?.message || 'No se pudo cargar la conversación.';
            renderError('Error cargando la conversación: ' + message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchConversation() {
        const { supabase } = window.App;
        if (!supabase) {
            throw new Error('Supabase no está disponible.');
        }

        const query = supabase
            .schema('kpidata')
            .from('conversations')
            .select('*')
            .eq('chat_id', state.chatId)
            .limit(1);

        const response = typeof query.maybeSingle === 'function'
            ? await query.maybeSingle()
            : await query.single();

        if (response.error) throw response.error;
        if (!response.data) {
            throw new Error('La conversación no existe o ya no tienes acceso.');
        }

        state.conversation = response.data;
    }

    async function fetchMessages() {
        const { supabase } = window.App;
        if (!supabase) {
            throw new Error('Supabase no está disponible.');
        }

        const { data, error } = await supabase
            .schema('kpidata')
            .from('messages')
            .select('*')
            .eq('chat_id', state.chatId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        state.messages = data || [];
    }

    async function renderHeader() {
        if (!elements.title) return;
        if (!state.conversation) {
            setHeaderState('Conversación no disponible', 'Verifica el contacto seleccionado.');
            return;
        }

        const title = state.conversation.title || 'Desconocido';
        setHeaderState(title, `ID: ${state.chatId}`);
        
        // Agregar tooltip con status del embudo
        await addFunnelStatusTooltip();
    }
    
    async function addFunnelStatusTooltip() {
        const { supabase } = window.App;
        if (!supabase || !state.chatId) return;
        
        try {
            const { data, error } = await supabase.rpc('get_contact_funnel_status', { 
                p_chat_id: state.chatId 
            });
            
            if (error || !data || data.error) {
                console.log('No se pudo obtener status del embudo:', error || data?.error);
                return;
            }
            
            // Crear tooltip con la información
            const statusEmbudo = data.status_embudo || {};
            const tooltipContent = createFunnelTooltipContent(data, statusEmbudo);
            
            // Buscar el elemento del header donde agregar el tooltip
            const headerInfo = document.querySelector('.conversation-info');
            if (!headerInfo) return;
            
            // Remover tooltip anterior si existe
            const oldTooltip = headerInfo.querySelector('.funnel-status-badge');
            if (oldTooltip) oldTooltip.remove();
            
            // Crear badge con popup flotante
            const badge = document.createElement('div');
            badge.className = 'funnel-status-badge';
            badge.innerHTML = `
                <div class="badge-icon" title="Ver estado del embudo" style="font-size: 1.3em; line-height: 1; display: flex; align-items: center; justify-content: center; cursor:pointer;">📝</div>
            `;
            headerInfo.appendChild(badge);

            // Crear popup flotante (fuera del flujo del header)
            let popup = document.createElement('div');
            popup.className = 'funnel-tooltip funnel-tooltip-popup';
            popup.innerHTML = tooltipContent;
            popup.style.display = 'none';
            popup.style.opacity = '0';
            popup.style.visibility = 'hidden';
            document.body.appendChild(popup);

            // Mostrar/ocultar popup con hover
            const icon = badge.querySelector('.badge-icon');
            
            const showPopup = () => {
                const rect = icon.getBoundingClientRect();
                popup.style.position = 'fixed';
                popup.style.zIndex = '9999';
                
                // Calcular posición horizontal (centrado respecto al icono)
                let leftPos = rect.left + rect.width/2 - 180;
                
                // Ajustar si se sale por la derecha
                const popupWidth = 360;
                if (leftPos + popupWidth > window.innerWidth) {
                    leftPos = window.innerWidth - popupWidth - 20;
                }
                // Ajustar si se sale por la izquierda
                if (leftPos < 20) {
                    leftPos = 20;
                }
                
                // Calcular posición vertical
                let topPos = rect.bottom + 10;
                
                // Si no hay espacio abajo, mostrarlo arriba
                const popupHeight = 400;
                if (topPos + popupHeight > window.innerHeight) {
                    topPos = rect.top - popupHeight - 10;
                    if (topPos < 20) {
                        topPos = 20;
                    }
                }
                
                popup.style.left = leftPos + 'px';
                popup.style.top = topPos + 'px';
                popup.style.display = 'block';
                setTimeout(() => {
                    popup.style.opacity = '1';
                    popup.style.visibility = 'visible';
                }, 10);
            };
            
            const hidePopup = () => {
                popup.style.opacity = '0';
                popup.style.visibility = 'hidden';
                setTimeout(() => {
                    popup.style.display = 'none';
                }, 200);
            };
            
            badge.addEventListener('mouseenter', showPopup);
            badge.addEventListener('mouseleave', () => {
                // Dar un pequeño delay para permitir mover el mouse al popup
                setTimeout(() => {
                    if (!popup.matches(':hover') && !badge.matches(':hover')) {
                        hidePopup();
                    }
                }, 100);
            });
            
            popup.addEventListener('mouseenter', () => {
                popup.style.opacity = '1';
                popup.style.visibility = 'visible';
            });
            
            popup.addEventListener('mouseleave', hidePopup);
            
            // Ocultar popup al cambiar de chat
            window.addEventListener('hashchange', hidePopup);
        } catch (err) {
            console.error('Error cargando status del embudo:', err);
        }
    }
    
    function createFunnelTooltipContent(contactData, statusEmbudo) {
        let html = '<div class="funnel-tooltip-content">';
        html += '<h4>📊 Estado del Embudo</h4>';
        
        // Status del embudo (JSONB)
        if (statusEmbudo && Object.keys(statusEmbudo).length > 0) {
            html += '<div class="funnel-section">';
            for (const [key, value] of Object.entries(statusEmbudo)) {
                if (value !== null && value !== undefined) {
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    let emoji = '';
                    let isPhase = false;
                    if (key.toLowerCase().includes('fase')) { emoji = '🔵'; isPhase = true; }
                    if (key.toLowerCase().includes('proceso')) emoji = '⚙️';
                    if (key.toLowerCase().includes('resumen')) emoji = '📝';
                    if (key.toLowerCase().includes('estado')) emoji = '📍';
                    if (key.toLowerCase().includes('fecha')) emoji = '📅';
                    if (key.toLowerCase().includes('monto')) emoji = '💰';
                    if (key.toLowerCase().includes('contacto')) emoji = '👤';
                    if (key.toLowerCase().includes('canal')) emoji = '💬';
                    if (isPhase) {
                        html += `<div class="funnel-item funnel-phase"><span class="funnel-emoji">${emoji}</span><span class="phase-badge">${value}</span></div>`;
                    } else {
                        html += `<div class="funnel-item">${emoji ? `<span class='funnel-emoji'>${emoji}</span>` : ''}<strong>${label}:</strong> ${value}</div>`;
                    }
                }
            }
            html += '</div>';
        } else {
            html += '<div class="funnel-item muted">Sin información de embudo</div>';
        }
        
        // Información adicional del contacto
        html += '<div class="funnel-section">';
        if (contactData.cliente_fibex) {
            html += '<div class="funnel-item"><span class="badge-success">✓ Cliente Fibex</span></div>';
        }
        if (contactData.redireccionado_a_asesor) {
            html += '<div class="funnel-item"><span class="badge-info">👤 Redirigido a asesor</span></div>';
        }
        if (contactData.contact_company) {
            html += `<div class="funnel-item">🏢 ${contactData.contact_company}</div>`;
        }
        html += '</div></div>';
        return html;
    }

    function renderMessages() {
        if (!elements.messagesContainer) return;
        elements.messagesContainer.innerHTML = '';

        if (state.messages.length === 0) {
            elements.messagesContainer.innerHTML = `
                <div class="chat-placeholder">
                    <div class="empty-icon">💬</div>
                    <p>No hay mensajes en esta conversación.</p>
                </div>
            `;
            return;
        }

        let lastDate = null;

        state.messages.forEach(msg => {
            // Separador de fecha
            const msgDate = formatDateVenezuela(msg.created_at);
            if (msgDate !== lastDate) {
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.textContent = msgDate;
                elements.messagesContainer.appendChild(divider);
                lastDate = msgDate;
            }

            const bubble = createMessageBubble(msg);
            elements.messagesContainer.appendChild(bubble);
        });
    }

    function createMessageBubble(msg) {
        const el = document.createElement('div');
        el.className = `message-bubble role-${msg.role}`;
        
        let contentHtml = '';

        // Texto
        if (msg.content) {
            // Convertir saltos de línea a <br>
            const text = msg.content.replace(/\n/g, '<br>');
            contentHtml += `<div class="message-text">${text}</div>`;
        }

        // Multimedia
        if (msg.message_type !== 'text' && msg.media_url) {
            contentHtml += renderMediaContent(msg);
        }

        // Metadatos (hora)
        const time = formatTimeVenezuela(msg.created_at);
        contentHtml += `
            <div class="message-meta">
                <span class="message-time">${time}</span>
            </div>
        `;

        el.innerHTML = contentHtml;
        return el;
    }

    function renderMediaContent(msg) {
        const url = msg.media_url; // Asumimos que viene firmada o es pública
        const type = msg.message_type;

        if (type === 'photo') {
            return `<div class="media-content"><img src="${url}" alt="Foto" loading="lazy" onclick="window.open('${url}', '_blank')"></div>`;
        }
        if (type === 'sticker') {
            return `<div class="media-content"><img src="${url}" alt="Sticker" class="media-sticker"></div>`;
        }
        if (type === 'voice' || type === 'audio') {
            return `<div class="media-content"><audio controls class="audio-player" src="${url}"></audio></div>`;
        }
        if (type === 'video') {
            return `<div class="media-content"><video controls src="${url}"></video></div>`;
        }
        if (type === 'document') {
            // Intentar extraer nombre del archivo de la URL o usar el tipo
            let filename = 'Documento adjunto';
            try {
                // Si es una URL de Supabase Storage, el nombre suele estar antes de los query params
                const path = url.split('?')[0];
                filename = path.split('/').pop();
            } catch (e) {}

            return `
                <div class="media-content">
                    <a href="${url}" target="_blank" class="file-attachment">
                        <span class="file-icon">📄</span>
                        <span class="file-name">${filename}</span>
                    </a>
                </div>
            `;
        }
        if (type === 'location') {
            // location content suele ser "lat|long"
            // media_url también trae "lat|long" en el ejemplo
            const coords = url.includes('|') ? url.replace('|', ',') : url;
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${coords}`;
            return `
                <div class="media-content">
                    <a href="${mapUrl}" target="_blank" class="location-preview">
                        📍 Ver ubicación: ${coords}
                    </a>
                </div>
            `;
        }

        return `<div class="media-content"><a href="${url}" target="_blank">Ver archivo adjunto (${type})</a></div>`;
    }

    function scrollToBottom() {
        if (elements.messagesContainer) {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        }
    }

    function setLoading(isLoading) {
        state.loading = isLoading;
        if (!elements.messagesContainer) return;
        if (isLoading && elements.messagesContainer.childElementCount === 0) {
            elements.messagesContainer.innerHTML = `
                <div class="chat-placeholder">
                    <div class="spinner"></div>
                    <p>Cargando conversación...</p>
                </div>
            `;
        }
    }

    function renderError(msg) {
        setHeaderState('Error al cargar el chat', 'Intenta nuevamente o selecciona otro contacto.');
        if (!elements.messagesContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-placeholder error';

        const icon = document.createElement('div');
        icon.className = 'error-icon';
        icon.textContent = '⚠️';

        const text = document.createElement('p');
        text.textContent = msg;

        const buttons = document.createElement('div');
        buttons.className = 'error-actions';

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-secondary';
        retryBtn.textContent = 'Reintentar';
        retryBtn.addEventListener('click', loadChatData);

        const contactsBtn = document.createElement('button');
        contactsBtn.className = 'btn-primary';
        contactsBtn.textContent = 'Ver Contactos';
        contactsBtn.addEventListener('click', () => {
            window.location.hash = '#/contacts';
        });

        buttons.append(retryBtn, contactsBtn);
        wrapper.innerHTML = '';
        wrapper.append(icon, text, buttons);

        elements.messagesContainer.innerHTML = '';
        elements.messagesContainer.appendChild(wrapper);
    }

    function renderAccessDenied() {
        const root = document.getElementById('livechat-module');
        if (root) {
            root.innerHTML = `
                <div class="state-message">
                    <div class="empty-icon">🔒</div>
                    <h3>Acceso Denegado</h3>
                    <p>No tienes permisos para ver el chat en vivo.</p>
                </div>
            `;
        }
    }

    function loadStyles() {
        return new Promise((resolve) => {
            const linkId = 'livechat-module-styles';
            if (document.getElementById(linkId)) return resolve();

            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = 'modules/livechat/styles.css';
            link.onload = resolve;
            document.head.appendChild(link);
        });
    }

    async function showNoChatSelected(forceReload = false) {
        state.conversation = null;
        state.messages = [];
        setHeaderState('Selecciona una conversación', 'Elige una conversación de la lista');

        if (elements.messagesContainer) {
            elements.messagesContainer.innerHTML = `
                <div class="welcome-state">
                    <div class="welcome-icon">🎯</div>
                    <h3>Bienvenido al Centro de Control</h3>
                    <p>Selecciona una conversación de la lista para comenzar a supervisar las interacciones en tiempo real.</p>
                </div>
            `;
        }
    }

    function setHeaderState(titleText, subtitleText) {
        if (elements.title) {
            elements.title.textContent = titleText || 'Livechat';
        }
        if (elements.subtitle) {
            elements.subtitle.textContent = subtitleText || '';
        }
    }

    function formatTimestamp(value) {
        if (!value) return 'Sin registro';
        try {
            const date = new Date(value);
            // Restar 4 horas para Venezuela (UTC-4)
            date.setHours(date.getHours() - 4);
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (err) {
            return value;
        }
    }

    function formatDateVenezuela(value) {
        if (!value) return '';
        try {
            const date = new Date(value);
            // Restar 4 horas para Venezuela (UTC-4)
            date.setHours(date.getHours() - 4);
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}/${month}/${year}`;
        } catch (err) {
            return value;
        }
    }

    function formatTimeVenezuela(value) {
        if (!value) return '';
        try {
            const date = new Date(value);
            // Convertir a hora de Venezuela (UTC-4)
            const utcHours = date.getUTCHours();
            const utcMinutes = date.getUTCMinutes();
            
            // Restar 4 horas desde UTC
            let hours = utcHours - 4;
            if (hours < 0) hours += 24;
            
            const hoursStr = String(hours).padStart(2, '0');
            const minutesStr = String(utcMinutes).padStart(2, '0');
            
            return `${hoursStr}:${minutesStr}`;
        } catch (err) {
            return value;
        }
    }

    function cleanTitle(title) {
        if (!title) return 'Sin título';
        // Remover prefijos técnicos comunes
        const cleaned = title
            .replace(/^(AUDIO TRANSCRITO:|CAPTION:|IMAGE:|VIDEO:)/i, '')
            .trim();
        return cleaned || title;
    }

    function getInitials(text) {
        if (!text) return '??';
        
        // Limpiar texto: remover prefijos comunes
        let cleaned = text
            .replace(/^(AUDIO TRANSCRITO:|CAPTION:|IMAGE:|VIDEO:)/i, '')
            .trim();
        
        // Si está vacío después de limpiar, usar el original
        if (!cleaned) cleaned = text;
        
        // Dividir en palabras y filtrar vacías
        const words = cleaned.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 0) return '??';
        
        // Si es una sola palabra, tomar las dos primeras letras
        if (words.length === 1) {
            return words[0].substring(0, 2).toUpperCase();
        }
        
        // Si son múltiples palabras, tomar la primera letra de las dos primeras palabras
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    function getChatIdFromHash() {
        const rawHash = window.location.hash || '';
        const cleaned = rawHash.replace(/^#\/?/, '');
        const parts = cleaned.split('?');
        if (parts.length < 2) {
            return null;
        }
        const queryPart = parts.slice(1).join('?');
        const sanitized = queryPart.split('#')[0];
        const params = new URLSearchParams(sanitized);
        const value = params.get('chat_id');
        return value ? value.trim() : null;
    }

    window.LivechatModule = { init };
})();
