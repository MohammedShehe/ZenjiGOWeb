// ZenjiGO Web – Shared utilities (aligned with mobile apps)

// Same country list as Rider + Driver Flutter apps
const ZENJIGO_COUNTRIES = [
  { name: 'Tanzania', code: '+255', flag: '🇹🇿', iso: 'TZ' },
  { name: 'Kenya', code: '+254', flag: '🇰🇪', iso: 'KE' },
  { name: 'Uganda', code: '+256', flag: '🇺🇬', iso: 'UG' },
  { name: 'Rwanda', code: '+250', flag: '🇷🇼', iso: 'RW' },
  { name: 'Burundi', code: '+257', flag: '🇧🇮', iso: 'BI' },
  { name: 'Mozambique', code: '+258', flag: '🇲🇿', iso: 'MZ' },
  { name: 'Malawi', code: '+265', flag: '🇲🇼', iso: 'MW' },
  { name: 'Zambia', code: '+260', flag: '🇿🇲', iso: 'ZM' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦', iso: 'ZA' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬', iso: 'NG' },
  { name: 'Ghana', code: '+233', flag: '🇬🇭', iso: 'GH' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧', iso: 'GB' },
  { name: 'United States', code: '+1', flag: '🇺🇸', iso: 'US' },
  { name: 'Canada', code: '+1', flag: '🇨🇦', iso: 'CA' },
  { name: 'India', code: '+91', flag: '🇮🇳', iso: 'IN' },
  { name: 'UAE', code: '+971', flag: '🇦🇪', iso: 'AE' },
  { name: 'Germany', code: '+49', flag: '🇩🇪', iso: 'DE' },
  { name: 'France', code: '+33', flag: '🇫🇷', iso: 'FR' },
  { name: 'China', code: '+86', flag: '🇨🇳', iso: 'CN' },
  { name: 'Australia', code: '+61', flag: '🇦🇺', iso: 'AU' }
];

/**
 * Build phone exactly like the Flutter apps:
 * phone = countryCode + localNumber (no spaces)
 * e.g. "+255" + "612345678" => "+255612345678"
 */
function buildPhone(countryCode, localNumber) {
  const code = String(countryCode || '+255').trim();
  let local = String(localNumber || '').trim().replace(/[^\d]/g, '');
  // Strip leading 0 from local number (common TZ format 06xx...)
  if (local.startsWith('0')) local = local.slice(1);
  return code + local;
}

/**
 * Backend-compatible normalize (matches backend/src/utils/phone.js)
 * Only used as a safety net when a full number is already provided.
 */
function normalizePhone(phone) {
  let p = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+')) p = '+255' + p.replace(/^0/, '');
  return p;
}

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
  }
  const id = 't' + Date.now();
  const bg = type === 'error' ? 'bg-danger' : type === 'warning' ? 'bg-warning text-dark' : 'bg-success';
  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast align-items-center text-white ${bg} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body" data-msg></div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`);
  const el = document.getElementById(id);
  const body = el.querySelector('[data-msg]');
  if (body) body.textContent = String(message == null ? '' : message);
  const t = new bootstrap.Toast(el, { delay: type === 'error' ? 6000 : 3500 });
  t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

/** Escape anything that came from a server/user before putting it in innerHTML. */
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatMoney(amount) {
  if (amount == null || amount === '' || isNaN(Number(amount))) return '—';
  return 'TZS ' + Math.round(Number(amount)).toLocaleString('en-TZ');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    // MySQL returns UTC; make sure the browser reads it as UTC.
    const d = (typeof iso === 'string' && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) ? new Date(iso.replace(' ', 'T') + 'Z') : new Date(iso);
    return d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

function requireAuth(role) {
  if (!Api.isLoggedIn()) {
    window.location.href = role === 'driver' ? 'login.html' : '../rider/login.html';
    return false;
  }
  const current = Api.getRole();
  if (role && current && current !== role) {
    window.location.href = current === 'driver' ? '../driver/dashboard.html' : '../rider/dashboard.html';
    return false;
  }
  return true;
}

function logout() {
  Api.auth.logout().catch(() => {});
  Api.clearTokens();
  window.location.href = '../index.html';
}

function toggleSidebar() {
  document.getElementById('appSidebar')?.classList.toggle('show');
  document.getElementById('sidebarOverlay')?.classList.toggle('show');
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Please wait...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.original || btn.innerHTML;
  }
}

