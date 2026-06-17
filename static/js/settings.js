// Settings page — email accounts + push notifications
const settingsPage = (() => {

  async function render() {
    setPageHeader('Settings', 'Email agent, notifications & account');
    setPageActions('');

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    let accounts = [];
    try {
      accounts = await api.getEmailAccounts();
    } catch (_) {}

    content.innerHTML = buildSettings(accounts);
    bindEvents();
  }

  function buildSettings(accounts) {
    const pushSupported = 'PushManager' in window;

    const accountsHtml = accounts.length
      ? accounts.map(a => `
        <div class="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
          <div class="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i class="fa-brands fa-google text-red-500 text-base"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">${a.email_address}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              ${a.last_synced_at ? 'Last synced ' + formatDateTime(a.last_synced_at) : 'Never synced'}
              · <span class="${a.is_active ? 'text-emerald-500' : 'text-slate-400'}">${a.is_active ? 'Active' : 'Inactive'}</span>
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="settingsPage.syncNow()" class="btn-ghost text-xs px-2.5 py-1.5">
              <i class="fa-solid fa-rotate text-xs"></i><span class="hidden sm:inline">Sync</span>
            </button>
            <button onclick="settingsPage.disconnectAccount(${a.id})" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <i class="fa-solid fa-trash text-sm"></i>
            </button>
          </div>
        </div>
      `).join('')
      : `<div class="py-6 text-center text-slate-400 text-sm">No email accounts connected yet.</div>`;

    return `
      <div class="max-w-2xl mx-auto space-y-5">

        <!-- Email Agent -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                <i class="fa-solid fa-robot text-indigo-600 text-base"></i>
              </div>
              <div>
                <h3 class="font-semibold text-slate-800 text-sm">Email Agent</h3>
                <p class="text-slate-400 text-xs">Auto-track applications from your inbox</p>
              </div>
            </div>
            <span id="agent-status-badge" class="badge ${accounts.length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
              ${accounts.length ? 'Connected' : 'Not set up'}
            </span>
          </div>

          <!-- Connected accounts list -->
          <div class="px-5">${accountsHtml}</div>

          <!-- Connect button -->
          <div class="px-5 pb-5 pt-2">
            <button onclick="settingsPage.connectGmail()" class="btn-secondary w-full justify-center gap-2.5">
              <div class="w-4 h-4 flex items-center justify-center">
                <svg viewBox="0 0 24 24" class="w-4 h-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              </div>
              Connect Gmail Account
            </button>
          </div>

          <!-- How it works -->
          <div class="mx-5 mb-5 p-4 bg-indigo-50 rounded-xl">
            <p class="text-xs font-semibold text-indigo-700 mb-2">How the agent works</p>
            <ul class="space-y-1.5 text-xs text-indigo-600">
              <li class="flex items-start gap-2"><i class="fa-solid fa-envelope-open-text mt-0.5 flex-shrink-0"></i> Reads new emails from your connected inbox</li>
              <li class="flex items-start gap-2"><i class="fa-solid fa-brain mt-0.5 flex-shrink-0"></i> Uses AI to detect job applications, interviews &amp; rejections</li>
              <li class="flex items-start gap-2"><i class="fa-solid fa-database mt-0.5 flex-shrink-0"></i> Automatically adds them to your tracker</li>
              <li class="flex items-start gap-2"><i class="fa-solid fa-bell mt-0.5 flex-shrink-0"></i> Sends you a push notification for each action</li>
            </ul>
          </div>
        </div>

        <!-- Push Notifications -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                  <i class="fa-solid fa-bell text-amber-500 text-base"></i>
                </div>
                <div>
                  <h3 class="font-semibold text-slate-800 text-sm">Push Notifications</h3>
                  <p class="text-slate-400 text-xs">Get notified when the agent acts</p>
                </div>
              </div>
              ${pushSupported
                ? `<button id="push-toggle-btn" onclick="settingsPage.togglePush()" class="btn-secondary text-xs px-3 py-1.5">
                    <i class="fa-solid fa-bell-slash mr-1.5"></i>Enable
                  </button>`
                : `<span class="badge bg-slate-100 text-slate-500">Not supported</span>`
              }
            </div>
          </div>
          <div id="push-status-area" class="px-5 py-4 text-sm text-slate-500">
            ${!pushSupported
              ? 'Push notifications are not supported in this browser. Install the app (PWA) for full notification support.'
              : 'Click Enable to receive push notifications when the email agent adds or updates data.'
            }
          </div>
        </div>

        <!-- Agent Activity link -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <i class="fa-solid fa-list-check text-violet-600 text-base"></i>
            </div>
            <div>
              <h3 class="font-semibold text-slate-800 text-sm">Agent Activity Log</h3>
              <p class="text-slate-400 text-xs">See what the agent has done &amp; undo actions</p>
            </div>
          </div>
          <button onclick="navTo('agent')" class="btn-secondary text-xs px-3 py-1.5">
            View Log <i class="fa-solid fa-arrow-right ml-1"></i>
          </button>
        </div>

      </div>
    `;
  }

  function bindEvents() {
    // Check if push is already subscribed
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async reg => {
        const sub = await reg.pushManager.getSubscription();
        updatePushUI(sub);
      });
    }
  }

  function updatePushUI(subscription) {
    const btn = document.getElementById('push-toggle-btn');
    const area = document.getElementById('push-status-area');
    if (!btn) return;

    if (subscription) {
      btn.innerHTML = '<i class="fa-solid fa-bell mr-1.5"></i>Disable';
      btn.className = 'btn-danger text-xs px-3 py-1.5';
      if (area) area.innerHTML = '<span class="text-emerald-600 font-medium"><i class="fa-solid fa-circle-check mr-1.5"></i>Push notifications are active</span>';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-bell-slash mr-1.5"></i>Enable';
      btn.className = 'btn-secondary text-xs px-3 py-1.5';
      if (area) area.textContent = 'Click Enable to receive push notifications when the email agent adds or updates data.';
    }
  }

  function arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function togglePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      await existing.unsubscribe();
      try { await api.unsubscribePush(existing.endpoint); } catch (_) {}
      updatePushUI(null);
      toast.info('Push notifications disabled');
      return;
    }

    try {
      const { public_key } = await api.getVapidPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });

      // Send the full sub.toJSON() — backend accepts both flat and nested keys format
      const subJson = sub.toJSON ? sub.toJSON() : { endpoint: sub.endpoint };
      await api.subscribePush(subJson);
      updatePushUI(sub);
      toast.success('Push notifications enabled!');
    } catch (e) {
      const msg = e?.message || e?.name || String(e) || 'Unknown error';
      toast.error('Could not enable notifications: ' + msg);
    }
  }

  async function connectGmail() {
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      window.location.href = auth_url;
    } catch (e) {
      toast.error(e.message || 'Failed to start Gmail connection. Check admin settings.');
    }
  }

  async function syncNow() {
    try {
      const btn = event.currentTarget;
      btn.disabled = true;
      await api.triggerEmailSync();
      toast.success('Email sync triggered! Check the Activity Log for results.');
      setTimeout(() => render(), 1500);
    } catch (e) {
      toast.error(e.message || 'Sync failed');
    }
  }

  async function disconnectAccount(id) {
    modal.confirm({
      title: 'Disconnect Account',
      message: 'Disconnect this email account? The agent will stop processing new emails from it.',
      danger: true,
      onYes: async () => {
        try {
          await api.deleteEmailAccount(id);
          toast.success('Account disconnected');
          render();
        } catch (e) {
          toast.error(e.message || 'Failed to disconnect');
        }
      },
    });
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  return { render, togglePush, connectGmail, syncNow, disconnectAccount };
})();
