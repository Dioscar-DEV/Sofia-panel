// ===== FIX PARA MANEJO DE INVITACIONES NATIVAS =====
// Reemplaza la sección de PRE-PROCESAMIENTO y el LISTENER en app-init.js

// ======= PRE-PROCESAMIENTO DE ENLACES (Ejecutar ANTES de Loader.init) =======
(function preprocessAuthLinks() {
  // Parsear los parámetros correctamente
  const hashString = window.location.hash.substring(1);
  const hashParams = new URLSearchParams(hashString);
  const urlParams = new URLSearchParams(window.location.search);

  const type = hashParams.get('type') || urlParams.get('type');
  const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');

  // DEBUG
  console.log('🔍 PRE-PROCESAMIENTO:', { type, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });

  // Si es una invitación, guardar el tipo en sessionStorage ANTES de procesar
  if (type === 'invite' && accessToken && refreshToken) {
    console.log('📌 Invitación detectada en pre-procesamiento, guardando tipo...');
    // Guardar en sessionStorage para que el onAuthStateChange lo encuentre
    sessionStorage.setItem('authType', 'invite');
    sessionStorage.setItem('authTokens', JSON.stringify({ accessToken, refreshToken }));
  }

  // Si es recuperación, también guardar
  if (type === 'recovery' && accessToken) {
    console.log('📌 Recuperación detectada en pre-procesamiento...');
    sessionStorage.setItem('authType', 'recovery');
  }

  // Esperar a que App esté disponible y establecer sesión
  if (window.App?.supabase && type === 'invite' && accessToken && refreshToken) {
    console.log('🔄 Pre-procesando enlace de invitación...');
    window.App.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
    .then(() => console.log('✅ Sesión establecida en pre-procesamiento'))
    .catch(err => console.error('❌ Error estableciendo sesión:', err));
  }
})();

// ======= LISTENER ÚNICO (Después de Loader.init) =======
// Reemplaza todo el bloque de onAuthStateChange existente con esto:

App.supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 Auth state change:', event, session?.user?.email);

  // Obtener el tipo de evento guardado en sessionStorage
  const authType = sessionStorage.getItem('authType');
  
  console.log('📋 Event info:', {
    event,
    authType,
    hasSession: !!session?.user,
    url: window.location.href
  });

  // ==========================================
  // 1. MANEJAR RECUPERACIÓN DE CONTRASEÑA
  // ==========================================
  if (event === 'PASSWORD_RECOVERY' && session?.user) {
    console.log('✅ PASSWORD_RECOVERY event detectado - abriendo modal...');
    sessionStorage.removeItem('authType');
    
    // Limpiar URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Abrir modal después de un pequeño delay
    setTimeout(() => {
      openModal('password-change-modal');
    }, 500);
    return;
  }

  // ==========================================
  // 2. MANEJAR INVITACIÓN (SIGNED_IN + authType='invite')
  // ==========================================
  if (event === 'SIGNED_IN' && authType === 'invite' && session?.user) {
    console.log('✅ SIGNED_IN + INVITE detectado - abriendo modal de invitación...');
    
    try {
      // Limpiar sessionStorage
      sessionStorage.removeItem('authType');
      sessionStorage.removeItem('authTokens');

      // Ocultar shell de login, mostrar auth section
      const shell = document.getElementById('shell');
      if (shell && !shell.classList.contains('hidden')) {
        shell.classList.add('hidden');
      }

      const authSection = document.getElementById('auth-section');
      if (authSection) {
        authSection.classList.remove('hidden');
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.style.opacity = '0';
      }

      // Poblar datos del usuario en el modal
      const userMetadata = session.user.user_metadata || {};
      const emailInput = document.getElementById('invitation-email');
      const roleBadge = document.getElementById('invitation-role-badge');
      const inviteBy = document.getElementById('invitation-by');

      if (emailInput) emailInput.value = session.user.email;
      if (roleBadge) {
        const role = userMetadata.role || 'usuario';
        roleBadge.textContent = role;
        roleBadge.className = `role-badge ${role}`;
      }
      if (inviteBy) inviteBy.textContent = userMetadata.invited_by || 'Administrador';

      // Limpiar URL ANTES de abrir modal
      window.history.replaceState({}, document.title, window.location.pathname);

      // Abrir modal
      setTimeout(() => {
        openModal('invitation-modal');
        console.log('🎉 Modal de invitación abierto');
      }, 300);

    } catch (err) {
      console.error('❌ Error procesando invitación:', err);
      alert('Error al procesar la invitación: ' + err.message);
      window.location.hash = '#/';
    }
    return;
  }

  // ==========================================
  // 3. MANEJAR RECUPERACIÓN COMO SIGNED_IN
  // ==========================================
  if (event === 'SIGNED_IN' && authType === 'recovery' && session?.user) {
    console.log('✅ SIGNED_IN + RECOVERY detectado - abriendo modal...');
    sessionStorage.removeItem('authType');
    
    window.history.replaceState({}, document.title, window.location.pathname);
    
    setTimeout(() => {
      openModal('password-change-modal');
    }, 500);
    return;
  }

  // ==========================================
  // 4. FLUJO NORMAL (LOGIN, SIGNED_IN sin invitación)
  // ==========================================
  if (event === 'SIGNED_IN' && session?.user && !authType) {
    console.log('✅ Login normal exitoso');
    sessionStorage.removeItem('authType');
    
    // El flujo normal continuará
    return;
  }

  // ==========================================
  // 5. SIGN_OUT
  // ==========================================
  if (event === 'SIGNED_OUT') {
    console.log('👋 Usuario desconectado');
    sessionStorage.removeItem('authType');
    sessionStorage.removeItem('authTokens');
    return;
  }

  // ==========================================
  // 6. INITIAL_SESSION (Carga de página)
  // ==========================================
  if (event === 'INITIAL_SESSION') {
    console.log('📦 Sesión inicial cargada');
    
    // Verificar si hay una invitación pendiente que se cargó en pre-procesamiento
    if (authType === 'invite' && session?.user) {
      console.log('🔄 Invitación pendiente desde pre-procesamiento');
      // El siguiente ciclo (SIGNED_IN) la manejará
      return;
    }
    
    return;
  }
});

