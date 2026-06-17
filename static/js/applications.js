// Applications list + detail page
const applicationsPage = (() => {
  let applications = [];
  let companies = [];
  let filters = {};

  const STAGES = ['Applied','Shortlisted','Phone Screen','Technical Round','HR Round','Final Round','Offer','Accepted','Rejected','Withdrawn'];
  const RESULTS = ['Pending','Selected','Rejected','Withdrawn','Offer Declined'];
  const SOURCES = ['LinkedIn','Naukri','Indeed','Company Website','Referral','Job Fair','Recruiter','Other'];
  const MODES = ['Remote','Hybrid','Onsite'];
  const TYPES = ['Full-time','Part-time','Contract','Internship','Freelance'];
  const CURRENCIES = ['INR','USD','EUR','GBP'];

  async function render(params = {}) {
    filters = params || {};
    setPageHeader('Applications', 'Track all your job applications');
    setPageActions(`
      ${btn('New Application', 'applicationsPage.openAddModal()', 'primary', 'fa-plus')}
    `);

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    try {
      [applications, companies] = await Promise.all([
        api.getApplications(filters),
        api.getCompanies(),
      ]);
    } catch (e) {
      toast.error('Failed to load applications');
      applications = [];
      companies = [];
    }

    content.innerHTML = renderList();
    updateAppBadge();
  }

  function updateAppBadge() {
    const badge = document.getElementById('app-count-badge');
    if (badge) {
      const active = applications.filter(a => a.final_result === 'Pending').length;
      if (active > 0) {
        badge.textContent = active;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  function renderFilters() {
    return `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-5">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex-1 min-w-48 relative">
            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input id="search-input" type="text" placeholder="Search role or company..." class="form-input pl-9 py-2"
              value="${filters.search || ''}" onkeyup="applicationsPage.applyFilter()" />
          </div>
          <select id="filter-stage" class="form-input w-auto py-2" onchange="applicationsPage.applyFilter()">
            <option value="">All Stages</option>
            ${STAGES.map(s => `<option value="${s}" ${filters.stage === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <select id="filter-result" class="form-input w-auto py-2" onchange="applicationsPage.applyFilter()">
            <option value="">All Results</option>
            ${RESULTS.map(r => `<option value="${r}" ${filters.result === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
          <select id="filter-priority" class="form-input w-auto py-2" onchange="applicationsPage.applyFilter()">
            <option value="">All Priorities</option>
            ${['High','Medium','Low'].map(p => `<option value="${p}" ${filters.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          ${filters.company_id ? `<button onclick="applicationsPage.clearFilters()" class="text-sm text-slate-500 hover:text-red-500 transition-colors"><i class="fa-solid fa-xmark mr-1"></i>Clear</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderList() {
    const rows = applications.length
      ? applications.map(a => `
        <tr class="cursor-pointer hover:bg-slate-50 transition-colors" onclick="router.navigate('application-detail', {id:${a.id}})">
          <td class="px-5 py-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">
                ${(a.company_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p class="font-semibold text-slate-800 text-sm">${a.job_title}</p>
                <p class="text-slate-400 text-xs">${a.company_name || '—'}</p>
              </div>
            </div>
          </td>
          <td class="px-5 py-4">${statusBadge(a.current_stage, a.final_result)}</td>
          <td class="px-5 py-4">${a.work_mode ? workModeChip(a.work_mode) : '<span class="text-slate-300">—</span>'}</td>
          <td class="px-5 py-4 text-sm text-slate-600">${formatPay(a.payscale_min, a.payscale_max, a.payscale_currency, a.payscale_type)}</td>
          <td class="px-5 py-4">
            <div class="flex items-center gap-1 text-sm text-slate-600">
              <i class="fa-solid fa-microphone-lines text-slate-400 text-xs"></i>
              ${a.interview_count}
            </div>
          </td>
          <td class="px-5 py-4 text-sm text-slate-500">${formatDate(a.application_date)}</td>
          <td class="px-5 py-4">
            <span class="text-sm ${a.priority === 'High' ? 'priority-high' : a.priority === 'Low' ? 'priority-low' : 'priority-medium'} font-medium">${priorityIcon(a.priority)} ${a.priority}</span>
          </td>
          <td class="px-5 py-4">
            <div class="flex gap-1" onclick="event.stopPropagation()">
              <button onclick="applicationsPage.openEditModal(${a.id})" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Edit">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
              </button>
              <button onclick="applicationsPage.confirmDelete(${a.id},'${a.job_title.replace(/'/g,"\\\'")}')" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('')
      : `<tr><td colspan="8"><div class="empty-state py-14">
          <i class="fa-solid fa-folder-open text-3xl text-slate-200 block mb-3"></i>
          <h3 class="text-slate-500 font-medium mb-1">No applications found</h3>
          <p class="text-slate-400 text-sm mb-4">Start by adding your first job application</p>
          ${btn('Add Application', 'applicationsPage.openAddModal()', 'primary', 'fa-plus')}
        </div></td></tr>`;

    return `
      ${renderFilters()}
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p class="text-sm text-slate-500">${applications.length} application${applications.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Role / Company</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Pay Range</th>
                <th>Interviews</th>
                <th>Applied</th>
                <th>Priority</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function applyFilter() {
    const search = document.getElementById('search-input')?.value || '';
    const stage = document.getElementById('filter-stage')?.value || '';
    const result = document.getElementById('filter-result')?.value || '';
    const priority = document.getElementById('filter-priority')?.value || '';
    filters = { ...filters, search, stage, result, priority };
    // Re-fetch with filters
    api.getApplications(filters).then(data => {
      applications = data;
      const content = document.getElementById('page-content');
      if (content) content.innerHTML = renderList();
    }).catch(() => {});
  }

  function clearFilters() {
    filters = {};
    render({});
  }

  function appForm(a = {}) {
    const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));
    const today = new Date().toISOString().split('T')[0];

    return `
      <form id="app-form">
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Company', 'company_id', 'select', a.company_id, { required: true, options: companyOptions })}
          ${field('Job Title', 'job_title', 'text', a.job_title, { required: true, placeholder: 'e.g. Senior Software Engineer' })}
        </div>
        ${field('Job Description', 'job_description', 'textarea', a.job_description, { placeholder: 'Paste the JD or add key points...', rows: 4 })}
        <div class="grid grid-cols-3 gap-x-5">
          ${field('Pay Min', 'payscale_min', 'number', a.payscale_min, { placeholder: '800000' })}
          ${field('Pay Max', 'payscale_max', 'number', a.payscale_max, { placeholder: '1200000' })}
          ${field('Currency', 'payscale_currency', 'select', a.payscale_currency || 'INR', { options: CURRENCIES })}
        </div>
        <div class="grid grid-cols-3 gap-x-5">
          ${field('Pay Type', 'payscale_type', 'select', a.payscale_type || 'Annual', { options: ['Annual','Monthly'] })}
          ${field('Work Mode', 'work_mode', 'select', a.work_mode, { options: MODES })}
          ${field('Job Type', 'job_type', 'select', a.job_type, { options: TYPES })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Location', 'location', 'text', a.location, { placeholder: 'City, State' })}
          ${field('Experience Required', 'experience_required', 'text', a.experience_required, { placeholder: '3–5 years' })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Applied Date', 'application_date', 'date', a.application_date || today)}
          ${field('Source', 'source', 'select', a.source, { options: SOURCES })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Current Stage', 'current_stage', 'select', a.current_stage || 'Applied', { options: STAGES })}
          ${field('Priority', 'priority', 'select', a.priority || 'Medium', { options: ['High','Medium','Low'] })}
        </div>
        ${field('Job URL', 'job_url', 'url', a.job_url, { placeholder: 'https://...' })}
        ${field('Referral Name', 'referral_name', 'text', a.referral_name, { placeholder: 'Who referred you?' })}
        ${field('Notes', 'notes', 'textarea', a.notes, { placeholder: 'Additional notes...', rows: 2 })}
      </form>
    `;
  }

  async function openAddModal() {
    // Load companies if not already loaded (e.g. opened from dashboard shortcut)
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
      title: 'New Job Application',
      body: appForm(),
      footer: `
        <button onclick="modal.close()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button onclick="applicationsPage.submitCreate()" class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
          <i class="fa-solid fa-plus mr-1"></i>Add Application
        </button>
      `,
      wide: true,
    });
  }

  async function openEditModal(id) {
    let a;
    try {
      // Ensure companies are loaded (may be empty if opened from detail page)
      if (!companies.length) {
        companies = await api.getCompanies();
      }
      a = await api.getApplication(id);
    } catch (e) {
      toast.error('Failed to load application');
      return;
    }
    modal.open({
      title: 'Edit Application',
      body: appForm(a),
      footer: `
        <button onclick="modal.close()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button onclick="applicationsPage.submitUpdate(${id})" class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
          Save Changes
        </button>
      `,
      wide: true,
    });
  }

  async function submitCreate() {
    const form = document.getElementById('app-form');
    if (!form) return;
    const data = getFormData(form);
    if (!data.company_id) { toast.warning('Please select a company'); return; }
    if (!data.job_title) { toast.warning('Job title is required'); return; }
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
      // If we're on the detail page, refresh it — don't replace with the list
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

  return { render, applyFilter, clearFilters, openAddModal, openEditModal, submitCreate, submitUpdate, confirmDelete, getCompanies };
})();