/** Fill a <select> with country codes (default +255) */
function fillCountrySelect(selectEl, selectedCode = '+255') {
  if (!selectEl) return;
  selectEl.innerHTML = ZENJIGO_COUNTRIES.map(c =>
    `<option value="${c.code}" ${c.code === selectedCode ? 'selected' : ''}>${c.flag} ${c.code} ${c.name}</option>`
  ).join('');
}


/* ------------------------------------------------------------------
 * East Africa Time (UTC+3) helpers — same convention as the app's TanzaniaTime.
 * The database stores UTC; riders think in EAT.
 * ------------------------------------------------------------------ */
const EAT_OFFSET_HOURS = 3;
function _pad2(n) { return String(n).padStart(2, '0'); }

/** "Now" expressed as an EAT wall-clock Date whose UTC fields hold the EAT values. */
function eatNow() { return new Date(Date.now() + EAT_OFFSET_HOURS * 3600000); }

/** 'YYYY-MM-DD' for the current EAT date (+ optional days). */
function eatDateString(addDays = 0) {
  const d = new Date(eatNow().getTime() + addDays * 86400000);
  return d.getUTCFullYear() + '-' + _pad2(d.getUTCMonth() + 1) + '-' + _pad2(d.getUTCDate());
}

/** EAT date ('YYYY-MM-DD') + time ('HH:mm') picked by the rider -> 'YYYY-MM-DD HH:mm:ss' in UTC for the API. */
function eatToUtcString(dateStr, timeStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr).split(':').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh - EAT_OFFSET_HOURS, mm || 0, 0));
  return utc.getUTCFullYear() + '-' + _pad2(utc.getUTCMonth() + 1) + '-' + _pad2(utc.getUTCDate()) + ' ' +
    _pad2(utc.getUTCHours()) + ':' + _pad2(utc.getUTCMinutes()) + ':' + _pad2(utc.getUTCSeconds());
}

/** API datetime (UTC) -> 'YYYY-MM-DD HH:mm EAT'. */
function formatEat(raw, withTime = true) {
  if (!raw) return '—';
  try {
    const s = String(raw);
    const d = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? new Date(s) : new Date(s.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return s;
    const e = new Date(d.getTime() + EAT_OFFSET_HOURS * 3600000);
    const day = e.getUTCFullYear() + '-' + _pad2(e.getUTCMonth() + 1) + '-' + _pad2(e.getUTCDate());
    return withTime ? day + ' ' + _pad2(e.getUTCHours()) + ':' + _pad2(e.getUTCMinutes()) + ' EAT' : day;
  } catch (_) { return String(raw); }
}

/** Coloured status pill used by parcels and tours. */
function statusBadge(status) {
  const s = String(status || 'pending').toLowerCase();
  const map = { pending: 'warning text-dark', assigned: 'info text-dark', picked_up: 'primary', in_transit: 'primary', in_progress: 'primary', delivered: 'success', completed: 'success', cancelled: 'danger' };
  return '<span class="badge bg-' + (map[s] || 'secondary') + '">' + esc(s.replace(/_/g, ' ')) + '</span>';
}

/** Normalise list payloads: array, or { key: [...] } for any of the given keys. */
function pickList(d, keys) {
  if (Array.isArray(d)) return d;
  for (const k of (keys || [])) if (d && Array.isArray(d[k])) return d[k];
  return [];
}
