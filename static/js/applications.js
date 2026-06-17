// Applications list + detail page
const applicationsPage = (() => {
  let applications = [];
  let companies    = [];
  let filters      = {};
  let filtersOpen  = false;

  const STAGES  = ['Applied','Shortlisted','Phone Screen','Technical Round','HR Round','Final Round','Offer','Accepted','Rejected','Withdrawn'];
  const RESULTS = ['Pending','Selected','Rejected','Withdrawn','Offer Declined'];
  const SOURCES = ['LinkedIn','Naukri','Indeed','Company Website','Referral','Job Fair','Recruiter','Other'];
  const MODES   = ['Remote','Hybrid','Onsite'];
  const TYPES   = ['Full-time','Part-time','Contract','Internship','Freelance'];

  async function render(params = {}) {
    filters = params || {};
    setPageHeader('Applications', 'Track all your job applications');
    setPageActions(btn('Add', 'applicationsPage.openAddModal()', 'primary', 'fa-plus'));

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="flex items-center justify-center py-24">
        <div class="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>`;

    try {
      [applications, companies] = await Promise.all([
        api.getApplications(filters),
        api.getCompanies(),
      ]);
    } catch (e) {
      toast.error('Failed to load applications');
      applications = []; companies = [];
    }

    content.innerHTML = renderList();
    updateAppBadge();
  }

  function updateAppBadge() {
    const badge = document.getElementById('app-count-badge');
    if (badge) {
      const active = applications.filter(a => a.final_result === 'Pending').length;
      if (active > 0) { badge.textContent = active; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    }
  }

  function hasActiveFilter() {
    return !!(filters.search || filters.stage || filters.result || filters.priority || filters.company_id);
  }

  function renderFilters() {
    const active = hasActiveFilter();
    // On desktop always show; on mobile show toggle button + collapsible panel
    return `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
        <!-- Mobile filter toggle header -->
        <div class="flex items-center justify-between px-4 py-3 sm:hidden border-b border-slate-50 cursor-pointer"
          onclick="applicationsPage.toggleFilters()">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <i class="fa-solid fa-sliders text-slate-400"></i>
            Filters
            ${active ? `<span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>` : ''}
          </div>
          <i class="fa-solid fa-chevron-${filtersOpen ? 'up' : 'down'} text-slate-400 text-xs"></i>
        </div>

        <!-- Filter fields: always visible on sm+, collapsible on mobile -->
        <div id="filter-panel" class="${filtersOpen ? '' : 'hidden'} sm:block p-3 sm:p-4">
          <div class="flex flex-col sm:flex-row gap-2.5">
            <!-- Search -->
            <div class="flex-1 relative">
              <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
              <input id="search-input" type="text" placeholder="Search role or company…"
                class="form-input pl-9" value="${filters.search || ''}"
                onkeyup="applicationsPage.applyFilter()" />
            </div>
            <!-- Dropdowns -->
            <div class="grid grid-cols-3 sm:flex gap-2">
              <select id="filter-stage" class="form-input text-sm" onchange="applicationsPage.applyFilter()">
                <option value="">All Stages</option>
                ${STAGES.map(s => `<option value="${s}" ${filters.stage===s?'selected':''}>${s}</option>`).join('')}
              </select>
              <select id="filter-result" class="form-input text-sm" onchange="applicationsPage.applyFilter()">
                <option value="">All Results</option>
                ${RESULTS.map(r => `<option value="${r}" ${filters.result===r?'selected':''}>${r}</option>`).join('')}
              </select>
              <select id="filter-priority" class="form-input text-sm" onchange="applicationsPage.applyFilter()">
                <option value="">All Priority</option>
                ${['High','Medium','Low'].map(p => `<option value="${p}" ${filters.priority===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </div>
            ${active ? `
              <button onclick="applicationsPage.clearFilters()"
                class="flex items-center justify-center gap-1.5 px-3 text-sm text-slate-500 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-xl transition-colors border border-slate-200 sm:flex-shrink-0">
                <i class="fa-solid fa-xmark"></i><span>Clear</span>
              </button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function toggleFilters() {
    filtersOpen = !filtersOpen;
    const panel = document.getElementById('filter-panel');
    const icon  = document.querySelector('[onclick="applicationsPage.toggleFilters()"] i.fa-chevron-up, [onclick="applicationsPage.toggleFilters()"] i.fa-chevron-down');
    if (panel) panel.classList.toggle('hidden', !filtersOpen);
    if (icon) {
      icon.classList.toggle('fa-chevron-down', !filtersOpen);
      icon.classList.toggle('fa-chevron-up', filtersOpen);
    }
  }

  function renderMobileCards() {
    if (!applications.length) {
      return `<div class="sm:hidden">
        ${emptyState('fa-folder-open', 'No applications found', 'Start by adding your first job application',
          btn('Add Application', 'applicationsPage.openAddModal()', 'primary', 'fa-plus'))}
      </div>`;
    }
    const cards = applications.map(a => `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer active:scale-[0.99] transition-transform"
        onclick="router.navigate('application-detail', {id:${a.id}})">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-10 h-10 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-indigo-600 text-sm">
              ${(a.company_name||'?')[0].toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-slate-800 text-sm leading-snug truncate">${a.job_title}</p>
              <p class="text-slate-400 text-xs mt-0.5">${a.company_name||'—'}</p>
            </div>
          </div>
          <div class="flex gap-0.5 ml-2 flex-shrink-0" onclick="event.stopPropagation()">
            <button onclick="applicationsPage.openEditModal(${a.id})"
              class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="applicationsPage.confirmDelete(${a.id},'${(a.job_title||'').replace(/'/g,"\\'")}')"
              class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 mb-2.5">
          ${statusBadge(a.current_stage, a.final_result)}
          ${a.work_mode ? workModeChip(a.work_mode) : ''}
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500">
          <span class="font-medium text-slate-600">${formatPay(a.payscale_min, a.payscale_max, a.payscale_currency, a.payscale_type)}</span>
          <div class="flex items-center gap-2.5">
            <span class="${priorityColor(a.priority)} font-medium">${priorityIcon(a.priority)} ${a.priority}</span>
            <span><i class="fa-solid fa-microphone-lines text-slate-300 mr-0.5"></i>${a.interview_count}</span>
            <span>${formatDate(a.application_date)}</span>
          </div>
        </div>
      </div>
    `).join('');
    return `<div class="sm:hidden space-y-3">${cards}</div>`;
  }

  function renderDesktopTable() {
    const rows = applications.length
      ? applications.map(a => `
        <tr class="cursor-pointer hover:bg-slate-50/80 transition-colors"
          onclick="router.navigate('application-detail', {id:${a.id}})">
          <td class="px-5 py-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-indigo-600 text-sm">
                ${(a.company_name||'?')[0].toUpperCase()}
              </div>
              <div>
                <p class="font-semibold text-slate-800 text-sm">${a.job_title}</p>
                <p class="text-slate-400 text-xs">${a.company_name||'—'}</p>
              </div>
            </div>
          </td>
          <td class="px-5 py-4">${statusBadge(a.current_stage, a.final_result)}</td>
          <td class="px-5 py-4">${a.work_mode ? workModeChip(a.work_mode) : '<span class="text-slate-300">—</span>'}</td>
          <td class="px-5 py-4 text-sm text-slate-600">${formatPay(a.payscale_min, a.payscale_max, a.payscale_currency, a.payscale_type)}</td>
          <td class="px-5 py-4 text-sm text-slate-600">
            <span class="flex items-center gap-1"><i class="fa-solid fa-microphone-lines text-slate-300 text-xs"></i>${a.interview_count}</span>
          </td>
          <td class="px-5 py-4 text-sm text-slate-500">${formatDate(a.application_date)}</td>
          <td class="px-5 py-4 text-sm ${priorityColor(a.priority)} font-medium">${priorityIcon(a.priority)} ${a.priority}</td>
          <td class="px-5 py-4">
            <div class="flex gap-1" onclick="event.stopPropagation()">
              <button onclick="applicationsPage.openEditModal(${a.id})"
                class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
              </button>
              <button onclick="applicationsPage.confirmDelete(${a.id},'${(a.job_title||'').replace(/'/g,"\\'")}')"
                class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('')
      : `<tr><td colspan="8">
          <div class="empty-state py-14">
            <i class="fa-solid fa-folder-open"></i>
            <h3>No applications found</h3>
            <p>Start by adding your first job application</p>
            <div class="mt-5">${btn('Add Application', 'applicationsPage.openAddModal()', 'primary', 'fa-plus')}</div>
          </div>
        </td></tr>`;

    return `
      <div class="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-50">
          <p class="text-sm text-slate-500 font-medium">${applications.length} application${applications.length!==1?'s':''}</p>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Role / Company</th><th>Status</th><th>Mode</th>
                <th>Pay Range</th><th>Rounds</th><th>Applied</th>
                <th>Priority</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderList() {
    const countLine = `<p class="text-xs text-slate-400 mb-3 sm:hidden font-medium">${applications.length} application${applications.length!==1?'s':''}</p>`;
    return renderFilters() + countLine + renderMobileCards() + renderDesktopTable();
  }

  function applyFilter() {
    const search   = document.getElementById('search-input')?.value || '';
    const stage    = document.getElementById('filter-stage')?.value || '';
    const result   = document.getElementById('filter-result')?.value || '';
    const priority = document.getElementById('filter-priority')?.value || '';
    filters = { ...filters, search, stage, result, priority };
    api.getApplications(filters).then(data => {
      applications = data;
      const content = document.getElementById('page-content');
      if (content) content.innerHTML = renderList();
    }).catch(() => {});
  }

  function clearFilters() { filters = {}; filtersOpen = false; render({}); }

  function appForm(a = {}) {
    const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));
    const today = new Date().toISOString().split('T')[0];
    return `
      <form id="app-form">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          ${searchableSelect('Company', 'company_id', a.company_id, companyOptions, true)}
          ${field('Job Title', 'job_title', 'text', a.job_title, { required: true, placeholder: 'e.g. Senior Software Engineer' })}
        </div>
        ${field('Job Description', 'job_description', 'textarea', a.job_description, { placeholder: 'Paste the JD or add key points…', rows: 3 })}

        <div class="form-section-divider">Compensation</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-5">
          ${field('Pay Min', 'payscale_min', 'number', a.payscale_min, { placeholder: '800000' })}
          ${field('Pay Max', 'payscale_max', 'number', a.payscale_max, { placeholder: '1200000' })}
          ${field('Pay Type', 'payscale_type', 'select', a.payscale_type || 'Annual', { options: ['Annual','Monthly'] })}
        </div>
        ${pillSelect('Currency', 'payscale_currency', a.payscale_currency || 'INR', [
          { value:'INR', label:'₹ INR', active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'USD', label:'$ USD', active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'EUR', label:'€ EUR', active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'GBP', label:'£ GBP', active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
        ])}

        <div class="form-section-divider">Job Details</div>
        ${pillSelect('Work Mode', 'work_mode', a.work_mode, [
          { value:'Remote', label:'🌐 Remote', active:'bg-teal-600 text-white',   color:'bg-slate-100 text-slate-600' },
          { value:'Hybrid', label:'🔀 Hybrid', active:'bg-violet-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'Onsite', label:'🏢 Onsite', active:'bg-orange-500 text-white', color:'bg-slate-100 text-slate-600' },
        ])}
        ${pillSelect('Job Type', 'job_type', a.job_type, [
          { value:'Full-time',  label:'Full-time',  active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'Part-time',  label:'Part-time',  active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'Contract',   label:'Contract',   active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'Internship', label:'Internship', active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
          { value:'Freelance',  label:'Freelance',  active:'bg-indigo-600 text-white', color:'bg-slate-100 text-slate-600' },
        ])}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          ${field('Location', 'location', 'text', a.location, { placeholder: 'City, State' })}
          ${field('Experience Required', 'experience_required', 'text', a.experience_required, { placeholder: '3–5 years' })}
        </div>

        <div class="form-section-divider">Application</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          ${field('Applied Date', 'application_date', 'date', a.application_date || today)}
          ${field('Source', 'source', 'select', a.source, { options: SOURCES })}
        </div>
        ${field('Job URL', 'job_url', 'url', a.job_url, { placeholder: 'https://…' })}
        ${field('Referral Name', 'referral_name', 'text', a.referral_name, { placeholder: 'Who referred you?' })}

        <div class="form-section-divider">Status</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          ${field('Current Stage', 'current_stage', 'select', a.current_stage || 'Applied', { options: STAGES })}
          ${field('Final Result', 'final_result', 'select', a.final_result || 'Pending', { options: RESULTS })}
        </div>
        ${pillSelect('Priority', 'priority', a.priority || 'Medium', [
          { value:'High',   label:'🔴 High',   active:'bg-red-500 text-white',     color:'bg-slate-100 text-slate-600' },
          { value:'Medium', label:'🟡 Medium', active:'bg-amber-500 text-white',   color:'bg-slate-100 text-slate-600' },
          { value:'Low',    label:'🟢 Low',    active:'bg-emerald-600 text-white', color:'bg-slate-100 text-slate-600' },
        ])}
        ${field('Notes', 'notes', 'textarea', a.notes, { placeholder: 'Additional notes…', rows: 2 })}
      </form>
    `;
  }

  async function openAddModal() {
    if (!companies.length) {
      try { companies = await api.getCompanies(); } catch (_) {}
    }
    if (!companies.length) {
      modal.confirm({
        title: 'No Companies Yet',
        message: 'You need to add a company first before creating an application.',
        onYes: () => router.navigate('companies'),
        danger: false,
      });
      return;
    }
    modal.open({
      title: 'New Application',
      body: appForm(),
      footer: `
        <button onclick="modal.close()" class="btn-ghost">Cancel</button>
        <button onclick="applicationsPage.submitCreate()" class="btn-primary">
          <i class="fa-solid fa-plus"></i>Add Application
        </button>`,
      wide: true,
    });
  }

  async function openEditModal(id) {
    let a;
    try {
      if (!companies.length) companies = await api.getCompanies();
      a = await api.getApplication(id);
    } catch (e) {
      toast.error('Failed to load application');
      return;
    }
    modal.open({
      title: 'Edit Application',
      body: appForm(a),
      footer: `
        <button onclick="modal.close()" class="btn-ghost">Cancel</button>
        <button onclick="applicationsPage.submitUpdate(${id})" class="btn-primary">Save Changes</button>`,
      wide: true,
    });
  }

  async function submitCreate() {
    const form = document.getElementById('app-form');
    if (!form) return;
    const data = getFormData(form);
    if (!data.company_id) { toast.warning('Please select a company'); return; }
    if (!data.job_title)  { toast.warning('Job title is required');   return; }
    if (data.company_id) data.company_id = parseInt(data.company_id);
    try {
      const app = await api.createApplication(data);
      applications.unshift(app);
      modal.close();
      document.getElementById('page-content').innerHTML = renderList();
      updateAppBadge();
      toast.success('Application added');
    } catch (e) {
      toast.error(e.message || 'Failed to create application');
    }
  }

  async function submitUpdate(id) {
    const form = document.getElementById('app-form');
    if (!form) return;
    const data = getFormData(form);
    if (data.company_id) data.company_id = parseInt(data.company_id);
    try {
      const updated = await api.updateApplication(id, data);
      const idx = applications.findIndex(a => a.id === id);
      if (idx !== -1) applications[idx] = updated;
      modal.close();
      toast.success('Application updated');
      if (router.getCurrentPage() === 'application-detail') {
        applicationDetailPage.render({ id });
      } else {
        document.getElementById('page-content').innerHTML = renderList();
      }
    } catch (e) {
      toast.error(e.message || 'Failed to update application');
    }
  }

  function confirmDelete(id, title) {
    modal.confirm({
      title: 'Delete Application',
      message: `Delete <strong>${title}</strong>? All interview rounds and contacts linked to this application will also be removed.`,
      onYes: () => deleteApp(id),
    });
  }

  async function deleteApp(id) {
    try {
      await api.deleteApplication(id);
      applications = applications.filter(a => a.id !== id);
      document.getElementById('page-content').innerHTML = renderList();
      updateAppBadge();
      toast.success('Application deleted');
    } catch (e) {
      toast.error('Failed to delete application');
    }
  }

  function getCompanies() { return companies; }

  return {
    render, applyFilter, clearFilters, toggleFilters,
    openAddModal, openEditModal, submitCreate, submitUpdate,
    confirmDelete, getCompanies,
  };
})();
