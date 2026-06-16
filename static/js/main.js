// App bootstrap
(async () => {
  const loggedIn = await auth.init();
  if (loggedIn) {
    router.navigate('dashboard');
  }
})();
