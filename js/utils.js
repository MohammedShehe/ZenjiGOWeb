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
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`);
  const el = document.getElementById(id);
  const t = new bootstrap.Toast(el, { delay: 3500 });
  t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function formatMoney(amount) {
  if (amount == null) return '—';
  return 'TZS ' + Number(amount).toLocaleString('en-TZ');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
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
