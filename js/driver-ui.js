/* ZenjiGO shared driver navigation, theme, status, and message badges */
(function () {
  'use strict';
  const file = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const items = [
    ['dashboard.html', 'bi-grid-1x2', 'Overview'],
    ['requests.html', 'bi-bell', 'Ride requests'],
    ['active.html', 'bi-sign-turn-right', 'Active ride'],
    ['earnings.html', 'bi-wallet2', 'Earnings & payouts'],
    ['history.html', 'bi-clock-history', 'Ride history'],
    ['chat.html', 'bi-chat-dots', 'Messages'],
    ['profile.html', 'bi-person-vcard', 'Profile & documents']
  ];

  function nav() {
    const side = document.getElementById('appSidebar');
    if (!side) return;
    const brand = side.querySelector('.brand');
    if (brand) {
      brand.innerHTML =
        'Zenji<span>GO</span><small class="d-block text-white-50 fw-normal">DRIVER PORTAL</small>';
    }
    let n = side.querySelector('nav');
    if (!n) {
      n = document.createElement('nav');
      side.appendChild(n);
    }
    n.className = 'mt-2 driver-nav';
    n.innerHTML =
      items
        .map(
          ([href, ic, label]) =>
            `<a href="${href}" class="nav-link${file === href ? ' active' : ''}"${
              file === href ? ' aria-current="page"' : ''
            } data-nav="${href}"><i class="bi ${ic}"></i><span>${label}</span></a>`
        )
        .join('') +
      '<div class="nav-section-label">ACCOUNT</div>' +
      '<a href="#" class="nav-link" id="zenjiLogout"><i class="bi bi-box-arrow-right"></i><span>Sign out</span></a>';
    const out = document.getElementById('zenjiLogout');
    if (out) {
      out.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.logout === 'function') window.logout();
        else {
          try {
            localStorage.removeItem('zenjigo_token');
            localStorage.removeItem('token');
            localStorage.removeItem('zenjigo_access');
            localStorage.removeItem('accessToken');
          } catch (_) {}
          location.href = 'login.html';
        }
      });
    }
  }

  function themeButton() {
    const host =
      document.querySelector('.app-topbar > .d-flex:last-child') ||
      document.querySelector('.app-topbar') ||
      document.querySelector('.auth-card');
    if (!host || host.querySelector('.zenji-theme-toggle')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zenji-theme-toggle';
    b.setAttribute('aria-label', 'Switch color theme');
    host.appendChild(b);
    const update = () => {
      const d = document.body.dataset.theme === 'dark';
      b.innerHTML = d
        ? '<i class="bi bi-sun"></i><span class="theme-label">Light mode</span>'
        : '<i class="bi bi-moon-stars"></i><span class="theme-label">Dark mode</span>';
    };
    b.addEventListener('click', () => {
      const d = document.body.dataset.theme !== 'dark';
      const mode = d ? 'dark' : 'light';
      document.body.dataset.theme = mode;
      document.documentElement.setAttribute('data-bs-theme', mode);
      document.body.setAttribute('data-bs-theme', mode);
      try {
        localStorage.setItem('zenjigo_theme', mode);
      } catch (_) {}
      update();
    });
    update();
  }

  function statuses() {
    document.querySelectorAll('.status-badge').forEach((el) => {
      const v = (el.textContent || '').trim().toLowerCase();
      el.classList.remove('status-suspended', 'status-active', 'status-pending', 'status-offline');
      if (/suspend|blocked|rejected|cancel|fail/.test(v)) el.classList.add('status-suspended');
      else if (/active|online|approved|complete|verified|available/.test(v)) el.classList.add('status-active');
      else if (/pending|review|await|processing/.test(v)) el.classList.add('status-pending');
      else if (/offline|inactive/.test(v)) el.classList.add('status-offline');
    });
  }

  function mobile() {
    const side = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    // The hamburger already calls window.toggleSidebar() inline. Do not
    // attach a second toggling handler here (it would immediately re-close it).
    if (overlay) {
      overlay.addEventListener('click', () => {
        side?.classList.remove('show');
        overlay.classList.remove('show');
      });
    }
    side?.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => {
      if (innerWidth < 992) {
        side.classList.remove('show');
        overlay?.classList.remove('show');
      }
    }));
  }

  function setMsgBadge(count) {
    const link = document.querySelector('.driver-nav a[data-nav="chat.html"], .driver-nav a[href="chat.html"]');
    if (!link) return;
    let badge = link.querySelector('.nav-msg-badge');
    const n = Number(count) || 0;
    if (n > 0 && file !== 'chat.html') {
      if (!badge) {
        badge = document.createElement('em');
        badge.className = 'nav-msg-badge';
        badge.style.cssText =
          'display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:auto;border-radius:999px;background:#16a085;color:#fff;font-size:.68rem;font-weight:700;font-style:normal';
        link.appendChild(badge);
      }
      badge.textContent = n > 99 ? '99+' : String(n);
    } else if (badge) {
      badge.remove();
    }
  }

  async function refreshMsgBadge() {
    // On the chat page itself, mark conversations read and clear badge
    if (file === 'chat.html') {
      setMsgBadge(0);
      try {
        localStorage.setItem('zenjigo_driver_msg_seen', String(Date.now()));
      } catch (_) {}
      return;
    }
    if (!window.Api || !Api.driver || typeof Api.driver.conversations !== 'function') return;
    try {
      const list = await Api.driver.conversations();
      const arr = Array.isArray(list) ? list : [];
      const unread = arr.reduce((s, c) => s + (Number(c.unreadCount || c.unread_count || 0) || 0), 0);
      setMsgBadge(unread);
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    let t = 'light';
    try {
      t = localStorage.getItem('zenjigo_theme') || 'light';
    } catch (_) {}
    const mode = t === 'dark' ? 'dark' : 'light';
    document.body.dataset.theme = mode;
    document.documentElement.setAttribute('data-bs-theme', mode);
    document.body.setAttribute('data-bs-theme', mode);
    nav();
    themeButton();
    mobile();
    statuses();
    new MutationObserver(statuses).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    // Delay so Api is ready
    setTimeout(refreshMsgBadge, 400);
    setInterval(refreshMsgBadge, 45000);
  });

  window.toggleSidebar = function () {
    const s = document.getElementById('appSidebar');
    const o = document.getElementById('sidebarOverlay');
    if (!s) return;
    const open = !s.classList.contains('show');
    s.classList.toggle('show', open);
    if (o) o.classList.toggle('show', open);
    document.body.classList.toggle('sidebar-open', open && innerWidth < 992);
  };
  window.zenjiDriverRefreshMsgBadge = refreshMsgBadge;
})();

/* Resume an in-progress ride after refresh / re-login (matches the app). */
(async function resumeActiveRide() {
  try {
    if (!/\/(dashboard|requests)\.html/.test(location.pathname) || !window.Api || !Api.isLoggedIn()) return;
    const list = await Api.driver.history(10);
    const rides = Array.isArray(list) ? list : (list && (list.rides || list.items)) || [];
    const a = rides.find(r => ['accepted','arriving','arrived','started'].includes(String(r.status).toLowerCase()));
    if (!a) return;
    const bar = document.createElement('div');
    bar.className = 'alert alert-info d-flex justify-content-between align-items-center m-3';
    bar.innerHTML = '<span><i class="bi bi-geo-alt-fill me-2"></i>You have a ride in progress.</span><a class="btn btn-sm btn-primary-zenji" href="active.html?id=' + encodeURIComponent(a.id) + '">Continue ride</a>';
    const host = document.querySelector('.app-content'); if (host) host.prepend(bar);
  } catch (_) {}
})();
