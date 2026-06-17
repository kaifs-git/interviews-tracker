// Admin page — user management + system settings
const adminPage = (() => {
  let users = [];
  let activeTab = 'users';

  async function render(params = {}) {
    if (params.tab) activeTab = params.tab;
    setPageHeader('Admin', 'User management & system configuration');
    setPageActions('');

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    const tabs = `
      <div class="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button onclick="adminPage.switchTab('users')"
          class="admin-tab px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'users' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
          <i class="fa-solid fa-users mr-2"></i>Users
        </button>
        <button onclick="adminPage.switchTab('settings')"
          class="admin-tab px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
          <i class="fa-solid fa-sliders mr-2"></i>System Settings
        </button>
      </div>
    `;

    if (activeTab === 'settings') {
      let settings = {};
      let stats = {};
      try {
        [settings, stats] = await Promise.all([api.getAdminSettings(), api.getAdminAgentStats()]);
      } catch (e) {
        content.innerHTML = tabs + `<div class="text-center py-10 text-slate-500">Failed to load settings.</div>`;
        return;
      }
      content.innerHTML = tabs + renderSettings(settings, stats);
      return;
    }

    try {
      users = await api.getAdminUsers();
    } catch (e) {
      content.innerHTML = tabs + `<div class="text-center py-20 text-slate-500">Failed to load users. Admin access required.</div>`;
      return;
    }

    content.innerHTML = tabs + renderList();
    refreshPendingBadge();
  }

  function renderList() {
    const pending  = users.filter(u => !u.is_approved && u.is_active);
    const active   = users.filter(u => u.is_approved && u.is_active && !u.is_admin);
    const admins   = users.filter(u => u.is_admin);
    const inactive = users.filter(u => !u.is_active);

    return `
      ${pending.length ? `
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span class="w-2 h-2 bg-amber-400 rounded-full"></span>Pending Approval (${pending.length})
          </h3>
          <div class="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
            ${userTable(pending, true)}
          </div>
        </div>
      ` : ''}

      ${admins.length ? `
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span class="w-2 h-2 bg-indigo-500 rounded-full"></span>Administrators (${admins.length})
          </h3>
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            ${userTable(admins, false)}
          </div>
        </div>
      ` : ''}

      ${active.length ? `
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span class="w-2 h-2 bg-emerald-500 rounded-full"></span>Active Users (${active.length})
          </h3>
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            ${userTable(active, false)}
          </div>
        </div>
      ` : ''}

      ${inactive.length ? `
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span class="w-2 h-2 bg-slate-300 rounded-full"></span>Disabled (${inactive.length})
          </h3>
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            ${userTable(inactive, false)}
          </div>
        </div>
      ` : ''}

      ${!users.length ? emptyState('fa-users', 'No users yet', 'Registered users will appear here.') : ''}
    `;
  }

  function userTable(list, isPending) {
    const rows = list.map(u => {
      const displayName = u.name || u.username || '—';
      const initial = (displayName)[0].toUpperCase();
      const statusBadgeHtml = u.is_admin
        ? '<span class="badge bg-amber-100 text-amber-700">Admin</span>'
        : u.is_approved && u.is_active
          ? '<span class="badge bg-emerald-100 text-emerald-700">Active</span>'
          : !u.is_approved
            ? '<span class="badge bg-amber-100 text-amber-700">Pending</span>'
            : '<span class="badge bg-slate-100 text-slate-500">Disabled</span>';

      const approveRejectBtns = isPending ? `
        <button onclick="adminPage.approveUser(${u.id})" title="Approve"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
          <i class="fa-solid fa-check"></i><span class="hidden sm:inline">Approve</span>
        </button>
        <button onclick="adminPage.rejectUser(${u.id})" title="Reject"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
          <i class="fa-solid fa-xmark"></i><span class="hidden sm:inline">Reject</span>
        </button>
      ` : '';

      const toggleBtn = !u.is_admin ? `
        <button onclick="adminPage.toggleActive(${u.id})" title="${u.is_active ? 'Disable' : 'Enable'}"
          class="p-1.5 text-slate-400 hover:text-${u.is_active ? 'amber' : 'emerald'}-600 hover:bg-slate-100 rounded-md transition-colors">
          <i class="fa-solid fa-${u.is_active ? 'ban' : 'circle-check'} text-sm"></i>
        </button>
      ` : '';

      const deleteBtn = !u.is_admin ? `
        <button onclick="adminPage.confirmDelete(${u.id},'${(u.username || u.name || '').replace(/'/g, "\\'")}')" title="Delete"
          class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
          <i class="fa-solid fa-trash text-sm"></i>
        </button>
      ` : '';

      return `
        <tr>
          <td class="px-4 py-3.5">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-sm font-bold text-indigo-600 flex-shrink-0">
                ${initial}
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-slate-800 text-sm truncate">${u.name || u.username || '—'}</p>
                <p class="text-slate-400 text-xs truncate">${u.username ? '@' + u.username : ''}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3.5 text-sm text-slate-500 hidden sm:table-cell truncate max-w-[160px]">${u.email || '<span class="text-slate-300">—</span>'}</td>
          <td class="px-4 py-3.5">${statusBadgeHtml}</td>
          <td class="px-4 py-3.5 text-xs text-slate-400 hidden md:table-cell whitespace-nowrap">${formatDate(u.created_at)}</td>
          <td class="px-4 py-3.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${approveRejectBtns}
              ${toggleBtn}
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th class="hidden sm:table-cell">Email</th>
              <th>Status</th>
              <th class="hidden md:table-cell">Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function approveUser(id) {
    try {
      await api.approveUser(id);
      toast.success('User approved');
      await render();
    } catch (e) {
      toast.error(e.message || 'Failed to approve user');
    }
  }

  async function rejectUser(id) {
    try {
      await api.rejectUser(id);
      toast.success('User rejected and removed');
      await render();
    } catch (e) {
      toast.error(e.message || 'Failed to reject user');
    }
  }

  async function toggleActive(id) {
    try {
      await api.toggleUserActive(id);
      toast.success('User status updated');
      await render();
    } catch (e) {
      toast.error(e.message || 'Failed to update user');
    }
  }

  function confirmDelete(id, username) {
    modal.confirm({
      title: 'Delete User',
      message: `Permanently delete <strong>${username}</strong>? All their data will be removed. This cannot be undone.`,
      onYes: () => deleteUser(id),
    });
  }

  async function deleteUser(id) {
    try {
      await api.deleteAdminUser(id);
      toast.success('User deleted');
      await render();
    } catch (e) {
      toast.error(e.message || 'Failed to delete user');
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    render();
  }

  function renderSettings(s, stats) {
    const interval = s.email_polling_interval_minutes || '15';
    const agentStats = [
      { label: 'Applications Created', value: stats.created_applications || 0, icon: 'fa-file-lines', color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { label: 'Interviews Scheduled', value: stats.created_interviews || 0, icon: 'fa-calendar-check', color: 'text-sky-600', bg: 'bg-sky-50' },
      { label: 'Contacts Saved', value: stats.created_contacts || 0, icon: 'fa-user-plus', color: 'text-teal-600', bg: 'bg-teal-50' },
      { label: 'Flagged for Review', value: stats.flagged || 0, icon: 'fa-flag', color: 'text-amber-500', bg: 'bg-amber-50' },
    ];

    const statsHtml = agentStats.map(s => `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
        <div class="w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fa-solid ${s.icon} ${s.color}"></i>
        </div>
        <div>
          <p class="text-2xl font-bold text-slate-800">${s.value}</p>
          <p class="text-xs text-slate-500">${s.label}</p>
        </div>
      </div>
    `).join('');

    return `
      <!-- Agent Stats -->
      <div class="mb-6">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Agent Stats (All Users)</h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${statsHtml}</div>
      </div>

      <!-- Settings form -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-slate-800 text-sm">System Configuration</h3>
          <p class="text-xs text-slate-400 mt-0.5">Configure API keys and agent behaviour</p>
        </div>
        <form onsubmit="adminPage.saveSettings(event)" class="p-5 space-y-5">

          <div class="form-section">Email Agent Polling</div>
          <div class="form-group">
            <label class="form-label">Polling Interval (minutes)</label>
            <div class="flex items-center gap-4">
              <input type="range" id="polling-range" name="email_polling_interval_minutes"
                min="5" max="120" step="5" value="${interval}"
                oninput="document.getElementById('polling-display').textContent = this.value + ' min'"
                class="flex-1 accent-indigo-600" />
              <span id="polling-display" class="text-sm font-bold text-indigo-600 w-16 text-right">${interval} min</span>
            </div>
            <p class="text-xs text-slate-400 mt-1">How often the agent checks each connected inbox (5–120 min). Only applies when running as a persistent server (not Vercel).</p>
          </div>

          <div class="form-section">AI Configuration</div>
          <div class="form-group">
            <label class="form-label">
              Gemini API Key <span class="text-red-500">*</span>
              <span class="ml-2 badge bg-emerald-100 text-emerald-700 text-[10px]">Free</span>
            </label>
            <input type="password" name="gemini_api_key" class="form-input"
              placeholder="${s.gemini_api_key ? '•••• already set ••••' : 'AIza...'}"
              autocomplete="off" />
            <p class="text-xs text-slate-400 mt-1">
              Free tier — get your key at
              <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-indigo-500 underline">aistudio.google.com</a>.
              No credit card required. 1,500 free requests/day.
            </p>
          </div>

          <div class="form-section">Gmail OAuth</div>
          <div class="form-group">
            <label class="form-label">Google Client ID</label>
            <input type="text" name="google_client_id" class="form-input"
              placeholder="${s.google_client_id ? '•••• already set ••••' : '123456789.apps.googleusercontent.com'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Google Client Secret</label>
            <input type="password" name="google_client_secret" class="form-input"
              placeholder="${s.google_client_secret_set ? '••••••••••••••••' : 'GOCSPX-...'}"
              autocomplete="off" />
          </div>
          <div class="form-group">
            <label class="form-label">OAuth Redirect URI</label>
            <input type="text" name="google_redirect_uri" class="form-input"
              value="${s.google_redirect_uri || window.location.origin + '/api/email/callback/gmail'}" />
            <p class="text-xs text-slate-400 mt-1">Add this exact URI to your Google Cloud Console OAuth credentials.</p>
          </div>

          <div class="form-section">Push Notifications</div>
          <div class="form-group">
            <label class="form-label">VAPID Subscriber Email</label>
            <input type="email" name="vapid_subscriber_email" class="form-input"
              value="${s.vapid_subscriber_email || ''}"
              placeholder="admin@yourdomain.com" />
            <p class="text-xs text-slate-400 mt-1">Contact email for VAPID push notifications (required by spec).</p>
          </div>
          ${s.vapid_public_key ? `
            <div class="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <i class="fa-solid fa-circle-check"></i> VAPID keys are generated and ready.
            </div>
          ` : `
            <div class="p-3 bg-amber-50 rounded-xl text-xs text-amber-700 flex items-center gap-2">
              <i class="fa-solid fa-triangle-exclamation"></i> VAPID keys will be auto-generated on first server start.
            </div>
          `}

          <div class="flex justify-end pt-2">
            <button type="submit" class="btn-primary">
              <i class="fa-solid fa-floppy-disk"></i>Save Settings
            </button>
          </div>
        </form>
      </div>
    `;
  }

  async function saveSettings(e) {
    e.preventDefault();
    const form = e.target;
    const data = {};
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
      if (el.value.trim() && !el.value.includes('•')) {
        data[el.name] = el.name.includes('minutes') ? parseInt(el.value) : el.value.trim();
      }
    });

    if (!Object.keys(data).length) {
      toast.info('No changes to save');
      return;
    }

    try {
      await api.updateAdminSettings(data);
      toast.success('Settings saved');
      render({ tab: 'settings' });
    } catch (e) {
      toast.error(e.message || 'Failed to save settings');
    }
  }

  async function refreshPendingBadge() {
    try {
      const data = await api.getPendingCount();
      const badge = document.getElementById('pending-count-badge');
      if (badge) {
        if (data.count > 0) {
          badge.textContent = data.count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    } catch (_) {}
  }

  return { render, switchTab, saveSettings, approveUser, rejectUser, toggleActive, confirmDelete, deleteUser };
})();
