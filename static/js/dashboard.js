// Dashboard page
const dashboardPage = (() => {
  let stageChart = null;

  async function render() {
    setPageHeader('Dashboard', 'Overview of your job search');
    setPageActions(`
      ${btn('New Application', "router.navigate('applications', {action:'new'})", 'primary', 'fa-plus')}
    `);

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="flex items-center justify-center py-24">
        <div class="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>`;

    let stats;
    try {
      stats = await api.getStats();
    } catch (e) {
      content.innerHTML = emptyState('fa-chart-line', 'Dashboard unavailable', 'Could not load stats. Please refresh.');
      return;
    }

    if (stageChart) { stageChart.destroy(); stageChart = null; }

    content.innerHTML = buildDashboard(stats);
    renderCharts(stats);
  }

  function buildDashboard(s) {
    // Primary stat cards
    const primaryStats = [
      { label: 'Total Applications', value: s.total_applications, icon: 'fa-file-lines', bg: 'bg-indigo-50', text: 'text-indigo-600' },
      { label: 'In Progress',        value: s.in_progress,        icon: 'fa-spinner',    bg: 'bg-amber-50',  text: 'text-amber-600' },
      { label: 'Selected / Offers',  value: s.selected,           icon: 'fa-circle-check', bg: 'bg-emerald-50', text: 'text-emerald-600' },
      { label: 'Rejected',           value: s.rejected,           icon: 'fa-circle-xmark', bg: 'bg-red-50',  text: 'text-red-500' },
    ];

    const primaryRow = primaryStats.map(c => `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 card-hover">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="w-10 h-10 sm:w-11 sm:h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0">
            <i class="fa-solid ${c.icon} ${c.text} text-base sm:text-lg"></i>
          </div>
          <div>
            <p class="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">${c.value}</p>
            <p class="text-slate-500 text-xs sm:text-sm mt-0.5 leading-tight">${c.label}</p>
          </div>
        </div>
      </div>
    `).join('');

    // Secondary stats
    const secondaryStats = [
      { label: 'Applied This Month', value: s.this_month,           icon: 'fa-calendar-days', bg: 'bg-violet-50', text: 'text-violet-600' },
      { label: 'Total Interviews',   value: s.total_interviews,     icon: 'fa-microphone',    bg: 'bg-sky-50',    text: 'text-sky-600' },
      { label: 'Upcoming',           value: s.upcoming_interviews,  icon: 'fa-bell',          bg: 'bg-amber-50',  text: 'text-amber-500' },
      { label: 'Avg. Rating',        value: s.avg_rating ? `${s.avg_rating}/5` : '—', icon: 'fa-star', bg: 'bg-orange-50', text: 'text-orange-400' },
    ];

    const secondaryRow = secondaryStats.map(c => `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 card-hover">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="w-10 h-10 sm:w-11 sm:h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0">
            <i class="fa-solid ${c.icon} ${c.text} text-base sm:text-lg"></i>
          </div>
          <div>
            <p class="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">${c.value}</p>
            <p class="text-slate-500 text-xs sm:text-sm mt-0.5 leading-tight">${c.label}</p>
          </div>
        </div>
      </div>
    `).join('');

    // Stage breakdown list
    const stageItems = Object.entries(s.by_stage).sort((a,b) => b[1]-a[1]).map(([stage, count]) => `
      <div class="flex items-center gap-3 py-2">
        <span class="text-sm text-slate-600 w-32 truncate flex-shrink-0">${stage}</span>
        <div class="flex-1 progress-bar">
          <div class="progress-fill" style="width:${s.total_applications ? (count/s.total_applications*100) : 0}%"></div>
        </div>
        <span class="text-sm font-semibold text-slate-700 w-5 text-right flex-shrink-0">${count}</span>
      </div>
    `).join('') || '<p class="text-slate-400 text-sm py-4 text-center">No data yet</p>';

    // Top companies
    const companiesHtml = s.by_company.length
      ? s.by_company.slice(0, 6).map(c => `
        <div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span class="text-indigo-600 font-bold text-xs">${(c.name||'?')[0].toUpperCase()}</span>
            </div>
            <span class="text-sm text-slate-700 font-medium truncate">${c.name}</span>
          </div>
          <span class="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex-shrink-0">${c.count}</span>
        </div>
      `).join('')
      : '<p class="text-slate-400 text-sm text-center py-4">No data yet</p>';

    // Recent apps — mobile card view
    const recentMobile = s.recent_applications.length
      ? s.recent_applications.map(a => `
        <div class="p-4 border-b border-slate-50 last:border-0 active:bg-slate-50 cursor-pointer transition-colors"
          onclick="router.navigate('application-detail', {id:${a.id}})">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-indigo-600 text-sm">
              ${(a.company_name||'?')[0].toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-slate-800 text-sm truncate">${a.job_title}</p>
              <p class="text-slate-400 text-xs mt-0.5">${a.company_name||'—'}</p>
            </div>
            <div class="flex-shrink-0 text-right">
              ${statusBadge(a.current_stage, a.final_result)}
              <p class="text-xs text-slate-400 mt-1">${formatDate(a.application_date)}</p>
            </div>
          </div>
        </div>
      `).join('')
      : `<div class="py-10 text-center text-slate-400 text-sm">No applications yet</div>`;

    // Recent apps — desktop table rows
    const recentRows = s.recent_applications.length
      ? s.recent_applications.map(a => `
        <tr class="cursor-pointer hover:bg-slate-50 transition-colors" onclick="router.navigate('application-detail', {id:${a.id}})">
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg flex items-center justify-center font-bold text-indigo-600 text-sm flex-shrink-0">
                ${(a.company_name||'?')[0].toUpperCase()}
              </div>
              <div>
                <p class="font-semibold text-slate-800 text-sm">${a.job_title}</p>
                <p class="text-slate-400 text-xs">${a.company_name||'—'}</p>
              </div>
            </div>
          </td>
          <td class="px-6 py-4">${statusBadge(a.current_stage, a.final_result)}</td>
          <td class="px-6 py-4 text-slate-500 text-sm">${a.interview_count} round${a.interview_count!==1?'s':''}</td>
          <td class="px-6 py-4 text-slate-500 text-sm">${formatDate(a.application_date)}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" class="text-center py-10 text-slate-400 text-sm">No applications yet</td></tr>`;

    return `
      <!-- Primary stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        ${primaryRow}
      </div>

      <!-- Secondary stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        ${secondaryRow}
      </div>

      <!-- Middle section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-6">
        <!-- Stage Breakdown -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <h3 class="font-semibold text-slate-800 mb-4 text-sm">By Stage</h3>
          <div>${stageItems}</div>
        </div>

        <!-- Stage Chart (hidden on small mobile, visible sm+) -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 hidden sm:flex flex-col">
          <h3 class="font-semibold text-slate-800 mb-4 text-sm">Stage Distribution</h3>
          <div class="flex-1 flex items-center justify-center min-h-[180px]">
            <canvas id="stage-chart" style="max-height:200px"></canvas>
          </div>
        </div>

        <!-- Top Companies -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <h3 class="font-semibold text-slate-800 mb-4 text-sm">Top Companies</h3>
          ${companiesHtml}
        </div>
      </div>

      <!-- Recent Applications -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-slate-800 text-sm">Recent Applications</h3>
          <button onclick="router.navigate('applications')" class="text-indigo-600 hover:text-indigo-700 text-sm font-medium">View all →</button>
        </div>
        <!-- Mobile: card list -->
        <div class="sm:hidden">${recentMobile}</div>
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

    if (!labels.length) {
      stageCtx.parentElement.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No data yet</p>';
      return;
    }

    const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#f97316'];

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
            labels: { font: { size: 11, family: 'Inter' }, padding: 8, usePointStyle: true },
          },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
        },
      },
    });
  }

  return { render };
})();
