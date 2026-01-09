// Sistema de notificaciones en tiempo real
(function(){
  let notificationChannel = null;
  let unreadCount = 0;

  async function initNotifications() {
    const { supabase } = window.App;
    
    const notificationBtn = document.getElementById('notifications-btn');
    const notificationBadge = document.getElementById('notification-badge');
    
    if (!notificationBtn || !notificationBadge) {
      console.warn('⚠️ Elementos de notificación no encontrados');
      return;
    }

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log('🔔 Inicializando sistema de notificaciones...');

    // ==================== CARGAR NOTIFICACIONES NO LEÍDAS ====================
    
    async function loadUnreadCount() {
      try {
        const { data, error } = await supabase.rpc('get_notifications', {
          p_limit: 100,
          p_unread_only: true
        });

        if (error) throw error;

        unreadCount = (data || []).length;
        updateBadge();
      } catch (err) {
        console.error('Error cargando notificaciones:', err);
      }
    }

    // ==================== ACTUALIZAR BADGE ====================
    
    function updateBadge() {
      if (unreadCount > 0) {
        notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notificationBadge.classList.remove('hidden');
        notificationBtn.classList.add('has-notifications');
      } else {
        notificationBadge.classList.add('hidden');
        notificationBtn.classList.remove('has-notifications');
      }
    }

    // ==================== MOSTRAR NOTIFICACIÓN TOAST ====================
    
    function showNotificationToast(notification) {
      // Crear el toast
      const toast = document.createElement('div');
      toast.className = 'notification-toast';
      toast.innerHTML = `
        <div class="toast-icon">🔔</div>
        <div class="toast-content">
          <div class="toast-title">${notification.title}</div>
          <div class="toast-message">${notification.message || ''}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
      `;

      // Agregar al body
      document.body.appendChild(toast);

      // Hacer click en el toast para ir a la conversación
      toast.addEventListener('click', (e) => {
        if (e.target.classList.contains('toast-close')) return;
        
        if (notification.data?.contact_id) {
          window.location.hash = `/livechat?contact=${notification.data.contact_id}`;
          toast.remove();
        }
      });

      // Auto-remover después de 5 segundos
      setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
      }, 5000);

      // Reproducir sonido (opcional)
      playNotificationSound();
    }

    // ==================== SONIDO DE NOTIFICACIÓN ====================
    
    function playNotificationSound() {
      try {
        // Crear un beep simple con Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (err) {
        console.log('No se pudo reproducir sonido:', err);
      }
    }

    // ==================== SUSCRIPCIÓN A REALTIME ====================
    
    function setupRealtimeSubscription() {
      // Suscribirse a cambios en la tabla notifications
      notificationChannel = supabase
        .channel('user-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔔 Nueva notificación recibida:', payload.new);
            
            unreadCount++;
            updateBadge();
            showNotificationToast(payload.new);
          }
        )
        .subscribe((status) => {
          console.log('📡 Estado de suscripción de notificaciones:', status);
        });
    }

    // ==================== MODAL DE NOTIFICACIONES ====================
    
    function createNotificationsModal() {
      // Verificar si ya existe
      if (document.getElementById('notifications-modal')) return;

      const modal = document.createElement('div');
      modal.id = 'notifications-modal';
      modal.className = 'notifications-modal hidden';
      modal.innerHTML = `
        <div class="notifications-panel">
          <div class="notifications-header">
            <h3>🔔 Notificaciones</h3>
            <div class="notifications-actions">
              <button class="mark-all-read-btn" id="mark-all-read-btn" title="Marcar todas como leídas">
                ✓ Marcar todas
              </button>
              <button class="close-notifications-btn" id="close-notifications-btn" title="Cerrar">✕</button>
            </div>
          </div>
          <div class="notifications-list" id="notifications-list">
            <div class="loading-notifications">
              <div class="spinner-small"></div>
              <p>Cargando notificaciones...</p>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Event listeners
      document.getElementById('close-notifications-btn').addEventListener('click', () => {
        closeNotificationsModal();
      });

      document.getElementById('mark-all-read-btn').addEventListener('click', async () => {
        await markAllAsRead();
      });

      // Cerrar al hacer click fuera del panel
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('notifications-modal')) {
          closeNotificationsModal();
        }
      });
      
      // Cerrar con ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          closeNotificationsModal();
        }
      });
    }
    
    function closeNotificationsModal() {
      const modal = document.getElementById('notifications-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    }
    
    function openNotificationsModal() {
      const modal = document.getElementById('notifications-modal');
      if (!modal) {
        createNotificationsModal();
      }
      document.getElementById('notifications-modal').classList.remove('hidden');
      loadNotifications();
    }

    async function loadNotifications() {
      const modal = document.getElementById('notifications-modal');
      const list = document.getElementById('notifications-list');
      
      if (!modal || !list) return;

      try {
        list.innerHTML = '<div class="loading-notifications"><div class="spinner-small"></div><p>Cargando...</p></div>';

        const { data, error } = await supabase.rpc('get_notifications', {
          p_limit: 50,
          p_unread_only: false
        });

        if (error) throw error;

        if (!data || data.length === 0) {
          list.innerHTML = `
            <div class="empty-notifications">
              <div class="empty-icon">🔕</div>
              <p>No tienes notificaciones</p>
            </div>
          `;
          return;
        }

        list.innerHTML = '';
        data.forEach(notif => {
          const item = document.createElement('div');
          item.className = `notification-item ${notif.read ? 'read' : 'unread'}`;
          item.innerHTML = `
            <div class="notification-icon">🔔</div>
            <div class="notification-content">
              <div class="notification-title">${notif.title}</div>
              <div class="notification-message">${notif.message || ''}</div>
              <div class="notification-time">${formatNotificationTime(notif.created_at)}</div>
            </div>
            ${!notif.read ? '<div class="unread-indicator"></div>' : ''}
          `;

          // Click para ir a la conversación y marcar como leída
          item.addEventListener('click', async () => {
            if (!notif.read) {
              await markAsRead(notif.id);
            }
            closeNotificationsModal();
            if (notif.data?.contact_id) {
              window.location.hash = `/livechat?contact=${notif.data.contact_id}`;
            }
          });

          list.appendChild(item);
        });
      } catch (err) {
        console.error('Error cargando notificaciones:', err);
        list.innerHTML = '<div class="error-notifications"><p>Error al cargar notificaciones</p></div>';
      }
    }

    async function markAsRead(notificationId) {
      try {
        await supabase.rpc('mark_notification_read', {
          p_notification_id: notificationId
        });
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
      } catch (err) {
        console.error('Error marcando notificación:', err);
      }
    }

    async function markAllAsRead() {
      try {
        await supabase.rpc('mark_all_notifications_read');
        unreadCount = 0;
        updateBadge();
        await loadNotifications();
      } catch (err) {
        console.error('Error marcando todas:', err);
      }
    }

    function formatNotificationTime(isoString) {
      try {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `Hace ${minutes} min`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days}d`;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      } catch (e) {
        return '';
      }
    }

    // ==================== INICIALIZAR ====================
    
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const modal = document.getElementById('notifications-modal');
      
      if (!modal || modal.classList.contains('hidden')) {
        openNotificationsModal();
      } else {
        closeNotificationsModal();
      }
    });

    // Cargar conteo inicial
    await loadUnreadCount();
    
    // Setup realtime
    setupRealtimeSubscription();
    
    console.log('✅ Sistema de notificaciones iniciado');
  }

  // Exponer función globalmente
  window.NotificationSystem = {
    init: initNotifications
  };
})();
