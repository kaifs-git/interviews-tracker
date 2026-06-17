// Admin user management page
const adminPage = (() => {
  let users = [];

  async function render(params = {}) {
    setPageHeader('User Management', 'Manage user accounts and access');
    setPageActions('');

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    try {
      users = await api.getAdminUsers();
    } catch (e) {
      content.innerHTML = `<div class="text-center py-20 text-slate-500">Failed to load users. Admin access required.</div>`;
      return;
    }

    content.innerHTML = renderList();
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

  return { render, approveUser, rejectUser, toggleActive, confirmDelete, deleteUser };
})();
