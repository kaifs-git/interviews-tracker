// App bootstrap

// Init theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) {
    icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

(async () => {
  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);

    // Handle navigation messages from push notification clicks
    if (reg) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'SW_UPDATED') {
          window.location.reload();
        }
        if (e.data?.type === 'NAVIGATE' && e.data.url) {
          const path = e.data.url.replace(/^.*#/, '');
          if (path && router) router.navigate(path);
        }
      });
    }
  }

  const loggedIn = await auth.init();
  if (loggedIn) {
    // Read start page from hash first, then fall back to query param, then dashboard
    let startPage = 'dashboard';
    let startParams = {};
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const parts = hash.split('/');
      startPage = parts[0] || 'dashboard';
      const id = parts[1] ? parseInt(parts[1], 10) : undefined;
      if (id) startParams = { id };
    } else {
      const qParams = new URLSearchParams(window.location.search);
      startPage = qParams.get('page') || 'dashboard';
    }

    const qParams = new URLSearchParams(window.location.search);
    const gmailConnected = qParams.get('gmail') === 'connected';

    router.navigate(startPage, startParams);

    if (gmailConnected) {
      window.history.replaceState({}, '', '/');
      setTimeout(() => toast.success('Gmail account connected! You can now sync your inbox.'), 500);
    } else if (qParams.get('gmail') === 'cancelled') {
      window.history.replaceState({}, '', '/');
      setTimeout(() => toast.error('Gmail connection cancelled.'), 500);
    }

    const user = auth.getUser();
    if (user && user.is_admin) {
      try {
        const data = await api.getPendingCount();
        const badge = document.getElementById('pending-count-badge');
        if (badge && data.count > 0) {
          badge.textContent = data.count;
          badge.classList.remove('hidden');
        }
      } catch (_) {}
    }

    // Auto-sync emails on page load, throttled to at most once per 15 min per session
    const SYNC_KEY = 'lastAutoSync';
    const lastSync = parseInt(localStorage.getItem(SYNC_KEY) || '0');
    if (Date.now() - lastSync > 15 * 60 * 1000) {
      localStorage.setItem(SYNC_KEY, Date.now());
      api.triggerEmailSync().catch(() => {});
    }

    // Sync theme toggle icon state
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.className = document.documentElement.classList.contains('dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }
})();
