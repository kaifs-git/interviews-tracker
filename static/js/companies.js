// Companies page
const companiesPage = (() => {
  let companies = [];

  async function render() {
    setPageHeader('Companies', 'Manage companies you\'ve applied to');
    setPageActions(btn('Add Company', 'companiesPage.openAddModal()', 'primary', 'fa-plus'));

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="flex items-center justify-center py-24">
        <div class="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>`;

    try {
      companies = await api.getCompanies();
    } catch (e) {
      toast.error('Failed to load companies');
      companies = [];
    }

    content.innerHTML = renderList();
  }

  function renderList() {
    if (!companies.length) {
      return emptyState(
        'fa-building',
        'No companies yet',
        'Add companies where you\'ve applied.',
        btn('Add your first company', 'companiesPage.openAddModal()', 'primary', 'fa-plus')
      );
    }

    const cards = companies.map(c => `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-hover flex flex-col">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <span class="text-indigo-600 font-bold text-lg">${(c.name||'?')[0].toUpperCase()}</span>
            </div>
            <div class="min-w-0">
              <h3 class="font-bold text-slate-800 text-sm leading-tight truncate">${c.name}</h3>
              ${c.industry ? `<p class="text-slate-400 text-xs mt-0.5">${c.industry}</p>` : ''}
            </div>
          </div>
          <div class="flex gap-0.5 flex-shrink-0 ml-2">
            <button onclick="companiesPage.openEditModal(${c.id})"
              class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="companiesPage.confirmDelete(${c.id},'${(c.name||'').replace(/'/g,"\\'")}')"
              class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>

        <div class="flex-1 space-y-1.5 text-sm text-slate-500">
          ${c.location ? `<div class="flex items-center gap-2"><i class="fa-solid fa-location-dot w-4 text-center text-slate-300 text-xs"></i><span class="truncate">${c.location}</span></div>` : ''}
          ${c.website  ? `<div class="flex items-center gap-2"><i class="fa-solid fa-link w-4 text-center text-slate-300 text-xs"></i><a href="${c.website}" target="_blank" class="text-indigo-600 hover:underline truncate text-xs">${c.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
          ${c.size     ? `<div class="flex items-center gap-2"><i class="fa-solid fa-users w-4 text-center text-slate-300 text-xs"></i><span class="text-xs">${c.size}</span></div>` : ''}
        </div>

        <div class="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
          <span class="text-xs text-slate-400 font-medium">${c.application_count} application${c.application_count!==1?'s':''}</span>
          <button onclick="router.navigate('applications', {company_id:${c.id}})"
            class="text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
            View →
          </button>
        </div>
      </div>
    `).join('');

    return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">${cards}</div>`;
  }

  function companyForm(c = {}) {
    return `
      <form id="company-form">
        <div class="grid grid-cols-2 gap-4">
          ${field('Company Name', 'name', 'text', c.name, { required: true, placeholder: 'e.g. Google' })}
          ${field('Industry', 'industry', 'text', c.industry, { placeholder: 'e.g. Technology' })}
          ${field('Website', 'website', 'url', c.website, { placeholder: 'https://...' })}
          ${field('Location', 'location', 'text', c.location, { placeholder: 'e.g. Bengaluru, India' })}
          ${field('Company Size', 'size', 'select', c.size, { options: ['Startup','Small (10–50)','Medium (50–500)','Large (500–5000)','Enterprise (5000+)'] })}
        </div>
        ${field('Description / Notes', 'description', 'textarea', c.description, { placeholder: 'Brief description, culture notes...', rows: 3 })}
      </form>
    `;
  }

  function openAddModal() {
    modal.open({
      title: 'Add Company',
      body: companyForm(),
      footer: `
        <button onclick="modal.close()" class="btn-ghost">Cancel</button>
        <button onclick="companiesPage.submitCreate()" class="btn-primary">
          <i class="fa-solid fa-plus"></i>Add Company
        </button>`,
    });
  }

  function openEditModal(id) {
    const c = companies.find(c => c.id === id);
    if (!c) return;
    modal.open({
      title: 'Edit Company',
      body: companyForm(c),
      footer: `
        <button onclick="modal.close()" class="btn-ghost">Cancel</button>
        <button onclick="companiesPage.submitUpdate(${id})" class="btn-primary">Save Changes</button>`,
    });
  }

  async function submitCreate() {
    const form = document.getElementById('company-form');
    if (!form) return;
    const data = getFormData(form);
    if (!data.name) { toast.warning('Company name is required'); return; }
    try {
      const c = await api.createCompany(data);
      companies.push(c);
      modal.close();
      document.getElementById('page-content').innerHTML = renderList();
      toast.success('Company added');
    } catch (e) {
      toast.error(e.message || 'Failed to create company');
    }
  }

  async function submitUpdate(id) {
    const form = document.getElementById('company-form');
    if (!form) return;
    const data = getFormData(form);
    try {
      const updated = await api.updateCompany(id, data);
      const idx = companies.findIndex(c => c.id === id);
      if (idx !== -1) companies[idx] = updated;
      modal.close();
      document.getElementById('page-content').innerHTML = renderList();
      toast.success('Company updated');
    } catch (e) {
      toast.error(e.message || 'Failed to update company');
    }
  }

  function confirmDelete(id, name) {
    modal.confirm({
      title: 'Delete Company',
      message: `Delete <strong>${name}</strong>? All associated applications and contacts will also be deleted.`,
      onYes: () => deleteCompany(id),
    });
  }

  async function deleteCompany(id) {
    try {
      await api.deleteCompany(id);
      companies = companies.filter(c => c.id !== id);
      document.getElementById('page-content').innerHTML = renderList();
      toast.success('Company deleted');
    } catch (e) {
      toast.error(e.message || 'Failed to delete company');
    }
  }

  return { render, openAddModal, openEditModal, submitCreate, submitUpdate, confirmDelete };
})();