// ======= MANEJO DEL FORMULARIO DE INVITACIÓN =======
// Asegúrate de que este código esté EN el archivo app-init.js

document.getElementById('invitation-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('invitation-email')?.value;
  const password = document.getElementById('invitation-password')?.value;
  const confirmPassword = document.getElementById('invitation-password-confirm')?.value;
  const acceptBtn = document.getElementById('accept-invitation-btn');

  // Validación
  if (!email || !password || !confirmPassword || password !== confirmPassword) {
    alert('Por favor completa todos los campos correctamente');
    return;
  }

  // Mostrar loading
  acceptBtn.disabled = true;
  acceptBtn.classList.add('loading');

  try {
    console.log('💾 Actualizando contraseña...');

    // 1. Actualizar contraseña del usuario autenticado
    const { error: updateError } = await App.supabase.auth.updateUser({
      password: password
    });

    if (updateError) throw updateError;
    console.log('✅ Contraseña actualizada');

    // 2. Cargar perfil y permisos
    await App.loadProfile();
    await App.loadPermissions();
    
    // 3. Actualizar UI
    updateRoleUI();
    await Loader.renderNavigation();

    // 4. Mostrar éxito
    document.getElementById('invitation-details')?.classList.add('hidden');
    document.getElementById('invitation-success')?.classList.remove('hidden');

    // 5. Cerrar modal y redirigir después de 2 segundos
    setTimeout(() => {
      closeModal('invitation-modal');
      
      // Limpiar
      const authSection = document.getElementById('auth-section');
      const shell = document.getElementById('shell');
      if (authSection) authSection.classList.add('hidden');
      if (shell) shell.classList.remove('hidden');

      // Redirigir a home
      window.location.hash = '#/home';
      Router.onRouteChange();
    }, 2000);

  } catch (err) {
    console.error('❌ Error:', err);
    alert('Error al completar el registro: ' + err.message);
  } finally {
    acceptBtn.disabled = false;
    acceptBtn.classList.remove('loading');
  }
});

// ======= BOTON CONTINUAR A APP =======
document.getElementById('continue-to-app-btn')?.addEventListener('click', async () => {
  closeModal('invitation-modal');
  
  const authSection = document.getElementById('auth-section');
  const shell = document.getElementById('shell');
  if (authSection) authSection.classList.add('hidden');
  if (shell) shell.classList.remove('hidden');

  // Asegurar que todo esté cargado
  await App.loadProfile();
  await App.loadPermissions();
  updateRoleUI();
  await Loader.renderNavigation();

  window.location.hash = '#/home';
  Router.onRouteChange();
});
