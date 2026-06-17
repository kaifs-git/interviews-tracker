// App bootstrap
(async () => {
  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('/static/sw.js').catch(() => null);

    // Handle navigation messages from push notification clicks
    if (reg) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'NAVIGATE' && e.data.url) {
          const path = e.data.url.replace(/^.*#/, '');
          if (path && router) router.navigate(path);
        }
      });
    }
  }

  const loggedIn = await auth.init();
  if (loggedIn) {
    const params = new URLSearchParams(window.location.search);
    const startPage = params.get('page') || 'dashboard';
    const gmailConnected = params.get('gmail') === 'connected';
    router.navigate(startPage);
    if (gmailConnected) {
      window.history.replaceState({}, '', '/');
      setTimeout(() => toast.success('Gmail account connected! You can now sync your inbox.'), 500);
    } else if (params.get('gmail') === 'cancelled') {
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
  }
})();
