// Companies page
const companiesPage = (() => {
  let companies = [];

  async function render() {
    setPageHeader('Companies', 'Manage companies you\'ve applied to');
    setPageActions(btn('Add Company', 'companiesPage.openAddModal()', 'primary', 'fa-plus'));

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

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
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 card-hover flex flex-col">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <span class="text-indigo-600 font-bold text-lg">${(c.name || '?')[0].toUpperCase()}</span>
            </div>
            <div>
              <h3 class="font-bold text-slate-800 text-base">${c.name}</h3>
              ${c.industry ? `<p class="text-slate-400 text-xs">${c.industry}</p>` : ''}
            </div>
          </div>
          <div class="flex gap-1">
            <button onclick="companiesPage.openEditModal(${c.id})" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
              <i class="fa-solid fa-pen-to-square text-sm"></i>
            </button>
            <button onclick="companiesPage.confirmDelete(${c.id},'${c.name.replace(/'/g,"\\\'")}')" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
              <i class="fa-solid fa-trash text-sm"></i>
            </button>
          </div>
        </div>
        <div class="flex-1 space-y-2 text-sm text-slate-500">
          ${c.location ? `<div class="flex items-center gap-2"><i class="fa-solid fa-location-dot w-4 text-center text-slate-400"></i>${c.location}</div>` : ''}
          ${c.website ? `<div class="flex items-center gap-2"><i class="fa-solid fa-link w-4 text-center text-slate-400"></i><a href="${c.website}" target="_blank" class="text-indigo-600 hover:underline truncate">${c.website}</a></div>` : ''}
          ${c.size ? `<div class="flex items-center gap-2"><i class="fa-solid fa-users w-4 text-center text-slate-400"></i>${c.size}</div>` : ''}
        </div>
        <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span class="text-xs text-slate-400">${c.application_count} application${c.application_count !== 1 ? 's' : ''}</span>
          <button onclick="router.navigate('applications', {company_id:${c.id}})" class="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View →</button>
        </div>
      </div>
    `).join('');

    return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${cards}</div>`;
  }

  function companyForm(c = {}) {
    return `
      <form id="company-form" class="space-y-0">
        <div class="grid grid-cols-2 gap-4">
          ${field('Company Name', 'name', 'text', c.name, { required: true, placeholder: 'e.g. Google' })}
          ${field('Industry', 'industry', 'text', c.industry, { placeholder: 'e.g. Technology' })}
          ${field('Website', 'website', 'url', c.website, { placeholder: 'https://...' })}
          ${field('Location', 'location', 'text', c.location, { placeholder: 'e.g. Bengaluru, India' })}
          ${field('Company Size', 'size', 'select', c.size, { options: ['Startup', 'Small (10–50)', 'Medium (50–500)', 'Large (500–5000)', 'Enterprise (5000+)'] })}
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
        <button onclick="modal.close()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button onclick="companiesPage.submitCreate()" class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
          <i class="fa-solid fa-plus mr-1"></i>Add Company
        </button>
      `,
    });
  }

  function openEditModal(id) {
    const c = companies.find(c => c.id === id);
    if (!c) return;
    modal.open({
      title: 'Edit Company',
      body: companyForm(c),
      footer: `
        <button onclick="modal.close()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button onclick="companiesPage.submitUpdate(${id})" class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
          Save Changes
        </button>
      `,
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
