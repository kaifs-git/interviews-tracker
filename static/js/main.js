// App bootstrap
(async () => {
  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  }

  const loggedIn = await auth.init();
  if (loggedIn) {
    router.navigate('dashboard');

    // Fetch pending approval count badge for admin users
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
