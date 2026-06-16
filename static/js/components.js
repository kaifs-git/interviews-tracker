// Shared UI components

// ─── Toast Notifications ──────────────────────────────────────────────────────
const toast = (() => {
  const container = () => document.getElementById('toast-container');

  function show(message, type = 'success', duration = 3500) {
    const colors = {
      success: 'bg-emerald-600',
      error: 'bg-red-600',
      warning: 'bg-amber-500',
      info: 'bg-indigo-600',
    };
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info',
    };

    const el = document.createElement('div');
    el.className = `pointer-events-auto flex items-center gap-3 ${colors[type]} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg toast-enter max-w-sm`;
    el.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${message}</span>`;
    container().appendChild(el);

    setTimeout(() => {
      el.classList.remove('toast-enter');
      el.classList.add('toast-exit');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    warning: (msg) => show(msg, 'warning'),
    info: (msg) => show(msg, 'info'),
  };
})();

// ─── Modal ────────────────────────────────────────────────────────────────────
const modal = (() => {
  let onConfirm = null;

  function open({ title, body, footer, wide = false }) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer || '';
    const box = document.getElementById('modal-box');
    box.className = `bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90vh] overflow-hidden flex flex-col`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function close() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-footer').innerHTML = '';
    onConfirm = null;
  }

  function confirm({ title, message, onYes, danger = true }) {
    onConfirm = onYes;
    open({
      title,
      body: `<p class="text-slate-600">${message}</p>`,
      footer: `
        <button onclick="modal.close()" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button onclick="modal._confirm()" class="px-4 py-2 text-sm font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} rounded-lg transition-colors">${danger ? 'Delete' : 'Confirm'}</button>
      `,
    });
  }

  function _confirm() {
    if (onConfirm) onConfirm();
    close();
  }

  // Close on overlay click
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) close();
  });

  return { open, close, confirm, _confirm };
})();

// ─── Loading ──────────────────────────────────────────────────────────────────
const loading = {
  show: () => document.getElementById('loading-overlay')?.classList.remove('hidden'),
  hide: () => document.getElementById('loading-overlay')?.classList.add('hidden'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(stage, result) {
  const resultColors = {
    Selected: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Withdrawn: 'bg-slate-100 text-slate-600',
    'Offer Declined': 'bg-orange-100 text-orange-700',
    Pending: 'bg-indigo-100 text-indigo-700',
  };
  const stageColors = {
    Applied: 'bg-blue-100 text-blue-700',
    Shortlisted: 'bg-purple-100 text-purple-700',
    'Phone Screen': 'bg-violet-100 text-violet-700',
    'Technical Round': 'bg-indigo-100 text-indigo-700',
    'HR Round': 'bg-pink-100 text-pink-700',
    'Final Round': 'bg-orange-100 text-orange-700',
    Offer: 'bg-amber-100 text-amber-700',
    Accepted: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Withdrawn: 'bg-slate-100 text-slate-600',
  };

  if (result && result !== 'Pending') {
    return `<span class="badge ${resultColors[result] || 'bg-slate-100 text-slate-600'}">${result}</span>`;
  }
  return `<span class="badge ${stageColors[stage] || 'bg-slate-100 text-slate-600'}">${stage}</span>`;
}

function priorityIcon(p) {
  const map = { High: '🔴', Medium: '🟡', Low: '🟢' };
  return map[p] || '⚪';
}

function starRating(rating, max = 5) {
  if (!rating) return '<span class="text-slate-300 text-sm">—</span>';
  let html = '<div class="star-rating">';
  for (let i = 1; i <= max; i++) {
    html += `<i class="fa-solid fa-star star ${i <= rating ? 'filled' : ''}"></i>`;
  }
  html += '</div>';
  return html;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPay(min, max, currency = 'INR', type = 'Annual') {
  if (!min && !max) return '—';
  const fmt = (n) => {
    if (currency === 'INR') {
      if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
      return `₹${n.toLocaleString()}`;
    }
    return `${n.toLocaleString()}`;
  };
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;
  if (min && max) return `${symbol}${fmt(min)} – ${fmt(max)} / ${type === 'Annual' ? 'yr' : 'mo'}`;
  if (min) return `${symbol}${fmt(min)}+ / ${type === 'Annual' ? 'yr' : 'mo'}`;
  return `Up to ${symbol}${fmt(max)} / ${type === 'Annual' ? 'yr' : 'mo'}`;
}

function workModeChip(mode) {
  const map = {
    Remote: 'bg-teal-100 text-teal-700',
    Hybrid: 'bg-violet-100 text-violet-700',
    Onsite: 'bg-orange-100 text-orange-700',
  };
  if (!mode) return '';
  return `<span class="chip ${map[mode] || 'bg-slate-100 text-slate-600'}">${mode}</span>`;
}

function roundResultBadge(result) {
  const map = {
    'Next Round': 'bg-indigo-100 text-indigo-700',
    Selected: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Hold: 'bg-amber-100 text-amber-700',
    Pending: 'bg-slate-100 text-slate-600',
  };
  return `<span class="badge ${map[result] || 'bg-slate-100 text-slate-600'}">${result || 'Pending'}</span>`;
}

function emptyState(icon, title, message, action = '') {
  return `
    <div class="empty-state">
      <i class="fa-solid ${icon}"></i>
      <h3>${title}</h3>
      <p>${message}</p>
      ${action ? `<div class="mt-4">${action}</div>` : ''}
    </div>`;
}

function btn(label, onclick, style = 'primary', icon = '') {
  const styles = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'hover:bg-slate-100 text-slate-600',
  };
  return `<button onclick="${onclick}" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${styles[style]}">${icon ? `<i class="fa-solid ${icon}"></i>` : ''}${label}</button>`;
}

// Form field builders
function field(label, name, type = 'text', value = '', opts = {}) {
  const placeholder = opts.placeholder || '';
  const required = opts.required ? 'required' : '';
  const extraClass = opts.class || '';
  if (type === 'textarea') {
    return `<div class="form-group ${extraClass}">
      <label class="form-label">${label}${opts.required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <textarea name="${name}" class="form-input" rows="${opts.rows || 3}" placeholder="${placeholder}" ${required}>${value || ''}</textarea>
    </div>`;
  }
  if (type === 'select') {
    const options = (opts.options || []).map(o => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return `<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`;
    }).join('');
    return `<div class="form-group ${extraClass}">
      <label class="form-label">${label}${opts.required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <select name="${name}" class="form-input" ${required}>
        <option value="">— Select —</option>
        ${options}
      </select>
    </div>`;
  }
  return `<div class="form-group ${extraClass}">
    <label class="form-label">${label}${opts.required ? ' <span class="text-red-500">*</span>' : ''}</label>
    <input type="${type}" name="${name}" class="form-input" value="${value || ''}" placeholder="${placeholder}" ${required} />
  </div>`;
}

function getFormData(formEl) {
  const data = {};
  const inputs = formEl.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    if (!input.name) return;
    let val = input.value.trim();
    if (val === '') val = null;
    if (input.type === 'number' && val !== null) val = parseFloat(val);
    data[input.name] = val;
  });
  return data;
}
