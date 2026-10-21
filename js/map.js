/**
 * ZenjiGO map helper
 * Default: Leaflet + OpenStreetMap (no API key).
 * Switch to Google by setting ZENJIGO_CONFIG.MAP.PROVIDER = 'google'
 * and filling GOOGLE_MAPS_API_KEY.
 */
(function (global) {
  const cfg = () => (global.ZENJIGO_CONFIG && global.ZENJIGO_CONFIG.MAP) || {};
  let leafletLoaded = false;
  let googleLoading = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  async function ensureLeaflet() {
    if (leafletLoaded && global.L) return;
    loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    leafletLoaded = true;
  }

  async function ensureGoogle() {
    const key = cfg().GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error('GOOGLE_MAPS_API_KEY is empty. Set it in js/config.js');
    if (global.google && global.google.maps) return;
    if (!googleLoading) {
      googleLoading = loadScript(
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`
      );
    }
    await googleLoading;
  }

  /**
   * Create a map inside elementId.
   * options: { center: {lat,lng}, zoom, markers: [{lat,lng,label,color}], draggablePickup, onPickupChange }
   * Returns { map, setMarkers, setCenter, destroy }
   */
  async function createMap(elementId, options = {}) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error('Map container not found: ' + elementId);
    el.innerHTML = '';
    el.style.minHeight = el.style.minHeight || '280px';

    const center = options.center || cfg().DEFAULT_CENTER || { lat: -6.1659, lng: 39.2026 };
    const zoom = options.zoom != null ? options.zoom : (cfg().DEFAULT_ZOOM || 13);
    const provider = (cfg().PROVIDER || 'leaflet').toLowerCase();

    if (provider === 'google') {
      await ensureGoogle();
      const map = new google.maps.Map(el, {
        center: { lat: Number(center.lat), lng: Number(center.lng) },
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });
      const markers = [];
      function setMarkers(list) {
        markers.forEach((m) => m.setMap(null));
        markers.length = 0;
        (list || []).forEach((m) => {
          const marker = new google.maps.Marker({
            position: { lat: Number(m.lat), lng: Number(m.lng) },
            map,
            title: m.label || '',
            draggable: !!m.draggable
          });
          if (m.draggable && typeof options.onMarkerDrag === 'function') {
            marker.addListener('dragend', () => {
              const p = marker.getPosition();
              options.onMarkerDrag({ lat: p.lat(), lng: p.lng(), id: m.id });
            });
          }
          markers.push(marker);
        });
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

    // Leaflet (default)
    await ensureLeaflet();
    const map = L.map(el).setView([Number(center.lat), Number(center.lng)], zoom);
    L.tileLayer(cfg().TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: cfg().TILE_ATTRIBUTION || '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    function setMarkers(list) {
      layerGroup.clearLayers();
      (list || []).forEach((m) => {
        const marker = L.marker([Number(m.lat), Number(m.lng)], {
          draggable: !!m.draggable,
          title: m.label || ''
        });
        if (m.label) marker.bindPopup(m.label);
        if (m.draggable && typeof options.onMarkerDrag === 'function') {
          marker.on('dragend', (e) => {
            const ll = e.target.getLatLng();
            options.onMarkerDrag({ lat: ll.lat, lng: ll.lng, id: m.id });
          });
        }
        marker.addTo(layerGroup);
      });
    }
    if (options.markers) setMarkers(options.markers);
    // Fix grey tiles when container was hidden
    setTimeout(() => map.invalidateSize(), 100);

    return {
      provider: 'leaflet',
      map,
      setMarkers,
      setCenter(c, z) {
        map.setView([Number(c.lat), Number(c.lng)], z != null ? z : map.getZoom());
      },
      destroy() {
        map.remove();
        el.innerHTML = '';
      }
    };
  }

  global.ZenjiMap = { createMap };
})(window);
