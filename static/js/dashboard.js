// Dashboard page
const dashboardPage = (() => {
  let stageChart = null;
  let trendChart = null;

  async function render() {
    setPageHeader('Dashboard', 'Overview of your job search');
    setPageActions(`
      ${btn('New Application', "router.navigate('applications', {action:'new'})", 'primary', 'fa-plus')}
    `);

    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="flex items-center justify-center py-20"><div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>`;

    let stats;
    try {
      stats = await api.getStats();
    } catch (e) {
      content.innerHTML = emptyState('fa-chart-line', 'Dashboard unavailable', 'Could not load stats. Please refresh.');
      return;
    }

    if (stageChart) { stageChart.destroy(); stageChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }

    content.innerHTML = buildDashboard(stats);
    renderCharts(stats);
  }

  function buildDashboard(s) {
    const statCards = [
      { label: 'Total Applications', value: s.total_applications, icon: 'fa-file-lines', color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600' },
      { label: 'In Progress', value: s.in_progress, icon: 'fa-spinner', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600' },
      { label: 'Selected / Offers', value: s.selected, icon: 'fa-circle-check', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600' },
      { label: 'Rejected', value: s.rejected, icon: 'fa-circle-xmark', color: 'red', bg: 'bg-red-50', text: 'text-red-500' },
    ];

    const statsRow = statCards.map(c => `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 card-hover flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fa-solid ${c.icon} ${c.text} text-lg sm:text-xl"></i>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-slate-800">${c.value}</p>
          <p class="text-slate-500 text-xs sm:text-sm mt-0.5">${c.label}</p>
        </div>
      </div>
    `).join('');

    const metaCards = `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 card-hover flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-calendar-days text-violet-600 text-lg sm:text-xl"></i>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-slate-800">${s.this_month}</p>
          <p class="text-slate-500 text-xs sm:text-sm mt-0.5">Applied This Month</p>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 card-hover flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-sky-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-microphone text-sky-600 text-lg sm:text-xl"></i>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-slate-800">${s.total_interviews}</p>
          <p class="text-slate-500 text-xs sm:text-sm mt-0.5">Total Interviews</p>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 card-hover flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-bell text-amber-500 text-lg sm:text-xl"></i>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-slate-800">${s.upcoming_interviews}</p>
          <p class="text-slate-500 text-xs sm:text-sm mt-0.5">Upcoming</p>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 card-hover flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-star text-orange-400 text-lg sm:text-xl"></i>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-slate-800">${s.avg_rating ? s.avg_rating + '/5' : '—'}</p>
          <p class="text-slate-500 text-xs sm:text-sm mt-0.5">Avg. Rating</p>
        </div>
      </div>
    `;

    // Recent Applications — mobile cards + desktop table rows
    const recentMobileCards = s.recent_applications.length
      ? s.recent_applications.map(a => `
        <div class="p-4 border-b border-slate-50 last:border-0 cursor-pointer active:bg-slate-50 transition-colors"
          onclick="router.navigate('application-detail', {id:${a.id}})">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">
                ${(a.company_name||'?')[0].toUpperCase()}
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-slate-800 text-sm truncate">${a.job_title}</p>
                <p class="text-slate-400 text-xs mt-0.5">${a.company_name||'—'}</p>
              </div>
            </div>
            <div class="flex-shrink-0 flex flex-col items-end gap-1">
              ${statusBadge(a.current_stage, a.final_result)}
              <span class="text-xs text-slate-400">${formatDate(a.application_date)}</span>
            </div>
          </div>
        </div>
      `).join('')
      : `<div class="empty-state py-10"><i class="fa-solid fa-inbox text-3xl text-slate-200 block mb-2"></i><p class="text-slate-400">No applications yet</p></div>`;

    const recentRows = s.recent_applications.length
      ? s.recent_applications.map(a => `
        <tr class="cursor-pointer hover:bg-slate-50 transition-colors" onclick="router.navigate('application-detail', {id:${a.id}})">
          <td class="px-6 py-4">
            <p class="font-semibold text-slate-800">${a.job_title}</p>
            <p class="text-slate-500 text-xs mt-0.5">${a.company_name || '—'}</p>
          </td>
          <td class="px-6 py-4">${statusBadge(a.current_stage, a.final_result)}</td>
          <td class="px-6 py-4 text-slate-500 text-sm">${a.interview_count} round${a.interview_count !== 1 ? 's' : ''}</td>
          <td class="px-6 py-4 text-slate-500 text-sm">${formatDate(a.application_date)}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="4"><div class="empty-state py-10"><i class="fa-solid fa-inbox text-3xl text-slate-200 block mb-2"></i><p class="text-slate-400">No applications yet</p></div></td></tr>`;

    // Stage breakdown
    const stageItems = Object.entries(s.by_stage).sort((a, b) => b[1] - a[1]).map(([stage, count]) => `
      <div class="flex items-center gap-3 py-2">
        <span class="text-sm text-slate-600 w-32 truncate">${stage}</span>
        <div class="flex-1 progress-bar">
          <div class="progress-fill" style="width:${s.total_applications ? (count / s.total_applications * 100) : 0}%"></div>
        </div>
        <span class="text-sm font-semibold text-slate-700 w-6 text-right">${count}</span>
      </div>
    `).join('') || '<p class="text-slate-400 text-sm py-4 text-center">No data</p>';

    return `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">${statsRow}</div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">${metaCards}</div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <!-- Stage Breakdown -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 class="font-semibold text-slate-800 mb-4">By Stage</h3>
          <div>${stageItems}</div>
        </div>
        <!-- Stage Chart -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <h3 class="font-semibold text-slate-800 mb-4">Stage Distribution</h3>
          <div class="flex-1 flex items-center justify-center">
            <canvas id="stage-chart" style="max-height:220px"></canvas>
          </div>
        </div>
        <!-- Top Companies -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 class="font-semibold text-slate-800 mb-4">Top Companies</h3>
          ${s.by_company.length ? s.by_company.map(c => `
            <div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i class="fa-solid fa-building text-indigo-500 text-xs"></i>
                </div>
                <span class="text-sm text-slate-700 font-medium">${c.name}</span>
              </div>
              <span class="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${c.count}</span>
            </div>
          `).join('') : '<p class="text-slate-400 text-sm text-center py-4">No data</p>'}
        </div>
      </div>
      <!-- Recent Applications -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-slate-800">Recent Applications</h3>
          <button onclick="router.navigate('applications')" class="text-indigo-600 hover:text-indigo-700 text-sm font-medium">View all →</button>
        </div>
        <!-- Mobile: card list -->
        <div class="sm:hidden">${recentMobileCards}</div>
        <!-- Desktop: table -->
        <div class="hidden sm:block overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th class="px-6">Role / Company</th>
                <th class="px-6">Status</th>
                <th class="px-6">Interviews</th>
                <th class="px-6">Applied</th>
              </tr>
            </thead>
            <tbody>${recentRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderCharts(s) {
    const stageCtx = document.getElementById('stage-chart');
    if (!stageCtx) return;

    const labels = Object.keys(s.by_stage);
    const values = Object.values(s.by_stage);

    const colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
      '#10b981', '#06b6d4', '#ef4444', '#f97316',
    ];

    if (labels.length === 0) {
      stageCtx.parentElement.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No data yet</p>';
      return;
    }

    stageChart = new Chart(stageCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11 }, padding: 8, usePointStyle: true },
          },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
        },
      },
    });
  }

  return { render };
})();
