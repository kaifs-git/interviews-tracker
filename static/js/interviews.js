// Application Detail + Interview Rounds
const applicationDetailPage = (() => {
  let app = null;
  let companies = [];

  const ROUND_TYPES = ['Phone', 'Video Call', 'In-person', 'Take-home Assignment', 'Group Discussion', 'Presentation', 'Other'];
  const ROUND_NAMES = ['HR Screen', 'Phone Screen', 'Technical Round 1', 'Technical Round 2', 'System Design', 'Machine Coding', 'HR Round', 'Managerial Round', 'Director Round', 'Final Round', 'Offer Discussion'];
  const ROUND_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No-Show'];
  const ROUND_RESULTS = ['Pending', 'Next Round', 'Selected', 'Rejected', 'Hold'];
  const STAGES = ['Applied','Shortlisted','Phone Screen','Technical Round','HR Round','Final Round','Offer','Accepted','Rejected','Withdrawn'];
  const RESULTS_APP = ['Pending','Selected','Rejected','Withdrawn','Offer Declined'];

  async function render(params = {}) {
    const appId = params.id;
    if (!appId) { router.navigate('applications'); return; }

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    try {
      [app, companies] = await Promise.all([
        api.getApplication(appId),
        api.getCompanies(),
      ]);
    } catch (e) {
      toast.error('Failed to load application');
      router.navigate('applications');
      return;
    }

    setPageHeader(app.job_title, app.company_name || '');
    setPageActions(`
      <button onclick="router.navigate('applications')" class="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
        <i class="fa-solid fa-arrow-left text-xs"></i>Back
      </button>
      ${btn('Edit', `applicationDetailPage.openEditModal(${app.id})`, 'secondary', 'fa-pen-to-square')}
      ${btn('Add Interview Round', `applicationDetailPage.openAddRoundModal(${app.id})`, 'primary', 'fa-plus')}
    `);

    content.innerHTML = renderDetail();
  }

  function renderDetail() {
    if (!app) return '';
    const rounds = app.interview_rounds || [];
    const contacts = app.contacts || [];

    // Status color for final result
    const resultColor = {
      Selected: 'bg-emerald-100 border-emerald-200 text-emerald-800',
      Rejected: 'bg-red-100 border-red-200 text-red-800',
      Pending: 'bg-indigo-50 border-indigo-200 text-indigo-800',
      Withdrawn: 'bg-slate-100 border-slate-200 text-slate-700',
    };

    // Header card
    const header = `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-indigo-600 flex-shrink-0">
              ${(app.company_name || '?')[0].toUpperCase()}
            </div>
            <div>
              <h2 class="text-xl font-bold text-slate-800">${app.job_title}</h2>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="text-slate-500 font-medium">${app.company_name || '—'}</span>
                ${app.location ? `<span class="text-slate-400">·</span><span class="text-slate-500 text-sm">${app.location}</span>` : ''}
                ${app.work_mode ? workModeChip(app.work_mode) : ''}
                ${app.job_type ? `<span class="chip bg-slate-100 text-slate-600">${app.job_type}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            ${statusBadge(app.current_stage, app.final_result)}
            <span class="text-sm ${app.priority === 'High' ? 'priority-high' : app.priority === 'Low' ? 'priority-low' : 'priority-medium'} font-medium">${priorityIcon(app.priority)} ${app.priority} Priority</span>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div>
            <p class="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Pay Range</p>
            <p class="text-sm font-semibold text-slate-700">${formatPay(app.payscale_min, app.payscale_max, app.payscale_currency, app.payscale_type)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Applied On</p>
            <p class="text-sm font-semibold text-slate-700">${formatDate(app.application_date)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Source</p>
            <p class="text-sm font-semibold text-slate-700">${app.source || '—'}${app.referral_name ? ` (${app.referral_name})` : ''}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Interview Rounds</p>
            <p class="text-sm font-semibold text-slate-700">${rounds.length}</p>
          </div>
        </div>
        ${app.offer_amount ? `
          <div class="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
            <i class="fa-solid fa-envelope-open-text text-emerald-600"></i>
            <span class="text-emerald-700 font-medium text-sm">Offer: ${app.offer_currency === 'INR' ? '₹' : app.offer_currency}${app.offer_amount.toLocaleString()}</span>
            ${app.joining_date ? `<span class="text-emerald-600 text-sm">· Joining: ${formatDate(app.joining_date)}</span>` : ''}
          </div>
        ` : ''}
        ${app.job_url ? `<div class="mt-3"><a href="${app.job_url}" target="_blank" class="text-sm text-indigo-600 hover:underline flex items-center gap-1"><i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>View Job Posting</a></div>` : ''}
      </div>
    `;

    // Interview timeline
    const timeline = rounds.length
      ? `<div class="space-y-4">
        ${rounds.map((r, i) => `
          <div class="timeline-item bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 flex-1">
                <div class="timeline-dot ${r.result === 'Selected' ? 'text-emerald-500' : r.result === 'Rejected' ? 'text-red-500' : r.result === 'Next Round' ? 'text-indigo-500' : 'text-slate-300'}"></div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-slate-800">Round ${r.round_number}${r.round_name ? ` — ${r.round_name}` : ''}</span>
                    ${r.interview_type ? `<span class="chip bg-slate-100 text-slate-600 text-xs">${r.interview_type}</span>` : ''}
                    <span class="badge ${r.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${r.status}</span>
                    ${roundResultBadge(r.result)}
                  </div>
                  <div class="flex items-center gap-4 mt-2 text-sm text-slate-500 flex-wrap">
                    ${r.scheduled_at ? `<span><i class="fa-solid fa-calendar text-slate-400 mr-1"></i>${formatDateTime(r.scheduled_at)}</span>` : ''}
                    ${r.duration_minutes ? `<span><i class="fa-solid fa-clock text-slate-400 mr-1"></i>${r.duration_minutes} min</span>` : ''}
                    ${r.interviewer_name ? `<span><i class="fa-solid fa-user text-slate-400 mr-1"></i>${r.interviewer_name}${r.interviewer_designation ? ` (${r.interviewer_designation})` : ''}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                ${r.self_rating ? starRating(r.self_rating) : ''}
                <button onclick="applicationDetailPage.openEditRoundModal(${r.id})" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors ml-2"><i class="fa-solid fa-pen-to-square text-xs"></i></button>
                <button onclick="applicationDetailPage.confirmDeleteRound(${r.id})" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
              </div>
            </div>
            ${r.topics_covered || r.feedback || r.notes ? `
              <div class="mt-3 pt-3 border-t border-slate-50 space-y-2 text-sm text-slate-600">
                ${r.topics_covered ? `<div><span class="font-medium text-slate-500">Topics:</span> ${r.topics_covered}</div>` : ''}
                ${r.questions_asked ? `<div><span class="font-medium text-slate-500">Questions:</span> ${r.questions_asked}</div>` : ''}
                ${r.feedback ? `<div><span class="font-medium text-slate-500">Feedback:</span> ${r.feedback}</div>` : ''}
                ${r.notes ? `<div><span class="font-medium text-slate-500">Notes:</span> ${r.notes}</div>` : ''}
              </div>
            ` : ''}
            ${r.difficulty ? `<div class="mt-2 flex items-center gap-2 text-xs text-slate-400"><span>Difficulty:</span>${starRating(r.difficulty)}</div>` : ''}
          </div>
        `).join('')}
        </div>`
      : `<div class="bg-white rounded-2xl shadow-sm border border-slate-100">
          ${emptyState('fa-microphone', 'No interview rounds yet', 'Track each interview round as you progress.',
            btn('Add First Round', `applicationDetailPage.openAddRoundModal(${app.id})`, 'primary', 'fa-plus')
          )}
        </div>`;

    // Contacts
    const contactsList = contacts.length
      ? contacts.map(c => `
        <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
          <div class="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm flex-shrink-0">
            ${(c.name || '?')[0].toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800">${c.name}</p>
            <p class="text-xs text-slate-500">${c.designation || ''}${c.department ? ` · ${c.department}` : ''}</p>
          </div>
          <div class="flex gap-2 text-xs text-slate-500 flex-shrink-0">
            ${c.email ? `<a href="mailto:${c.email}" class="hover:text-indigo-600" title="${c.email}"><i class="fa-solid fa-envelope"></i></a>` : ''}
            ${c.phone ? `<a href="tel:${c.phone}" class="hover:text-indigo-600" title="${c.phone}"><i class="fa-solid fa-phone"></i></a>` : ''}
            ${c.linkedin ? `<a href="${c.linkedin}" target="_blank" class="hover:text-blue-600"><i class="fa-brands fa-linkedin"></i></a>` : ''}
          </div>
        </div>
      `).join('')
      : `<div class="bg-white rounded-xl border border-slate-100 p-5 text-center text-slate-400 text-sm">
          No contacts yet. <button onclick="contactsPage.openAddModalForApp(${app.id}, ${app.company_id})" class="text-indigo-600 hover:underline">Add one</button>
        </div>`;

    // JD
    const jd = app.job_description
      ? `<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <h3 class="font-semibold text-slate-800 mb-3 flex items-center gap-2"><i class="fa-solid fa-file-text text-slate-400"></i>Job Description</h3>
          <div class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">${app.job_description}</div>
        </div>`
      : '';

    return `
      ${header}
      ${jd}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-800 text-base">Interview Rounds (${rounds.length})</h3>
            <button onclick="applicationDetailPage.openAddRoundModal(${app.id})" class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              <i class="fa-solid fa-plus text-xs"></i>Add Round
            </button>
          </div>
          ${timeline}
        </div>
        <div>
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-slate-800">Contacts</h3>
              <button onclick="contactsPage.openAddModalForApp(${app.id}, ${app.company_id})" class="text-indigo-600 hover:text-indigo-700 text-sm"><i class="fa-solid fa-plus text-xs mr-1"></i>Add</button>
            </div>
            <div class="space-y-2">${contactsList}</div>
          </div>
          ${app.notes ? `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 class="font-semibold text-slate-800 mb-2">Notes</h3>
              <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">${app.notes}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function roundForm(r = {}, appId = null) {
    const nextRound = app?.interview_rounds?.length
      ? Math.max(...app.interview_rounds.map(r => r.round_number)) + 1
      : 1;

    return `
      <form id="round-form">
        <input type="hidden" name="application_id" value="${r.application_id || appId || ''}" />
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Round Number', 'round_number', 'number', r.round_number || nextRound, { required: true })}
          ${field('Round Name', 'round_name', 'select', r.round_name, { options: ROUND_NAMES })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Interview Type', 'interview_type', 'select', r.interview_type, { options: ROUND_TYPES })}
          ${field('Status', 'status', 'select', r.status || 'Scheduled', { options: ROUND_STATUSES })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Scheduled At', 'scheduled_at', 'datetime-local', r.scheduled_at ? r.scheduled_at.replace('Z','').slice(0,16) : '')}
          ${field('Duration (minutes)', 'duration_minutes', 'number', r.duration_minutes, { placeholder: '60' })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Interviewer Name', 'interviewer_name', 'text', r.interviewer_name, { placeholder: 'John Doe' })}
          ${field('Interviewer Designation', 'interviewer_designation', 'text', r.interviewer_designation, { placeholder: 'Engineering Manager' })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Self Rating (1–5)', 'self_rating', 'number', r.self_rating, { placeholder: '1–5' })}
          ${field('Difficulty (1–5)', 'difficulty', 'number', r.difficulty, { placeholder: '1–5' })}
        </div>
        <div class="grid grid-cols-2 gap-x-5">
          ${field('Result', 'result', 'select', r.result || 'Pending', { options: ROUND_RESULTS })}
          ${field('Completed At', 'completed_at', 'datetime-local', r.completed_at ? r.completed_at.replace('Z','').slice(0,16) : '')}
        </div>
        ${field('Topics Covered', 'topics_covered', 'text', r.topics_covered, { placeholder: 'Arrays, DP, System Design...' })}
        ${field('Questions Asked', 'questions_asked', 'textarea', r.questions_asked, { placeholder: 'Key questions you remember...', rows: 2 })}
        ${field('Feedback', 'feedback', 'textarea', r.feedback, { placeholder: 'Feedback received...', rows: 2 })}
        ${field('Your Notes', 'notes', 'textarea', r.notes, { placeholder: 'Personal notes...', rows: 2 })}
      </form>
    `;
  }

  function openAddRoundModal(appId) {
    modal.open({
      title: 'Add Interview Round',
      body: roundForm({}, appId),
      footer: `
        <button onclick="modal.close()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button onclick="applicationDetailPage.submitCreateRound()" class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
          <i class="fa-solid fa-plus mr-1"></i>Add Round
        </button>
      `,
      wide: true,
    });
  }

  async function openEditRoundModal(roundId) {
    const r = app?.interview_rounds?.find(r => r.id === roundId);
    if (!r) return;
    modal.open({
      title: 'Edit Interview Round',
      body: roundForm(r),
      footer: `
        <button onclick="modal.close()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button onclick="applicationDetailPage.submitUpdateRound(${roundId})" class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
          Save Changes
        </button>
      `,
      wide: true,
    });
  }

  async function submitCreateRound() {
    const form = document.getElementById('round-form');
    if (!form) return;
    const data = getFormData(form);
    if (!data.round_number) { toast.warning('Round number is required'); return; }
    data.round_number = parseInt(data.round_number);
    if (data.duration_minutes) data.duration_minutes = parseInt(data.duration_minutes);
    if (data.self_rating) data.self_rating = parseInt(data.self_rating);
    if (data.difficulty) data.difficulty = parseInt(data.difficulty);
    if (data.application_id) data.application_id = parseInt(data.application_id);
    try {
      await api.createInterview(data);
      modal.close();
      toast.success('Interview round added');
      app = await api.getApplication(app.id);
      document.getElementById('page-content').innerHTML = renderDetail();
    } catch (e) {
      toast.error(e.message || 'Failed to add round');
    }
  }

  async function submitUpdateRound(roundId) {
    const form = document.getElementById('round-form');
    if (!form) return;
    const data = getFormData(form);
    if (data.round_number) data.round_number = parseInt(data.round_number);
    if (data.duration_minutes) data.duration_minutes = parseInt(data.duration_minutes);
    if (data.self_rating) data.self_rating = parseInt(data.self_rating);
    if (data.difficulty) data.difficulty = parseInt(data.difficulty);
    delete data.application_id;
    try {
      await api.updateInterview(roundId, data);
      modal.close();
      toast.success('Round updated');
      app = await api.getApplication(app.id);
      document.getElementById('page-content').innerHTML = renderDetail();
    } catch (e) {
      toast.error(e.message || 'Failed to update round');
    }
  }

  function confirmDeleteRound(roundId) {
    modal.confirm({
      title: 'Delete Round',
      message: 'Delete this interview round?',
      onYes: () => deleteRound(roundId),
    });
  }

  async function deleteRound(roundId) {
    try {
      await api.deleteInterview(roundId);
      toast.success('Round deleted');
      app = await api.getApplication(app.id);
      document.getElementById('page-content').innerHTML = renderDetail();
    } catch (e) {
      toast.error('Failed to delete round');
    }
  }

  async function openEditModal(appId) {
    await applicationsPage.openEditModal(appId);
  }

  function refreshDetail() {
    if (app) render({ id: app.id });
  }

  return {
    render, openAddRoundModal, openEditRoundModal,
    submitCreateRound, submitUpdateRound, confirmDeleteRound,
    openEditModal, refreshDetail,
  };
})();
