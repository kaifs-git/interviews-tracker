// Authentication state management
const auth = (() => {
  let currentUser = null;
  let authConfig = { methods: ['password'], allow_registration: true, google_enabled: false };
  let activeTab = 'login';

  // ─── Token helpers ──────────────────────────────────────────────────────────
  function getToken() { return localStorage.getItem('token'); }
  function setToken(t) { localStorage.setItem('token', t); }
  function clearToken() { localStorage.removeItem('token'); }
  function isLoggedIn() { return !!getToken(); }

  // ─── Load auth config from backend ─────────────────────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch('/auth/config');
      if (res.ok) authConfig = await res.json();
    } catch (_) {}
    applyConfig();
  }

  function applyConfig() {
    const passwordEnabled = authConfig.methods.includes('password');
    const registerEnabled = authConfig.allow_registration;

    // Show/hide password forms
    document.getElementById('login-form')?.classList.toggle('hidden', !passwordEnabled);
    document.getElementById('register-form')?.classList.add('hidden'); // start on login tab

    // Show/hide register tab
    const regTab = document.getElementById('tab-register');
    if (regTab) {
      if (registerEnabled && passwordEnabled) {
        regTab.classList.remove('hidden');
      } else {
        regTab.classList.add('hidden');
      }
    }

    // Show/hide Google button
    const googleSection = document.getElementById('google-auth-section');
    if (googleSection) {
      if (authConfig.google_enabled) {
        googleSection.classList.remove('hidden');
      } else {
        googleSection.classList.add('hidden');
      }
    }

    // If only Google is enabled, hide password form tabs entirely
    if (!passwordEnabled && authConfig.google_enabled) {
      document.getElementById('auth-tabs')?.classList.add('hidden');
      document.getElementById('login-form')?.classList.add('hidden');
    }
  }

  // ─── Tab switching ──────────────────────────────────────────────────────────
  function showTab(tab) {
    activeTab = tab;
    clearError();
    clearSuccess();

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (tab === 'login') {
      loginForm?.classList.remove('hidden');
      registerForm?.classList.add('hidden');
      tabLogin?.classList.add('text-indigo-600', 'border-indigo-600', 'bg-indigo-50');
      tabLogin?.classList.remove('text-slate-400', 'border-transparent');
      tabRegister?.classList.remove('text-indigo-600', 'border-indigo-600', 'bg-indigo-50');
      tabRegister?.classList.add('text-slate-400', 'border-transparent');
    } else {
      loginForm?.classList.add('hidden');
      registerForm?.classList.remove('hidden');
      tabRegister?.classList.add('text-indigo-600', 'border-indigo-600', 'bg-indigo-50');
      tabRegister?.classList.remove('text-slate-400', 'border-transparent');
      tabLogin?.classList.remove('text-indigo-600', 'border-indigo-600', 'bg-indigo-50');
      tabLogin?.classList.add('text-slate-400', 'border-transparent');
    }
  }

  // ─── Error / success display ────────────────────────────────────────────────
  function showError(msg) {
    clearSuccess();
    const el = document.getElementById('auth-error');
    const msgEl = document.getElementById('auth-error-msg');
    if (el && msgEl) {
      msgEl.textContent = msg;
      el.classList.remove('hidden');
    }
  }
  function clearError() {
    document.getElementById('auth-error')?.classList.add('hidden');
  }
  function showSuccess(msg) {
    clearError();
    const el = document.getElementById('auth-success');
    const msgEl = document.getElementById('auth-success-msg');
    if (el && msgEl) {
      msgEl.textContent = msg;
      el.classList.remove('hidden');
    }
  }
  function clearSuccess() {
    document.getElementById('auth-success')?.classList.add('hidden');
  }

  // ─── Password visibility toggle ─────────────────────────────────────────────
  function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = `<i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>`;
  }

  // ─── Set button loading state ───────────────────────────────────────────────
  function setBtnLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn._orig = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Please wait...';
    } else {
      btn.innerHTML = btn._orig || btn.innerHTML;
    }
  }

  // ─── Submit: password login ─────────────────────────────────────────────────
  async function submitLogin(e) {
    e.preventDefault();
    clearError();
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!username || !password) { showError('Please enter username and password'); return; }

    setBtnLoading('login-btn', true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.detail || 'Login failed'); return; }
      setToken(data.access_token);
      currentUser = data.user;
      updateUserUI(currentUser);
      showApp();
      router.navigate('dashboard');
    } catch (_) {
      showError('Connection error. Please try again.');
    } finally {
      setBtnLoading('login-btn', false);
    }
  }

  // ─── Submit: register ───────────────────────────────────────────────────────
  async function submitRegister(e) {
    e.preventDefault();
    clearError();
    const username = document.getElementById('reg-username')?.value.trim();
    const name = document.getElementById('reg-name')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const password = document.getElementById('reg-password')?.value;

    if (!username) { showError('Username is required'); return; }
    if (username.length < 3) { showError('Username must be at least 3 characters'); return; }
    if (!password || password.length < 6) { showError('Password must be at least 6 characters'); return; }

    setBtnLoading('register-btn', true);
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name: name || null, email: email || null }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.detail || 'Registration failed'); return; }
      if (data.pending) {
        showTab('login');
        showSuccess('Registration successful! Your account is pending admin approval. You can sign in once approved.');
        return;
      }
      setToken(data.access_token);
      currentUser = data.user;
      updateUserUI(currentUser);
      showApp();
      router.navigate('dashboard');
    } catch (_) {
      showError('Connection error. Please try again.');
    } finally {
      setBtnLoading('register-btn', false);
    }
  }

  // ─── Google OAuth ───────────────────────────────────────────────────────────
  function loginWithGoogle() {
    window.location.href = '/auth/google';
  }

  // ─── User state ─────────────────────────────────────────────────────────────
  async function loadUser() {
    try {
      const token = getToken();
      if (!token) return null;
      const res = await fetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { clearToken(); return null; }
      currentUser = await res.json();
      updateUserUI(currentUser);
      return currentUser;
    } catch (_) {
      clearToken();
      return null;
    }
  }

  function updateUserUI(user) {
    if (!user) return;
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const email = document.getElementById('user-email');

    if (avatar) {
      if (user.picture) {
        avatar.src = user.picture;
        avatar.onerror = () => { avatar.src = ''; avatar.classList.add('hidden'); };
      } else {
        // Show initial letter instead
        avatar.style.display = 'none';
        const parent = avatar.parentElement;
        let initial = parent.querySelector('.user-initial');
        if (!initial) {
          initial = document.createElement('div');
          initial.className = 'user-initial w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0';
          parent.insertBefore(initial, avatar);
        }
        initial.textContent = (user.name || user.username || 'U')[0].toUpperCase();
      }
    }
    if (name) name.textContent = user.name || user.username || 'User';
    if (email) {
      email.textContent = user.email || (user.username ? `@${user.username}` : '');
    }

    // Show admin badge + admin nav item if admin
    if (user.is_admin) {
      const nameEl = document.getElementById('user-name');
      if (nameEl && !nameEl.querySelector('.admin-badge')) {
        const badge = document.createElement('span');
        badge.className = 'admin-badge ml-1.5 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-semibold';
        badge.textContent = 'Admin';
        nameEl.appendChild(badge);
      }
      document.getElementById('admin-nav-item')?.classList.remove('hidden');
    }
  }

  // ─── Page visibility helpers ─────────────────────────────────────────────────
  function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('bottom-nav')?.classList.add('hidden');
  }

  function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('bottom-nav')?.classList.remove('hidden');
  }

  function logout() {
    clearToken();
    currentUser = null;
    // Reset login form
    document.getElementById('login-username') && (document.getElementById('login-username').value = '');
    document.getElementById('login-password') && (document.getElementById('login-password').value = '');
    showTab('login');
    showLoginPage();
  }

  function getUser() { return currentUser; }

  // ─── App init ────────────────────────────────────────────────────────────────
  async function init() {
    await loadConfig();

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (error) {
      const messages = {
        account_disabled: 'Your account is disabled. Contact the admin.',
        google_auth_failed: 'Google sign-in failed. Please try again.',
        no_email: 'No email returned from Google.',
      };
      showLoginPage();
      showError(messages[error] || `Auth error: ${error}`);
      window.history.replaceState({}, '', '/');
      return false;
    }

    if (token) {
      setToken(token);
      window.history.replaceState({}, '', '/');
    }

    if (isLoggedIn()) {
      const user = await loadUser();
      if (user) { showApp(); return true; }
    }

    showLoginPage();
    return false;
  }

  return {
    init, logout, getUser, isLoggedIn,
    loginWithGoogle, submitLogin, submitRegister,
    showTab, togglePassword,
  };
})();
