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
      '.zenji-ac{position:fixed;z-index:2000;background:#fff;border:1px solid #dfe3e8;border-radius:12px;' +
      'box-shadow:0 10px 28px rgba(16,24,40,.16);max-height:300px;overflow:auto;margin-top:4px}' +
      '.zenji-ac-item{padding:10px 14px;cursor:pointer;font-size:14px;line-height:1.3;color:#101828;border-bottom:1px solid #f2f4f7}' +
      '.zenji-ac-item:last-child{border-bottom:0}.zenji-ac-item small{display:block;color:#667085;font-size:12px}' +
      '.zenji-ac-item:hover,.zenji-ac-item.active{background:#f0fdfa}' +
      '.zenji-ac-empty{padding:10px 14px;font-size:13px;color:#667085}';
    document.head.appendChild(st);
  }

  /**
   * Places autocomplete on an input.
   * Primary source: Google Places API (New) in the browser.
   * Fallback (automatic): the ZenjiGO backend proxy /driver/places/autocomplete + /details
   * (the same endpoints the Flutter apps use), so suggestions still appear when the browser key
   * is restricted, billing is off, or the Google script is blocked.
   * onPlace({ address, lat, lng, placeId, name })
   */
  async function attachAutocomplete(inputEl, onPlace, options = {}) {
    if (!inputEl) return null;
    injectStyles();
    let useProxy = false;
    try { await ensureGoogle(); } catch (e) { useProxy = true; console.warn('Using backend places proxy:', e && e.message ? e.message : e); }
    const country = (options.country || cfg().COUNTRY || 'tz').toLowerCase();
    let AutocompleteSuggestion = null, AutocompleteSessionToken = null;
    if (!useProxy) {
      try { ({ AutocompleteSuggestion, AutocompleteSessionToken } = google.maps.places); } catch (_) { useProxy = true; }
      if (!AutocompleteSuggestion) useProxy = true;
    }

    const box = document.createElement('div');
    box.className = 'zenji-ac d-none';
    document.body.appendChild(box);
    let token = (!useProxy && AutocompleteSessionToken) ? new AutocompleteSessionToken() : null;
    let items = [];          // [{ main, secondary, full, placeId, _g }]
    let active = -1;
    let timer = null;
    let seq = 0;
    let suppress = false;

    function place() {
      const r = inputEl.getBoundingClientRect();
      box.style.position = 'fixed';
      box.style.left = r.left + 'px';
      box.style.top = r.bottom + 'px';
      box.style.width = r.width + 'px';
    }
    function hide() { box.classList.add('d-none'); active = -1; }
    function render() {
      box.innerHTML = '';
      if (!items.length) { hide(); return; }
      items.forEach((s, i) => {
        const d = document.createElement('div');
        d.className = 'zenji-ac-item' + (i === active ? ' active' : '');
        const b = document.createElement('div'); b.textContent = s.main; d.appendChild(b);
        if (s.secondary) { const sm = document.createElement('small'); sm.textContent = s.secondary; d.appendChild(sm); }
        d.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
        d.addEventListener('touchstart', (e) => { e.preventDefault(); choose(i); }, { passive: false });
        box.appendChild(d);
      });
      place();
      box.classList.remove('d-none');
    }

    /** Friendly label like the app: "Main, FirstSecondaryPart", never a Plus Code. */
    function label(main, secondary, full) {
      const isPlus = (t) => /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}/.test(String(t || '').split(',')[0].trim());
      const m = isPlus(main) ? '' : String(main || '').trim();
      const sec = isPlus(secondary) ? '' : String(secondary || '').trim();
      if (m && sec) {
        const short = sec.split(',')[0].trim();
        return short && !m.includes(short) ? m + ', ' + short : m;
      }
      return m || sec.split(',').slice(0, 2).join(', ') || String(full || '').split(',').slice(0, 2).join(',').trim();
    }

    async function proxySearch(q) {
      const payload = await Api.driver.placesAutocomplete(q);
      const list = (payload && (payload.predictions || payload.data && payload.data.predictions)) || [];
      return list.filter((p) => p && p.placeId).slice(0, 6).map((p) => ({
        main: (p.structured && p.structured.main) || p.description || '',
        secondary: (p.structured && p.structured.secondary) || '',
        full: p.description || '',
        placeId: p.placeId
      }));
    }

    async function choose(i) {
      const s = items[i];
      if (!s) return;
      hide();
      try {
        let lat, lng, placeId = s.placeId;
        if (s._g) {
          const pl = s._g.placePrediction.toPlace();
          await pl.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'id'] });
          if (!pl.location) return;
          lat = pl.location.lat(); lng = pl.location.lng(); placeId = pl.id;
        } else {
          const d = await Api.driver.placeDetails(s.placeId);
          lat = d && d.lat != null ? Number(d.lat) : null;
          lng = d && d.lng != null ? Number(d.lng) : null;
          if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) throw new Error('Could not resolve this place. Please choose another suggestion.');
        }
        // Keep the human-readable label the user chose (formattedAddress may be a Plus Code).
        const selectedLabel = label(s.main, s.secondary, s.full);
        suppress = true;
        inputEl.value = selectedLabel;
        suppress = false;
        if (!useProxy && AutocompleteSessionToken) token = new AutocompleteSessionToken();
        onPlace({ address: selectedLabel, lat, lng, placeId, name: selectedLabel });
      } catch (e) {
        console.warn('Place details failed:', e && e.message ? e.message : e);
        if (typeof global.showToast === 'function') global.showToast((e && e.message) || 'Could not resolve this place.', 'error');
      }
    }

    async function search() {
      const q = inputEl.value.trim();
      if (q.length < 2) { items = []; hide(); return; }
      const my = ++seq;
      if (!useProxy) {
        try {
          const req = { input: q, sessionToken: token, includedRegionCodes: [country] };
          if (options.bounds) req.locationBias = options.bounds;
          else if (cfg().DEFAULT_CENTER) req.locationBias = { center: cfg().DEFAULT_CENTER, radius: 50000 };
          const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
          if (my !== seq) return;
          items = (res.suggestions || []).filter((s) => s.placePrediction).slice(0, 6).map((s) => {
            const p = s.placePrediction;
            return {
              main: (p.mainText && p.mainText.text) || (p.text && p.text.text) || '',
              secondary: (p.secondaryText && p.secondaryText.text) || '',
              full: (p.text && p.text.text) || '',
              placeId: p.placeId,
              _g: s
            };
          });
          active = -1;
          render();
          return;
        } catch (e) {
          console.warn('Google autocomplete failed, switching to backend proxy:', e && e.message ? e.message : e);
          useProxy = true; // permanent for this input: the browser key/API is not usable
        }
      }
      try {
        const list = await proxySearch(q);
        if (my !== seq) return;
        items = list; active = -1; render();
      } catch (e) {
        console.warn('Autocomplete failed:', e && e.message ? e.message : e);
        items = []; hide();
      }
    }

    inputEl.setAttribute('autocomplete', 'off');
    inputEl.addEventListener('input', () => {
      if (suppress) return;
      clearTimeout(timer);
      timer = setTimeout(search, 250);
      if (typeof options.onType === 'function') options.onType(inputEl.value);
    });
    inputEl.addEventListener('keydown', (e) => {
      if (box.classList.contains('d-none')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') hide();
    });
    inputEl.addEventListener('blur', () => setTimeout(hide, 200));
    global.addEventListener('resize', place);
    global.addEventListener('scroll', () => { if (!box.classList.contains('d-none')) place(); }, true);
    return { destroy() { box.remove(); } };
  }

  // ---------------------------------------------------------------- Geocoding
  /** lat/lng → readable address (or null). */
  async function reverseGeocode(lat, lng) {
    try {
      await ensureGoogle();
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

    function clearLine() {
      if (routeLine) { routeLine.setMap(null); routeLine = null; }
    }
    function haversine(a, b) {
      const R = 6371000, r = (x) => x * Math.PI / 180;
      const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    }
    /** Google Routes API (the newer replacement for the legacy DirectionsService). */
    async function googleRoutesApi(o, d) {
      const key = cfg().GOOGLE_MAPS_API_KEY;
      if (!key) return null;
      try {
        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring'
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
            destination: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
            travelMode: 'DRIVE',
            polylineEncoding: 'GEO_JSON_LINESTRING'
          })
        });
        if (!res.ok) {
          console.warn('Routes API refused the request (' + res.status + '). Enable "Routes API" for this key and allow this site in its referrer list.');
          return null;
        }
        const data = await res.json();
        const r = data.routes && data.routes[0];
        const coords = r && r.polyline && r.polyline.geoJsonLinestring && r.polyline.geoJsonLinestring.coordinates;
        if (!coords || coords.length < 2) return null;
        return {
          path: coords.map((c) => ({ lat: c[1], lng: c[0] })),
          distanceMeters: r.distanceMeters || 0,
          durationSeconds: parseInt(String(r.duration || '0').replace('s', ''), 10) || 0
        };
      } catch (e) {
        console.warn('Routes API failed:', e && e.message ? e.message : e);
        return null;
      }
    }
    /** OpenStreetMap road routing fallback. */
    async function osrmRoute(o, d) {
      try {
        const url = 'https://router.project-osrm.org/route/v1/driving/' +
          o.lng + ',' + o.lat + ';' + d.lng + ',' + d.lat + '?overview=full&geometries=geojson';
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const r = data.routes && data.routes[0];
        if (!r || !r.geometry || !r.geometry.coordinates || r.geometry.coordinates.length < 2) return null;
        return {
          path: r.geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] })),
          distanceMeters: r.distance || 0,
          durationSeconds: Math.round(r.duration || 0)
        };
      } catch (e) {
        return null;
      }
    }
    const markers = [];
    let info = null;
    let routeLine = null;
    let routeRequestSeq = 0;
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
      /**
       * Draw the road route between pickup and destination (same strategy as the rider app):
       * 1) Google Routes API  2) OSRM (OpenStreetMap roads)  3) straight line (last resort).
       * Does not touch the P/D markers or the viewport.
       */
      async setRoute(origin, destination) {
        const requestId = ++routeRequestSeq;
        const ok = (p) => p && isFinite(Number(p.lat)) && isFinite(Number(p.lng));
        if (!ok(origin) || !ok(destination)) { clearLine(); return null; }
        const o = { lat: Number(origin.lat), lng: Number(origin.lng) };
        const d = { lat: Number(destination.lat), lng: Number(destination.lng) };

        let result = await googleRoutesApi(o, d);
        if (!result) result = await osrmRoute(o, d);
        if (requestId !== routeRequestSeq) return null; // a newer request replaced this one
        let straight = false;
        if (!result) {
          straight = true;
          result = { path: [o, d], distanceMeters: haversine(o, d), durationSeconds: 0 };
        }
        clearLine();
        routeLine = new google.maps.Polyline({
          map,
          path: result.path,
          strokeColor: '#0d9488',
          strokeOpacity: straight ? 0 : 0.95,
          strokeWeight: 6,
          zIndex: 5,
          geodesic: false,
          icons: straight ? [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, scale: 3 },
            offset: '0', repeat: '14px'
          }] : null
        });
        result.followsRoads = !straight;
        return result;
      },
      clearRoute() {
        routeRequestSeq++;
        clearLine();
      },
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
        routeRequestSeq++;
        clearLine();
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
