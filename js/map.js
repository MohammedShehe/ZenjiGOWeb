/**
 * ZenjiGO maps — Google Maps + Places Autocomplete (production).
 * Set ZENJIGO_CONFIG.MAP.GOOGLE_MAPS_API_KEY in js/config.js
 * Enable: Maps JavaScript API, Places API (New or legacy), Geocoding API.
 */
(function (global) {
  const cfg = () => (global.ZENJIGO_CONFIG && global.ZENJIGO_CONFIG.MAP) || {};
  let googleReady = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src^="${src.split('?')[0]}"]`);
      if (existing) {
        if (global.google && global.google.maps) resolve();
        else existing.addEventListener('load', () => resolve());
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(s);
    });
  }

  async function ensureGoogle() {
    if (global.google && global.google.maps && global.google.maps.places) return;
    if (googleReady) return googleReady;
    const key = cfg().GOOGLE_MAPS_API_KEY || '';
    if (!key || key.includes('YOUR_') || key.includes('CHANGE')) {
      throw new Error('Set MAP.GOOGLE_MAPS_API_KEY in js/config.js');
    }
    googleReady = loadScript(
      'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(key) +
        '&libraries=places&loading=async'
    ).then(() => {
      return new Promise((r) => {
        const t = setInterval(() => {
          if (global.google && global.google.maps && global.google.maps.places) {
            clearInterval(t);
            r();
          }
        }, 30);
        setTimeout(() => {
          clearInterval(t);
          r();
        }, 5000);
      });
    });
    return googleReady;
  }

  /**
   * Attach Places Autocomplete to an input.
   * onPlace({ address, lat, lng, placeId, name })
   */
  async function attachAutocomplete(inputEl, onPlace, options = {}) {
    await ensureGoogle();
    if (!inputEl) return null;
    const bounds = options.bounds;
    const ac = new google.maps.places.Autocomplete(inputEl, {
      fields: ['formatted_address', 'geometry', 'name', 'place_id'],
      componentRestrictions: options.country ? { country: options.country } : { country: 'tz' },
      types: options.types || ['geocode', 'establishment']
    });
    if (bounds) ac.setBounds(bounds);
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place || !place.geometry || !place.geometry.location) return;
      const loc = place.geometry.location;
      onPlace({
        address: place.formatted_address || place.name || inputEl.value,
        lat: loc.lat(),
        lng: loc.lng(),
        placeId: place.place_id,
        name: place.name
      });
    });
    return ac;
  }

  /**
   * Reverse geocode lat/lng → address string (or null).
   */
  async function reverseGeocode(lat, lng) {
    await ensureGoogle();
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Create map in elementId.
   * options: { center, zoom, markers: [{lat,lng,label,draggable,id,icon,title}], onMarkerDrag, fitBounds }
   * icon can be a URL string or google.maps.Icon / Symbol.
   */
  async function createMap(elementId, options = {}) {
    await ensureGoogle();
    const el = document.getElementById(elementId);
    if (!el) throw new Error('Map container not found: ' + elementId);
    el.innerHTML = '';
    el.style.minHeight = el.style.minHeight || '280px';

    const center = options.center || cfg().DEFAULT_CENTER || { lat: -6.1659, lng: 39.2026 };
    const zoom = options.zoom != null ? options.zoom : cfg().DEFAULT_ZOOM || 13;

    const map = new google.maps.Map(el, {
      center: { lat: Number(center.lat), lng: Number(center.lng) },
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true
    });

    const markers = [];
    function setMarkers(list, opts = {}) {
      markers.forEach((m) => m.setMap(null));
      markers.length = 0;
      (list || []).forEach((m) => {
        if (m == null || m.lat == null) return;
        const markerOpts = {
          position: { lat: Number(m.lat), lng: Number(m.lng) },
          map,
          title: m.title || m.label || '',
          draggable: !!m.draggable
        };
        if (m.icon) {
          markerOpts.icon = m.icon;
        } else if (m.label) {
          markerOpts.label = { text: String(m.label).slice(0, 1), color: '#fff', fontWeight: '700' };
        }
        const marker = new google.maps.Marker(markerOpts);
        if (m.draggable && typeof options.onMarkerDrag === 'function') {
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            options.onMarkerDrag({ lat: p.lat(), lng: p.lng(), id: m.id });
          });
        }
        if (m.info && typeof google.maps.InfoWindow === 'function') {
          const iw = new google.maps.InfoWindow({ content: m.info });
          marker.addListener('click', () => iw.open({ map, anchor: marker }));
        }
        markers.push(marker);
      });
      const shouldFit = opts.fitBounds !== false && options.fitBounds !== false;
      if (shouldFit && markers.length > 1) {
        const b = new google.maps.LatLngBounds();
        markers.forEach((mk) => b.extend(mk.getPosition()));
        map.fitBounds(b, 48);
      } else if (shouldFit && markers.length === 1) {
        map.panTo(markers[0].getPosition());
      }
    }
    if (options.markers) setMarkers(options.markers);

    return {
      provider: 'google',
      map,
      setMarkers,
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

  /** Try browser geolocation → {lat,lng} or null */
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

  /** Simple car / bike SVG icon for online drivers (data URI) */
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

  global.ZenjiMap = {
    createMap,
    attachAutocomplete,
    ensureGoogle,
    getCurrentPosition,
    reverseGeocode,
    driverIcon
  };
})(window);
