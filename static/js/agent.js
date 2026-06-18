// Agent Activity Log page
const agentPage = (() => {
  let currentFilter = '';
  let page = 1;
  const LIMIT = 20;

  const ACTION_META = {
    create_application:       { icon: 'fa-file-lines',     color: 'text-indigo-600',  bg: 'bg-indigo-50',  label: 'Created Application' },
    update_application_status:{ icon: 'fa-rotate',         color: 'text-violet-600',  bg: 'bg-violet-50',  label: 'Updated Status' },
    create_interview_round:   { icon: 'fa-calendar-check', color: 'text-sky-600',     bg: 'bg-sky-50',     label: 'Scheduled Interview' },
    create_contact:           { icon: 'fa-user-plus',      color: 'text-teal-600',    bg: 'bg-teal-50',    label: 'Saved Contact' },
    skipped:                  { icon: 'fa-forward',        color: 'text-slate-400',   bg: 'bg-slate-100',  label: 'Skipped' },
    flagged:                  { icon: 'fa-flag',           color: 'text-amber-500',   bg: 'bg-amber-50',   label: 'Needs Review' },
    error:                    { icon: 'fa-circle-xmark',   color: 'text-red-500',     bg: 'bg-red-50',     label: 'Error' },
  };

  async function render(params = {}) {
    setPageHeader('Agent Activity', 'What the email agent has done');
    setPageActions(`
      <button onclick="agentPage.sync()" class="btn-secondary">
        <i class="fa-solid fa-rotate"></i><span class="hidden sm:inline ml-1.5">Sync Now</span>
      </button>
    `);

    if (params.reset) { page = 1; currentFilter = ''; }

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    // API returns { total, page, limit, items: [] }  — NOT a plain array
    let result = { items: [], total: 0 };
    try {
      result = await api.getAgentActivity({ action_type: currentFilter, page, limit: LIMIT });
    } catch (_) {}

    const items = Array.isArray(result) ? result : (result.items || []);
    const total = result.total ?? items.length;
    content.innerHTML = buildPage(items, total);
  }

  function buildPage(items, total = 0) {
    const filters = [
      { value: '',                         label: 'All' },
      { value: 'create_application',       label: 'Applications' },
      { value: 'update_application_status',label: 'Status Updates' },
      { value: 'create_interview_round',   label: 'Interviews' },
      { value: 'create_contact',           label: 'Contacts' },
      { value: 'flagged',                  label: 'Needs Review' },
      { value: 'skipped',                  label: 'Skipped' },
    ];

    const filterPills = filters.map(f => `
      <button onclick="agentPage.setFilter('${f.value}')"
        class="px-3 py-1.5 text-xs font-semibold rounded-full border transition-all whitespace-nowrap ${currentFilter === f.value
          ? 'bg-indigo-600 text-white border-transparent shadow-sm'
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'}">
        ${f.label}
      </button>
    `).join('');

    const itemsHtml = items.length
      ? items.map(item => renderItem(item)).join('')
      : `<div class="py-16 text-center px-4">
          <div class="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i class="fa-solid fa-robot text-2xl text-slate-300 dark:text-slate-500"></i>
          </div>
          <p class="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-1">No activity yet</p>
          <p class="text-slate-400 dark:text-slate-500 text-xs mb-5 max-w-xs mx-auto">
            The agent logs every email it processes here — connect a Gmail account to get started.
          </p>
          <button onclick="navTo('settings')" class="btn-primary text-sm">Go to Settings</button>
        </div>`;

    const hasMore = total > page * LIMIT;

    return `
      <div class="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">${filterPills}</div>

      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        ${itemsHtml}
      </div>

      ${hasMore ? `
        <div class="flex justify-center mt-5">
          <button onclick="agentPage.loadMore()" class="btn-secondary">
            <i class="fa-solid fa-chevron-down text-xs"></i> Load more
          </button>
        </div>
      ` : ''}
    `;
  }

  function renderItem(item) {
    const meta = ACTION_META[item.action_type] || ACTION_META.error;
    const isDone   = item.status === 'done';
    const isFlagged = item.status === 'flagged';
    const isError  = item.status === 'error';
    const isUndone = item.status === 'undone';

    const statusPill = isUndone
      ? '<span class="badge bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[10px]">Undone</span>'
      : isFlagged
        ? '<span class="badge bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px]">Review</span>'
        : isError
          ? '<span class="badge bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 text-[10px]">Error</span>'
          : '';

    const undoBtn = isDone && item.entity_id
      ? `<button onclick="agentPage.undo(${item.id})"
           class="flex-shrink-0 text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors py-1 px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
           <i class="fa-solid fa-rotate-left mr-1"></i>Undo
         </button>`
      : '';

    const dateStr = item.email_date || item.created_at;

    return `
      <div class="flex gap-3 px-4 py-3.5 border-b border-slate-50 dark:border-slate-700/60 last:border-0 ${isUndone ? 'opacity-40' : ''}">
        <div class="w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <i class="fa-solid ${meta.icon} ${meta.color} text-sm"></i>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span class="text-xs font-semibold ${meta.color}">${meta.label}</span>
                ${statusPill}
              </div>
              <p class="text-sm text-slate-800 dark:text-slate-100 font-medium leading-snug line-clamp-2">${item.summary || '—'}</p>
            </div>
            ${undoBtn}
          </div>

          <div class="mt-2 space-y-0.5">
            ${item.email_subject ? `
              <div class="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <i class="fa-solid fa-envelope text-[10px] flex-shrink-0"></i>
                <span class="truncate">${item.email_subject}</span>
              </div>` : ''}
            ${item.email_from ? `
              <div class="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <i class="fa-solid fa-user text-[10px] flex-shrink-0"></i>
                <span class="truncate">${item.email_from}</span>
              </div>` : ''}
            ${dateStr ? `<p class="text-[11px] text-slate-300 dark:text-slate-600 mt-0.5">${formatDateTime(dateStr)}</p>` : ''}
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
    let result = { items: [] };
    try {
      result = await api.getAgentActivity({ action_type: currentFilter, page, limit: LIMIT });
    } catch (_) { page--; return; }

    const items = Array.isArray(result) ? result : (result.items || []);
    if (!items.length) return;

    const list = document.querySelector('.bg-white.dark\\:bg-slate-800.rounded-2xl');
    if (list) {
      const tmp = document.createElement('div');
      tmp.innerHTML = items.map(item => renderItem(item)).join('');
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
      const btn = document.querySelector('[onclick="agentPage.sync()"]');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>'; }
      const res = await api.triggerEmailSync();
      const msg = res?.emails_new > 0
        ? `Sync done — ${res.emails_new} new email${res.emails_new !== 1 ? 's' : ''} processed`
        : res?.emails_found === 0
          ? 'Sync done — no new emails found'
          : 'Sync triggered! Refreshing…';
      toast.success(msg);
      setTimeout(() => render({ reset: true }), 2000);
    } catch (e) {
      toast.error(e.message || 'Sync failed — check Settings for a connected email account');
    }
  }

  return { render, setFilter, loadMore, undo, sync };
})();
