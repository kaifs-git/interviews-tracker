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
    router.navigate('dashboard');

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
