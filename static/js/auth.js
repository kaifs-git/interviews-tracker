// Authentication state management
const auth = (() => {
  let currentUser = null;

  function getToken() {
    return localStorage.getItem('token');
  }

  function setToken(token) {
    localStorage.setItem('token', token);
  }

  function clearToken() {
    localStorage.removeItem('token');
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function loadUser() {
    try {
      currentUser = await api.getMe();
      updateUserUI(currentUser);
      return currentUser;
    } catch (e) {
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
        avatar.onerror = () => { avatar.src = ''; };
      } else {
        avatar.style.display = 'none';
      }
    }
    if (name) name.textContent = user.name || 'User';
    if (email) email.textContent = user.email || '';
  }

  function loginWithGoogle() {
    window.location.href = '/auth/google';
  }

  function logout() {
    clearToken();
    currentUser = null;
    showLoginPage();
  }

  function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }

  function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
  }

  function getUser() {
    return currentUser;
  }

  // Handle token from URL after Google OAuth redirect
  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (error) {
      const el = document.getElementById('login-error');
      if (el) {
        el.textContent = `Login failed: ${error}. Make sure Google OAuth is configured.`;
        el.classList.remove('hidden');
      }
      showLoginPage();
      window.history.replaceState({}, '', '/');
      return false;
    }

    if (token) {
      setToken(token);
      window.history.replaceState({}, '', '/');
    }

    if (isLoggedIn()) {
      const user = await loadUser();
      if (user) {
        showApp();
        return true;
      }
    }

    showLoginPage();
    return false;
  }

  return { init, loginWithGoogle, logout, getUser, isLoggedIn, loadUser };
})();
