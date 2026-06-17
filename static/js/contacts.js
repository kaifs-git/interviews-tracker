// Contacts page
const contactsPage = (() => {
  let contacts  = [];
  let companies = [];

  async function render(params = {}) {
    setPageHeader('Contacts', 'People you\'ve interacted with during your job search');
    setPageActions(btn('Add Contact', 'contactsPage.openAddModal()', 'primary', 'fa-plus'));

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="flex items-center justify-center py-24">
        <div class="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>`;

    try {
      [contacts, companies] = await Promise.all([api.getContacts(params), api.getCompanies()]);
    } catch (e) {
      toast.error('Failed to load contacts');
      contacts = []; companies = [];
    }
    content.innerHTML = renderList();
  }

  function renderMobileCards() {
    if (!contacts.length) return '';
    const cards = contacts.map(c => `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-11 h-11 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-full flex items-center justify-center font-bold text-indigo-600 text-base flex-shrink-0">
              ${(c.name||'?')[0].toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-slate-800 text-sm">${c.name}</p>
              <p class="text-slate-400 text-xs mt-0.5 truncate">${[c.designation, c.company_name].filter(Boolean).join(' · ') || '—'}</p>
            </div>
          </div>
          <div class="flex gap-0.5 ml-2 flex-shrink-0">
            <button onclick="contactsPage.openEditModal(${c.id})"
              class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="contactsPage.confirmDelete(${c.id},'${(c.name||'').replace(/'/g,"\\'")}')"
              class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>
        ${(c.email || c.phone || c.linkedin) ? `
        <div class="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-2">
          ${c.email    ? `<a href="mailto:${c.email}" class="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"><i class="fa-solid fa-envelope text-slate-400 text-xs"></i>${c.email}</a>` : ''}
          ${c.phone    ? `<a href="tel:${c.phone}" class="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"><i class="fa-solid fa-phone text-slate-400 text-xs"></i>${c.phone}</a>` : ''}
          ${c.linkedin ? `<a href="${c.linkedin}" target="_blank" class="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"><i class="fa-brands fa-linkedin text-xs"></i>LinkedIn</a>` : ''}
        </div>` : ''}
        ${c.notes ? `<p class="mt-2 text-xs text-slate-400 truncate">${c.notes}</p>` : ''}
      </div>
    `).join('');
    return `<div class="sm:hidden space-y-3">${cards}</div>`;
  }

  function renderDesktopTable() {
    if (!contacts.length) return '';
    const rows = contacts.map(c => `
      <tr>
        <td class="px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-full flex items-center justify-center font-bold text-indigo-600 text-sm flex-shrink-0">
              ${(c.name||'?')[0].toUpperCase()}
            </div>
            <div>
              <p class="font-semibold text-slate-800 text-sm">${c.name}</p>
              ${c.linkedin ? `<a href="${c.linkedin}" target="_blank" class="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5"><i class="fa-brands fa-linkedin"></i>LinkedIn</a>` : ''}
            </div>
          </div>
        </td>
        <td class="px-5 py-4 text-sm text-slate-600">
          ${c.designation || '<span class="text-slate-300">—</span>'}
          ${c.department ? `<br><span class="text-xs text-slate-400">${c.department}</span>` : ''}
        </td>
        <td class="px-5 py-4 text-sm text-slate-600">${c.company_name || '<span class="text-slate-300">—</span>'}</td>
        <td class="px-5 py-4">
          ${c.email ? `<a href="mailto:${c.email}" class="text-sm text-slate-600 hover:text-indigo-600 flex items-center gap-1.5"><i class="fa-solid fa-envelope text-slate-400 text-xs"></i>${c.email}</a>` : ''}
          ${c.phone ? `<a href="tel:${c.phone}" class="text-sm text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 mt-0.5"><i class="fa-solid fa-phone text-slate-400 text-xs"></i>${c.phone}</a>` : ''}
          ${!c.email && !c.phone ? '<span class="text-slate-300 text-sm">—</span>' : ''}
        </td>
        <td class="px-5 py-4 text-sm text-slate-500">
          ${c.notes ? `<span title="${c.notes}" class="cursor-help">${c.notes.slice(0,40)}${c.notes.length>40?'…':''}</span>` : '<span class="text-slate-300">—</span>'}
        </td>
        <td class="px-5 py-4">
          <div class="flex gap-1">
            <button onclick="contactsPage.openEditModal(${c.id})"
              class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="contactsPage.confirmDelete(${c.id},'${(c.name||'').replace(/'/g,"\\'")}')"
              class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-50">
          <p class="text-sm text-slate-500 font-medium">${contacts.length} contact${contacts.length!==1?'s':''}</p>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Company</th><th>Contact Info</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderList() {
    if (!contacts.length) {
      return emptyState(
        'fa-address-book',
        'No contacts yet',
        'Add recruiters, hiring managers, and other contacts.',
        btn('Add Contact', 'contactsPage.openAddModal()', 'primary', 'fa-plus')
      );
    }
    const countLine = `<p class="text-xs text-slate-400 mb-3 sm:hidden font-medium">${contacts.length} contact${contacts.length!==1?'s':''}</p>`;
    return countLine + renderMobileCards() + renderDesktopTable();
  }

  function contactForm(c = {}, preselect = {}) {
    const companyOptions = companies.map(co => ({ value: co.id, label: co.name }));
    return `
      <form id="contact-form">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          ${field('Full Name', 'name', 'text', c.name, { required: true, placeholder: 'Jane Smith' })}
          ${field('Designation / Title', 'designation', 'text', c.designation, { placeholder: 'Senior Recruiter' })}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          ${field('Department', 'department', 'text', c.department, { placeholder: 'Engineering, HR…' })}
          ${searchableSelect('Company', 'company_id', c.company_id || preselect.company_id, companyOptions, true)}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
          ${field('Email', 'email', 'email', c.email, { placeholder: 'jane@company.com' })}
          ${field('Phone', 'phone', 'tel', c.phone, { placeholder: '+91 98765 43210' })}
        </div>
        ${field('LinkedIn URL', 'linkedin', 'url', c.linkedin, { placeholder: 'https://linkedin.com/in/…' })}
        ${c.application_id || preselect.application_id
          ? `<input type="hidden" name="application_id" value="${c.application_id || preselect.application_id}" />`
          : ''}
        ${field('Notes', 'notes', 'textarea', c.notes, { placeholder: 'How you met, last conversation…', rows: 2 })}
      </form>`;
  }

  async function openAddModal(preselect = {}) {
    if (!companies.length) { try { companies = await api.getCompanies(); } catch (_) {} }
    modal.open({
      title: 'Add Contact',
      body: contactForm({}, preselect),
      footer: `
        <button onclick="modal.close()" class="btn-ghost">Cancel</button>
        <button onclick="contactsPage.submitCreate()" class="btn-primary">
          <i class="fa-solid fa-plus"></i>Add Contact
        </button>`,
    });
  }

  async function openAddModalForApp(appId, companyId) {
    if (!companies.length) { try { companies = await api.getCompanies(); } catch (_) {} }
    openAddModal({ application_id: appId, company_id: companyId });
  }

  function openEditModal(id) {
    const c = contacts.find(c => c.id === id);
    if (!c) return;
    modal.open({
      title: 'Edit Contact',
      body: contactForm(c),
      footer: `
        <button onclick="modal.close()" class="btn-ghost">Cancel</button>
        <button onclick="contactsPage.submitUpdate(${id})" class="btn-primary">Save Changes</button>`,
    });
  }

  async function submitCreate() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const data = getFormData(form);
    if (!data.name)       { toast.warning('Name is required');            return; }
    if (!data.company_id) { toast.warning('Please select a company');     return; }
    if (data.company_id)     data.company_id     = parseInt(data.company_id);
    if (data.application_id) data.application_id = parseInt(data.application_id);
    try {
      const contact = await api.createContact(data);
      contacts.push(contact);
      modal.close();
      document.getElementById('page-content').innerHTML = renderList();
      toast.success('Contact added');
      if (typeof applicationDetailPage !== 'undefined' && data.application_id) {
        applicationDetailPage.refreshDetail();
      }
    } catch (e) { toast.error(e.message || 'Failed to add contact'); }
  }

  async function submitUpdate(id) {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const data = getFormData(form);
    if (data.company_id)     data.company_id     = parseInt(data.company_id);
    if (data.application_id) data.application_id = parseInt(data.application_id);
    try {
      const updated = await api.updateContact(id, data);
      const idx = contacts.findIndex(c => c.id === id);
      if (idx !== -1) contacts[idx] = updated;
      modal.close();
      document.getElementById('page-content').innerHTML = renderList();
      toast.success('Contact updated');
    } catch (e) { toast.error(e.message || 'Failed to update contact'); }
  }

  function confirmDelete(id, name) {
    modal.confirm({
      title: 'Delete Contact',
      message: `Delete <strong>${name}</strong>?`,
      onYes: () => deleteContact(id),
    });
  }

  async function deleteContact(id) {
    try {
      await api.deleteContact(id);
      contacts = contacts.filter(c => c.id !== id);
      document.getElementById('page-content').innerHTML = renderList();
      toast.success('Contact deleted');
    } catch (e) { toast.error('Failed to delete contact'); }
  }

  return { render, openAddModal, openAddModalForApp, openEditModal, submitCreate, submitUpdate, confirmDelete };
})();
