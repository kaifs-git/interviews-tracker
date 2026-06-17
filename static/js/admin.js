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
        <button onclick="adminPage.switchTab('diagnostics')"
          class="admin-tab px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'diagnostics' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
          <i class="fa-solid fa-stethoscope mr-2"></i>Diagnostics
        </button>
      </div>
    `;

    if (activeTab === 'diagnostics') {
      let diag = {};
      try {
        diag = await api.getAdminDiagnostics();
      } catch (e) {
        content.innerHTML = tabs + `<div class="text-center py-10 text-slate-500">Failed to load diagnostics.</div>`;
        return;
      }
      content.innerHTML = tabs + renderDiagnostics(diag);
      return;
    }

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

          <div class="form-section">AI Model</div>

          <!-- Provider selector -->
          <div class="form-group">
            <label class="form-label">Provider</label>
            <div class="flex flex-wrap gap-2" id="provider-pills">
              ${[
                { value: 'gemini',    label: 'Gemini',    badge: 'Free',   badgeCls: 'bg-emerald-100 text-emerald-700' },
                { value: 'grok',      label: 'Grok',      badge: 'xAI',    badgeCls: 'bg-sky-100 text-sky-700' },
                { value: 'anthropic', label: 'Anthropic', badge: 'Paid',   badgeCls: 'bg-amber-100 text-amber-700' },
                { value: 'openai',    label: 'OpenAI',    badge: 'Paid',   badgeCls: 'bg-violet-100 text-violet-700' },
              ].map(p => {
                const active = (s.ai_provider || 'gemini') === p.value;
                return `<button type="button"
                  onclick="adminPage.selectProvider('${p.value}')"
                  data-provider="${p.value}"
                  class="provider-pill flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all
                    ${active ? 'bg-indigo-600 text-white border-transparent shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}">
                  ${p.label}
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20 text-white' : p.badgeCls}">${p.badge}</span>
                </button>`;
              }).join('')}
            </div>
            <input type="hidden" name="ai_provider" id="ai_provider_input" value="${s.ai_provider || 'grok'}" />
          </div>

          <!-- Per-provider key fields -->
          <div id="provider-grok-fields" class="${(s.ai_provider||'grok') !== 'grok' ? 'hidden' : ''}">
            <div class="form-group">
              <label class="form-label">Grok API Key</label>
              <input type="password" name="grok_api_key" class="form-input"
                placeholder="${s.grok_api_key ? '•••• already set ••••' : 'xai-...'}" autocomplete="off" />
              <p class="text-xs text-slate-400 mt-1">
                Get your key at <a href="https://console.x.ai" target="_blank" class="text-indigo-500 underline">console.x.ai</a>.
                Default model: <code>grok-3-mini</code>.
              </p>
            </div>
          </div>

          <div id="provider-gemini-fields" class="${(s.ai_provider||'grok') !== 'gemini' ? 'hidden' : ''}">
            <div class="form-group">
              <label class="form-label">Gemini API Key</label>
              <input type="password" name="gemini_api_key" class="form-input"
                placeholder="${s.gemini_api_key ? '•••• already set ••••' : 'AIza...'}" autocomplete="off" />
              <p class="text-xs text-slate-400 mt-1">
                Free — get your key at <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-indigo-500 underline">aistudio.google.com</a>.
              </p>
            </div>
          </div>

          <div id="provider-anthropic-fields" class="${(s.ai_provider||'grok') !== 'anthropic' ? 'hidden' : ''}">
            <div class="form-group">
              <label class="form-label">Anthropic API Key</label>
              <input type="password" name="anthropic_api_key" class="form-input"
                placeholder="${s.anthropic_api_key ? '•••• already set ••••' : 'sk-ant-...'}" autocomplete="off" />
              <p class="text-xs text-slate-400 mt-1">
                Get your key at <a href="https://console.anthropic.com" target="_blank" class="text-indigo-500 underline">console.anthropic.com</a>.
              </p>
            </div>
          </div>

          <div id="provider-openai-fields" class="${(s.ai_provider||'grok') !== 'openai' ? 'hidden' : ''}">
            <div class="form-group">
              <label class="form-label">OpenAI API Key</label>
              <input type="password" name="openai_api_key" class="form-input"
                placeholder="${s.openai_api_key ? '•••• already set ••••' : 'sk-...'}" autocomplete="off" />
              <p class="text-xs text-slate-400 mt-1">
                Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" class="text-indigo-500 underline">platform.openai.com</a>.
              </p>
            </div>
          </div>

          <!-- Optional model override -->
          <div class="form-group">
            <label class="form-label">Model override <span class="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" name="ai_model" class="form-input"
              value="${s.ai_model || ''}"
              placeholder="Leave blank for default · grok-3-mini, grok-3, gpt-4o-mini, claude-haiku-4-5" />
            <p class="text-xs text-slate-400 mt-1">Override the default model for the selected provider.</p>
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
              placeholder="${s.google_client_secret ? '•••• already set ••••' : 'GOCSPX-...'}"
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

  function selectProvider(provider) {
    document.getElementById('ai_provider_input').value = provider;
    ['grok', 'gemini', 'anthropic', 'openai'].forEach(p => {
      document.getElementById(`provider-${p}-fields`).classList.toggle('hidden', p !== provider);
    });
    document.querySelectorAll('.provider-pill').forEach(btn => {
      const isActive = btn.dataset.provider === provider;
      btn.className = btn.className.replace(/bg-indigo-600 text-white border-transparent shadow-sm|bg-white text-slate-600 border-slate-200 hover:border-indigo-300/, '');
      btn.classList.add(...(isActive
        ? ['bg-indigo-600', 'text-white', 'border-transparent', 'shadow-sm']
        : ['bg-white', 'text-slate-600', 'border-slate-200', 'hover:border-indigo-300']
      ));
      const badge = btn.querySelector('span');
      if (badge) badge.className = isActive ? 'text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-white/20 text-white' : badge.className;
    });
  }

  async function saveSettings(e) {
    e.preventDefault();
    const form = e.target;
    const data = {};
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
      if (el.type === 'hidden') {
        // Always include hidden fields (e.g. ai_provider)
        if (el.value.trim()) data[el.name] = el.value.trim();
      } else if (el.value.trim() && !el.value.includes('•')) {
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

  function renderDiagnostics(d) {
    const ai = d.ai || {};
    const keyOk = ai.key_configured;
    const googleOk = d.google_client_configured;
    const accounts = d.email_accounts || [];
    const logs = d.recent_activity || [];

    const check = (ok, label) => `
      <div class="flex items-center gap-2 text-sm py-1">
        <i class="fa-solid ${ok ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-red-500'} w-4 text-center"></i>
        <span class="${ok ? 'text-slate-700' : 'text-red-600 font-medium'}">${label}</span>
      </div>`;

    const actionIcon = {
      create_application: '📋', update_application_status: '🔄',
      create_interview_round: '📅', create_contact: '👤',
      skipped: '⏭️', flagged: '⚠️', error: '❌',
    };

    const logRows = logs.length ? logs.map(l => `
      <tr>
        <td class="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">${l.created_at ? l.created_at.replace('T',' ').slice(0,19) : '—'}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${l.username}</td>
        <td class="px-3 py-2 text-xs">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
            ${l.status === 'error' ? 'bg-red-100 text-red-700' : l.action_type === 'skipped' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}">
            ${actionIcon[l.action_type] || '•'} ${l.action_type}
          </span>
        </td>
        <td class="px-3 py-2 text-xs text-slate-500 max-w-[180px] truncate" title="${(l.email_subject||'').replace(/"/g,'&quot;')}">${l.email_subject || '—'}</td>
        <td class="px-3 py-2 text-xs text-slate-600 max-w-[200px]">${l.summary || '—'}</td>
      </tr>
    `).join('') : `<tr><td colspan="5" class="px-3 py-6 text-center text-slate-400 text-sm">No activity yet — run a sync to see results here.</td></tr>`;

    const accountRows = accounts.length ? accounts.map(a => `
      <tr>
        <td class="px-3 py-2 text-xs text-slate-700">${a.username}</td>
        <td class="px-3 py-2 text-xs text-slate-600">${a.email_address}</td>
        <td class="px-3 py-2 text-xs">
          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
            ${a.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">${a.last_synced_at ? a.last_synced_at.replace('T',' ').slice(0,19) : 'Never'}</td>
      </tr>
    `).join('') : `<tr><td colspan="4" class="px-3 py-4 text-center text-slate-400 text-sm">No email accounts connected.</td></tr>`;

    return `
      <!-- Config health -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-slate-800 text-sm">Configuration Health</h3>
          <span class="text-xs text-slate-400">Polling: every ${d.polling_interval_minutes} min</span>
        </div>
        ${check(keyOk, `AI API key for <strong>${ai.provider}</strong> — ${ai.key_preview} (model: ${ai.model})`)}
        ${check(googleOk, 'Google OAuth Client ID configured')}
        ${check(accounts.length > 0, `Email accounts connected (${accounts.length})`)}
        ${!keyOk ? `<p class="mt-3 text-xs text-red-600 bg-red-50 rounded-xl p-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i>
          No API key set — go to <strong>System Settings</strong> and save your ${ai.provider} API key. Without it the agent skips all emails silently.</p>` : ''}
      </div>

      <!-- Email accounts -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800 text-sm">Connected Email Accounts</h3>
          <button onclick="adminPage.runDebugSync()" id="debug-sync-btn"
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors">
            <i class="fa-solid fa-rotate"></i> Run Sync Now (Debug)
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-100">
              <tr>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Last Synced</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">${accountRows}</tbody>
          </table>
        </div>
        <div id="debug-sync-result" class="hidden px-5 py-3 border-t border-slate-100 bg-slate-50">
          <pre id="debug-sync-output" class="text-xs text-slate-700 whitespace-pre-wrap font-mono"></pre>
        </div>
      </div>

      <!-- Recent activity log -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800 text-sm">Recent Agent Activity (All Users, Last 30)</h3>
          <div class="flex items-center gap-3">
            <button onclick="adminPage.clearErrors()"
              class="text-xs text-red-500 hover:underline font-medium">
              Clear Errors & Retry
            </button>
            <button onclick="adminPage.switchTab('diagnostics')" class="text-xs text-indigo-500 hover:underline">Refresh</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-100">
              <tr>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Time</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email Subject</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Summary / Error</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">${logRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function runDebugSync() {
    const btn = document.getElementById('debug-sync-btn');
    const resultBox = document.getElementById('debug-sync-result');
    const output = document.getElementById('debug-sync-output');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-rotate animate-spin"></i> Syncing…'; }
    try {
      const result = await api.runDebugSync();
      if (resultBox) resultBox.classList.remove('hidden');
      if (output) output.textContent = JSON.stringify(result, null, 2);
      toast.success(`Sync complete — ${result.accounts?.length || 0} account(s) checked`);
      // Refresh diagnostics after a short delay to pick up new activity log entries
      setTimeout(() => adminPage.switchTab('diagnostics'), 1500);
    } catch (e) {
      if (resultBox) resultBox.classList.remove('hidden');
      if (output) output.textContent = 'Error: ' + (e.message || e);
      toast.error(e.message || 'Sync failed');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Run Sync Now (Debug)'; }
    }
  }

  async function clearErrors() {
    try {
      const r = await api.clearErrorLogs();
      toast.success(`Cleared ${r.deleted} error entries — emails will be retried on next sync`);
      adminPage.switchTab('diagnostics');
    } catch (e) {
      toast.error(e.message || 'Failed to clear errors');
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

  return { render, switchTab, selectProvider, saveSettings, approveUser, rejectUser, toggleActive, confirmDelete, deleteUser, runDebugSync, clearErrors };
})();
