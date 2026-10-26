/**
 * ZenjiGO maps — Google Maps JavaScript API + Places API (New) + Geocoding API.
 *
 * Needs (Google Cloud → APIs & Services): Maps JavaScript API, Places API (New), Geocoding API.
 * Key: ZENJIGO_CONFIG.MAP.GOOGLE_MAPS_API_KEY in js/config.js (restrict it to your website's HTTP referrer).
 *
 * Users never see raw coordinates: they search for a place, tap the map or use their location.
 */
(function (global) {
  const cfg = () => (global.ZENJIGO_CONFIG && global.ZENJIGO_CONFIG.MAP) || {};
  let googleReady = null;
  let authFailed = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onerror = () => reject(new Error('Google Maps could not be loaded. Check your internet connection.'));
      global.__zenjiMapsReady = () => resolve();
      document.head.appendChild(s);
    });
  }

  /** Loads Maps JS once and imports the libraries we use (works with loading=async). */
  function ensureGoogle() {
    if (googleReady) return googleReady;
    googleReady = (async () => {
      const key = cfg().GOOGLE_MAPS_API_KEY || '';
      if (!key || key.includes('YOUR_') || key.includes('CHANGE')) {
        throw new Error('Set MAP.GOOGLE_MAPS_API_KEY in js/config.js');
      }
      global.gm_authFailure = () => {
        authFailed = true;
        document.querySelectorAll('[data-zenji-map]').forEach((el) => {
          el.innerHTML = '<div class="p-4 text-center text-muted small">Map could not be authorised. ' +
            'Enable Maps JavaScript API and billing, and allow this website in the key’s HTTP-referrer restrictions.</div>';
        });
      };
      if (!(global.google && global.google.maps && global.google.maps.importLibrary)) {
        await loadScript(
          'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) +
            '&v=weekly&loading=async&callback=__zenjiMapsReady'
        );
      }
      await Promise.all([
        google.maps.importLibrary('maps'),
        google.maps.importLibrary('core'),
        google.maps.importLibrary('marker'),
        google.maps.importLibrary('places'),
        google.maps.importLibrary('geocoding')
      ]);
    })().catch((e) => {
      googleReady = null; // allow a retry
      throw e;
    });
    return googleReady;
  }

  // ---------------------------------------------------------------- Autocomplete
  function injectStyles() {
    if (document.getElementById('zenji-ac-style')) return;
    const st = document.createElement('style');
    st.id = 'zenji-ac-style';
    st.textContent =
      '.zenji-ac{position:absolute;z-index:2000;background:#fff;border:1px solid #dfe3e8;border-radius:12px;' +
      'box-shadow:0 10px 28px rgba(16,24,40,.16);max-height:300px;overflow:auto;margin-top:4px}' +
      '.zenji-ac-item{padding:10px 14px;cursor:pointer;font-size:14px;line-height:1.3;color:#101828;border-bottom:1px solid #f2f4f7}' +
      '.zenji-ac-item:last-child{border-bottom:0}.zenji-ac-item small{display:block;color:#667085;font-size:12px}' +
      '.zenji-ac-item:hover,.zenji-ac-item.active{background:#f0fdfa}' +
      '.zenji-ac-empty{padding:10px 14px;font-size:13px;color:#667085}';
    document.head.appendChild(st);
  }

  /**
   * Places autocomplete on an input using Places API (New).
   * onPlace({ address, lat, lng, placeId, name })
   */
  async function attachAutocomplete(inputEl, onPlace, options = {}) {
    await ensureGoogle();
    if (!inputEl) return null;
    injectStyles();
    const country = (options.country || cfg().COUNTRY || 'tz').toLowerCase();
    const { AutocompleteSuggestion, AutocompleteSessionToken } = google.maps.places;

    const box = document.createElement('div');
    box.className = 'zenji-ac d-none';
    document.body.appendChild(box);
    let token = new AutocompleteSessionToken();
    let items = [];
    let active = -1;
    let timer = null;
    let seq = 0;
    let suppress = false;

    function place() {
      const r = inputEl.getBoundingClientRect();
      box.style.left = r.left + global.scrollX + 'px';
      box.style.top = r.bottom + global.scrollY + 'px';
      box.style.width = r.width + 'px';
    }
    function hide() { box.classList.add('d-none'); active = -1; }
    function render() {
      box.innerHTML = '';
      if (!items.length) { hide(); return; }
      items.forEach((s, i) => {
        const p = s.placePrediction;
        const d = document.createElement('div');
        d.className = 'zenji-ac-item' + (i === active ? ' active' : '');
        const main = (p.mainText && p.mainText.text) || p.text.text;
        const sub = p.secondaryText && p.secondaryText.text;
        const b = document.createElement('div'); b.textContent = main; d.appendChild(b);
        if (sub) { const sm = document.createElement('small'); sm.textContent = sub; d.appendChild(sm); }
        d.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
        box.appendChild(d);
      });
      place();
      box.classList.remove('d-none');
    }
    async function choose(i) {
      const s = items[i];
      if (!s) return;
      hide();
      try {
        const pl = s.placePrediction.toPlace();
        await pl.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'id'] });
        if (!pl.location) return;
        const address = pl.formattedAddress || (pl.displayName || s.placePrediction.text.text);
        suppress = true;
        inputEl.value = address;
        suppress = false;
        token = new AutocompleteSessionToken(); // a new billing session after a selection
        onPlace({ address, lat: pl.location.lat(), lng: pl.location.lng(), placeId: pl.id, name: pl.displayName || '' });
      } catch (e) {
        console.warn('Place details failed:', e && e.message ? e.message : e);
      }
    }
    async function search() {
      const q = inputEl.value.trim();
      if (q.length < 2) { items = []; hide(); return; }
      const my = ++seq;
      try {
        const req = { input: q, sessionToken: token, includedRegionCodes: [country] };
        if (options.bounds) req.locationBias = options.bounds;
        else if (cfg().DEFAULT_CENTER) req.locationBias = { center: cfg().DEFAULT_CENTER, radius: 50000 };
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
        if (my !== seq) return;
        items = (res.suggestions || []).filter((s) => s.placePrediction).slice(0, 6);
        active = -1;
        render();
      } catch (e) {
        console.warn('Autocomplete failed:', e && e.message ? e.message : e);
        items = []; hide();
      }
    }

    inputEl.setAttribute('autocomplete', 'off');
    inputEl.addEventListener('input', () => {
      if (suppress) return;
      clearTimeout(timer);
      timer = setTimeout(search, 220);
      if (typeof options.onType === 'function') options.onType(inputEl.value);
    });
    inputEl.addEventListener('keydown', (e) => {
      if (box.classList.contains('d-none')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') hide();
    });
    inputEl.addEventListener('blur', () => setTimeout(hide, 150));
    global.addEventListener('resize', place);
    return { destroy() { box.remove(); } };
  }

  // ---------------------------------------------------------------- Geocoding
  /** lat/lng → readable address (or null). */
  async function reverseGeocode(lat, lng) {
    await ensureGoogle();
    try {
      const geocoder = new google.maps.Geocoder();
      const res = await geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } });
      const r = res && res.results && res.results[0];
      return r ? r.formatted_address : null;
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------------------------- Map
  /**
   * options: { center, zoom, markers:[{lat,lng,label,draggable,id,icon,title,info}], onMarkerDrag, onMapClick, fitBounds }
   */
  async function createMap(elementId, options = {}) {
    await ensureGoogle();
    const el = document.getElementById(elementId);
    if (!el) throw new Error('Map container not found: ' + elementId);
    el.innerHTML = '';
    el.setAttribute('data-zenji-map', '1');
    el.style.minHeight = el.style.minHeight || '280px';
    if (authFailed) throw new Error('Google Maps key was rejected.');

    const center = options.center || cfg().DEFAULT_CENTER || { lat: -6.1659, lng: 39.2026 };
    const zoom = options.zoom != null ? options.zoom : cfg().DEFAULT_ZOOM || 13;

    const map = new google.maps.Map(el, {
      center: { lat: Number(center.lat), lng: Number(center.lng) },
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy'
    });
    if (typeof options.onMapClick === 'function') {
      map.addListener('click', (e) => options.onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
    }

    const markers = [];
    let info = null;
    function setMarkers(list, opts = {}) {
      markers.forEach((m) => m.setMap(null));
      markers.length = 0;
      (list || []).forEach((m) => {
        if (m == null || m.lat == null || m.lng == null || !isFinite(m.lat) || !isFinite(m.lng)) return;
        const markerOpts = {
          position: { lat: Number(m.lat), lng: Number(m.lng) },
          map,
          title: m.title || m.label || '',
          draggable: !!m.draggable
        };
        if (m.icon) markerOpts.icon = m.icon;
        else if (m.label) markerOpts.label = { text: String(m.label).slice(0, 1), color: '#fff', fontWeight: '700' };
        const marker = new google.maps.Marker(markerOpts);
        if (m.draggable && typeof options.onMarkerDrag === 'function') {
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            options.onMarkerDrag({ lat: p.lat(), lng: p.lng(), id: m.id });
          });
        }
        if (m.info) {
          marker.addListener('click', () => {
            if (!info) info = new google.maps.InfoWindow();
            info.setContent(m.info);
            info.open({ map, anchor: marker });
          });
        }
        markers.push(marker);
      });
      const shouldFit = opts.fitBounds !== false && options.fitBounds !== false;
      if (shouldFit && markers.length > 1) {
        const b = new google.maps.LatLngBounds();
        markers.forEach((mk) => b.extend(mk.getPosition()));
        map.fitBounds(b, 56);
      } else if (shouldFit && markers.length === 1) {
        map.panTo(markers[0].getPosition());
      }
    }
    if (options.markers) setMarkers(options.markers);

    return {
      provider: 'google',
      map,
      setMarkers,
      fitTo(points, padding = 56) {
        const pts = (points || []).filter((p) => p && isFinite(p.lat) && isFinite(p.lng));
        if (!pts.length) return;
        if (pts.length === 1) { map.setCenter(pts[0]); map.setZoom(15); return; }
        const b = new google.maps.LatLngBounds();
        pts.forEach((p) => b.extend({ lat: Number(p.lat), lng: Number(p.lng) }));
        map.fitBounds(b, padding);
      },
      setCenter(c, z) {
        map.setCenter({ lat: Number(c.lat), lng: Number(c.lng) });
        if (z != null) map.setZoom(z);
      },
      destroy() {
        markers.forEach((m) => m.setMap(null));
        el.innerHTML = '';
      }
    };
  }

  /** Browser geolocation → {lat,lng} or null */
  function getCurrentPosition(timeoutMs = 8000) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
      );
    });
  }

  /** Round driver icon (data URI) */
  function driverIcon(color = '#0d9488') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="${color}" stroke="#fff" stroke-width="2"/>
      <path d="M12 22v-6l4-5h4l4 5v6h-2v-3h-8v3z" fill="#fff"/>
      <circle cx="14" cy="24" r="2.2" fill="#fff"/><circle cx="22" cy="24" r="2.2" fill="#fff"/>
    </svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(36, 36),
      anchor: new google.maps.Point(18, 18)
    };
  }

  global.ZenjiMap = { createMap, attachAutocomplete, ensureGoogle, getCurrentPosition, reverseGeocode, driverIcon };
})(window);
