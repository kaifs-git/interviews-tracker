// Client-side router
const router = (() => {
  let currentPage = null;
  let currentParams = {};

  const pages = {
    dashboard: dashboardPage,
    applications: applicationsPage,
    companies: companiesPage,
    contacts: contactsPage,
    'application-detail': applicationDetailPage,
    admin: adminPage,
    settings: settingsPage,
    agent: agentPage,
  };

  function navigate(page, params = {}) {
    currentPage = page;
    currentParams = params;

    // Update sidebar nav active state
    document.querySelectorAll('.nav-link').forEach(el => {
      const elPage = el.dataset.page;
      if (elPage === page || (page === 'application-detail' && elPage === 'applications')) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update bottom nav active state
    const bottomAliases = { 'application-detail': 'applications', 'agent': 'settings' };
    const bottomPage = bottomAliases[page] || page;
    document.querySelectorAll('.bottom-nav-btn').forEach(el => {
      if (el.dataset.page === bottomPage) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    const pageObj = pages[page];
    if (pageObj && typeof pageObj.render === 'function') {
      pageObj.render(params);
    }
  }

  function getCurrentPage() { return currentPage; }
  function getCurrentParams() { return currentParams; }

  return { navigate, getCurrentPage, getCurrentParams };
})();

// ─── Page header helpers ──────────────────────────────────────────────────────
function setPageHeader(title, subtitle = '') {
  const t = document.getElementById('page-title');
  const s = document.getElementById('page-subtitle');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
}

function setPageActions(html) {
  const el = document.getElementById('page-actions');
  if (el) el.innerHTML = html;
}
