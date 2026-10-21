/**
 * ZenjiGO maps — Google Maps + Places Autocomplete (production).
 * Set ZENJIGO_CONFIG.MAP.GOOGLE_MAPS_API_KEY in js/config.js
 * Enable: Maps JavaScript API, Places API (New or legacy).
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
      // wait a tick for places
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
    const bounds = options.bounds; // optional LatLngBounds
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
   * Create map in elementId.
   * options: { center, zoom, markers: [{lat,lng,label,draggable,id}], onMarkerDrag }
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
    function setMarkers(list) {
      markers.forEach((m) => m.setMap(null));
      markers.length = 0;
      (list || []).forEach((m) => {
        if (m == null || m.lat == null) return;
        const marker = new google.maps.Marker({
          position: { lat: Number(m.lat), lng: Number(m.lng) },
          map,
          title: m.label || '',
          draggable: !!m.draggable,
          label: m.label ? { text: m.label.slice(0, 1), color: '#fff' } : undefined
        });
        if (m.draggable && typeof options.onMarkerDrag === 'function') {
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            options.onMarkerDrag({ lat: p.lat(), lng: p.lng(), id: m.id });
          });
        }
        markers.push(marker);
      });
      if (markers.length > 1) {
        const b = new google.maps.LatLngBounds();
        markers.forEach((mk) => b.extend(mk.getPosition()));
        map.fitBounds(b, 48);
      } else if (markers.length === 1) {
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

  global.ZenjiMap = { createMap, attachAutocomplete, ensureGoogle, getCurrentPosition };
})(window);
