// Agent Activity Log page
const agentPage = (() => {
  let currentFilter = '';
  let page = 1;
  const LIMIT = 20;

  const ACTION_META = {
    create_application:      { icon: 'fa-file-lines',    color: 'text-indigo-600',  bg: 'bg-indigo-50',  label: 'Created Application' },
    update_application_status:{ icon: 'fa-rotate',       color: 'text-violet-600',  bg: 'bg-violet-50',  label: 'Updated Status' },
    create_interview_round:  { icon: 'fa-calendar-check',color: 'text-sky-600',     bg: 'bg-sky-50',     label: 'Scheduled Interview' },
    create_contact:          { icon: 'fa-user-plus',     color: 'text-teal-600',    bg: 'bg-teal-50',    label: 'Saved Contact' },
    skipped:                 { icon: 'fa-forward',       color: 'text-slate-400',   bg: 'bg-slate-50',   label: 'Skipped' },
    flagged:                 { icon: 'fa-flag',          color: 'text-amber-500',   bg: 'bg-amber-50',   label: 'Needs Review' },
    error:                   { icon: 'fa-circle-xmark',  color: 'text-red-500',     bg: 'bg-red-50',     label: 'Error' },
  };

  async function render(params = {}) {
    setPageHeader('Agent Activity', 'What the email agent has done');
    setPageActions(`
      <button onclick="agentPage.sync()" class="btn-secondary">
        <i class="fa-solid fa-rotate"></i><span class="hidden sm:inline">Sync Now</span>
      </button>
    `);

    if (params.reset) { page = 1; currentFilter = ''; }

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    let data = [];
    try {
      data = await api.getAgentActivity({ action_type: currentFilter, page, limit: LIMIT });
    } catch (_) {}

    content.innerHTML = buildPage(data);
  }

  function buildPage(items) {
    const filters = [
      { value: '', label: 'All' },
      { value: 'create_application', label: 'Applications' },
      { value: 'update_application_status', label: 'Status Updates' },
      { value: 'create_interview_round', label: 'Interviews' },
      { value: 'create_contact', label: 'Contacts' },
      { value: 'flagged', label: 'Needs Review' },
      { value: 'skipped', label: 'Skipped' },
    ];

    const filterPills = filters.map(f => `
      <button onclick="agentPage.setFilter('${f.value}')"
        class="px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${currentFilter === f.value
          ? 'bg-indigo-600 text-white border-transparent shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}">
        ${f.label}
      </button>
    `).join('');

    const itemsHtml = items.length
      ? items.map(item => renderItem(item)).join('')
      : `<div class="py-16 text-center">
          <i class="fa-solid fa-robot text-4xl text-slate-200 block mb-4"></i>
          <p class="text-slate-400 text-sm">No agent activity yet</p>
          <p class="text-slate-300 text-xs mt-1">Connect an email account in Settings to get started</p>
          <button onclick="navTo('settings')" class="btn-primary mt-5 text-sm">Go to Settings</button>
        </div>`;

    return `
      <!-- Filter bar -->
      <div class="flex flex-wrap gap-2 mb-5">${filterPills}</div>

      <!-- Activity list -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        ${itemsHtml}
      </div>

      ${items.length === LIMIT ? `
        <div class="flex justify-center mt-5">
          <button onclick="agentPage.loadMore()" class="btn-secondary">Load more</button>
        </div>
      ` : ''}
    `;
  }

  function renderItem(item) {
    const meta = ACTION_META[item.action_type] || ACTION_META.error;
    const isDone = item.status === 'done';
    const isFlagged = item.status === 'flagged';
    const isUndone = item.status === 'undone';

    const statusPill = isUndone
      ? '<span class="badge bg-slate-100 text-slate-400 text-[10px]">Undone</span>'
      : isFlagged
        ? '<span class="badge bg-amber-100 text-amber-600 text-[10px]">Review</span>'
        : '';

    const undoBtn = isDone && item.entity_id
      ? `<button onclick="agentPage.undo(${item.id})" class="text-xs text-slate-400 hover:text-red-500 transition-colors py-1 px-2 rounded hover:bg-red-50">
          <i class="fa-solid fa-rotate-left mr-1"></i>Undo
        </button>`
      : '';

    return `
      <div class="flex gap-3 sm:gap-4 px-4 sm:px-5 py-4 border-b border-slate-50 last:border-0 ${isUndone ? 'opacity-50' : ''}">
        <!-- Icon -->
        <div class="w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <i class="fa-solid ${meta.icon} ${meta.color} text-sm"></i>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-semibold ${meta.color}">${meta.label}</span>
                ${statusPill}
              </div>
              <p class="text-sm text-slate-800 font-medium mt-0.5 leading-snug truncate">${item.summary || '—'}</p>
            </div>
            ${undoBtn}
          </div>

          <!-- Email source -->
          <div class="mt-2 flex items-center gap-3 flex-wrap">
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <i class="fa-solid fa-envelope text-[10px]"></i>
              <span class="truncate max-w-[200px]">${item.email_subject || 'No subject'}</span>
            </span>
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <i class="fa-solid fa-user text-[10px]"></i>
              <span>${item.email_from || '—'}</span>
            </span>
            <span class="text-xs text-slate-300">${formatDateTime(item.email_date) || formatDateTime(item.created_at)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function setFilter(f) {
    currentFilter = f;
    page = 1;
    render();
  }

  async function loadMore() {
    page++;
    const data = await api.getAgentActivity({ action_type: currentFilter, page, limit: LIMIT });
    const list = document.querySelector('.bg-white.rounded-2xl');
    if (list) {
      const tmp = document.createElement('div');
      tmp.innerHTML = data.map(item => renderItem(item)).join('');
      list.append(...tmp.children);
    }
  }

  async function undo(id) {
    modal.confirm({
      title: 'Undo Action',
      message: 'This will delete the record that was created by the agent. Are you sure?',
      danger: true,
      onYes: async () => {
        try {
          await api.undoAgentActivity(id);
          toast.success('Action undone');
          render({ reset: false });
        } catch (e) {
          toast.error(e.message || 'Failed to undo');
        }
      },
    });
  }

  async function sync() {
    try {
      await api.triggerEmailSync();
      toast.success('Email sync triggered! Results will appear here shortly.');
      setTimeout(() => render({ reset: true }), 3000);
    } catch (e) {
      toast.error(e.message || 'Sync failed. Make sure an email account is connected in Settings.');
    }
  }

  return { render, setFilter, loadMore, undo, sync };
})();
