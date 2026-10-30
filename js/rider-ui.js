/* ZenjiGO shared rider navigation and global theme controls */
(function () {
  'use strict';
  const file = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const items = [
    ['dashboard.html','bi-house-door','Home'],
    ['book.html','bi-plus-circle','Book a ride'],
    ['history.html','bi-clock-history','Ride history'],
    ['wallet.html','bi-wallet2','Wallet'],
    ['payments.html','bi-credit-card','Payments'],
    ['saved.html','bi-bookmark-heart','Saved places'],
    ['parcels.html','bi-box-seam','Parcels'],
    ['tours.html','bi-compass','Tours'],
    ['promotions.html','bi-tag','Offers'],
    ['chat.html','bi-chat-dots','Messages'],
    ['profile.html','bi-person-circle','Profile']
  ];
  function buildNav() {
    const side = document.getElementById('appSidebar');
    if (!side) return;
    const brand = side.querySelector('.brand');
    if (brand) brand.innerHTML = 'Zenji<span>GO</span><small class="d-block fw-normal">RIDER PORTAL</small>';
    let nav = side.querySelector('nav');
    if (!nav) { nav = document.createElement('nav'); side.appendChild(nav); }
    nav.className = 'rider-nav mt-2';
    nav.innerHTML = '<div class="nav-section-label">YOUR JOURNEY</div>' +
      items.map(([href, icon, label]) => `<a href="${href}" class="nav-link${file === href ? ' active' : ''}"${file === href ? ' aria-current="page"' : ''}><i class="bi ${icon}"></i><span>${label}</span></a>`).join('') +
      '<div class="nav-section-label mt-3">ACCOUNT</div><a href="#" class="nav-link" id="zenjiRiderLogout"><i class="bi bi-box-arrow-right"></i><span>Sign out</span></a>';
    document.getElementById('zenjiRiderLogout')?.addEventListener('click', e => {
      e.preventDefault();
      if (typeof window.logout === 'function') window.logout();
    });
  }
  function setTheme(mode) {
    mode = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.bsTheme = mode;
    document.body.dataset.theme = mode;
    document.body.dataset.bsTheme = mode;
    try { localStorage.setItem('zenjigo_theme', mode); } catch (_) {}
    document.querySelectorAll('.zenji-theme-toggle').forEach(b => {
      b.innerHTML = mode === 'dark'
        ? '<i class="bi bi-sun"></i><span class="theme-label">Light mode</span>'
        : '<i class="bi bi-moon-stars"></i><span class="theme-label">Dark mode</span>';
      b.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }
  function themeButton() {
    const host = document.querySelector('.app-topbar > .d-flex:last-child') || document.querySelector('.app-topbar') || document.querySelector('.auth-card') || document.querySelector('.rider-register-shell');
    if (!host || host.querySelector('.zenji-theme-toggle')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'zenji-theme-toggle'; b.innerHTML = '<i class="bi bi-moon-stars"></i><span class="theme-label">Dark mode</span>';
    b.addEventListener('click', () => setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
    host.appendChild(b);
  }
  function mobileNav() {
    const side = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    document.querySelectorAll('[onclick*="toggleSidebar"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => overlay?.classList.toggle('show', !!side?.classList.contains('show')), 0));
    });
    overlay?.addEventListener('click', () => { side?.classList.remove('show'); overlay.classList.remove('show'); });
    side?.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => {
      if (innerWidth < 992) { side.classList.remove('show'); overlay?.classList.remove('show'); }
    }));
  }
  function loadingButtons() {
    document.querySelectorAll('button[type="submit"], button[data-loading], .btn-primary-zenji').forEach(btn => {
      if (btn.dataset.loadingWired) return;
      btn.dataset.loadingWired = '1';
      btn.addEventListener('click', () => {
        if (btn.disabled || btn.dataset.noAutoLoading === 'true') return;
        const form = btn.closest('form');
        if (form && !form.checkValidity()) return;
        if (btn.dataset.autoLoading === 'true') return;
        btn.dataset.autoLoading = 'true';
        const original = btn.innerHTML;
        btn.dataset.originalLoadingHtml = original;
        btn.classList.add('is-loading');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>' + (btn.dataset.loadingText || 'Please wait…');
        const restore = () => {
          btn.disabled = false; btn.classList.remove('is-loading');
          btn.innerHTML = btn.dataset.originalLoadingHtml || original;
          delete btn.dataset.autoLoading;
        };
        // Restore automatically if an existing async handler does not use setLoading().
        setTimeout(() => { if (btn.dataset.autoLoading === 'true') restore(); }, 18000);
      });
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    let mode = 'light'; try { mode = localStorage.getItem('zenjigo_theme') || 'light'; } catch (_) {}
    setTheme(mode); buildNav(); themeButton(); mobileNav();
  });
  window.zenjiSetTheme = setTheme;
  window.toggleSidebar = function () {
    const s = document.getElementById('appSidebar'), o = document.getElementById('sidebarOverlay');
    if (!s) return;
    const open = !s.classList.contains('show');
    s.classList.toggle('show', open);
    o?.classList.toggle('show', open);
    document.body.classList.toggle('sidebar-open', open && innerWidth < 992);
  };

  function setMsgBadge(count) {
    const link = document.querySelector('.rider-nav a[href="chat.html"]');
    if (!link) return;
    let badge = link.querySelector('.nav-msg-badge');
    const n = Number(count) || 0;
    if (n > 0 && file !== 'chat.html') {
      if (!badge) {
        badge = document.createElement('em');
        badge.className = 'nav-msg-badge';
        badge.style.cssText = 'display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:auto;border-radius:999px;background:#16a085;color:#fff;font-size:.68rem;font-weight:700;font-style:normal';
        link.appendChild(badge);
      }
      badge.textContent = n > 99 ? '99+' : String(n);
    } else if (badge) badge.remove();
  }
  async function refreshMsgBadge() {
    if (file === 'chat.html') { setMsgBadge(0); return; }
    if (!window.Api || !Api.rider || typeof Api.rider.conversations !== 'function') return;
    try {
      const list = await Api.rider.conversations();
      const arr = Array.isArray(list) ? list : [];
      const unread = arr.reduce((s, c) => s + (Number(c.unreadCount || c.unread_count || 0) || 0), 0);
      setMsgBadge(unread);
    } catch (_) {}
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(refreshMsgBadge, 400);
    setInterval(refreshMsgBadge, 45000);
  });

})();
/* Resume an in-progress ride after refresh / re-login (matches the app). */
(async function resumeActiveRide() {
  try {
    if (!/\/(dashboard|book)\.html/.test(location.pathname) || !window.Api || !Api.isLoggedIn()) return;
    const list = await Api.rider.history();
    const rides = Array.isArray(list) ? list : (list && (list.rides || list.items)) || [];
    const a = rides.find(r => ['searching','accepted','arriving','arrived','started'].includes(String(r.status).toLowerCase()));
    if (!a) return;
    const bar = document.createElement('div');
    bar.className = 'alert alert-info d-flex justify-content-between align-items-center m-3';
    bar.innerHTML = '<span><i class="bi bi-geo-alt-fill me-2"></i>You have a ride in progress.</span><a class="btn btn-sm btn-primary-zenji" href="ride.html?id=' + encodeURIComponent(a.id) + '">View ride</a>';
    const host = document.querySelector('.app-content'); if (host) host.prepend(bar);
  } catch (_) {}
})();
