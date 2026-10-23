// ZenjiGO Web - Configuration
// Change API_BASE to your deployed backend URL when ready.
var ZENJIGO_CONFIG = window.ZENJIGO_CONFIG = {
  API_BASE: (function () {
    const saved = (localStorage.getItem('zenjigo_api_base') || '').trim();
    // Local frontend servers (Live Server/Vite/etc.) usually run on a different
    // port than the API. Do not accidentally call <frontend-origin>/api/v1.
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    const defaultBase = isLocalHost || location.protocol === 'file:'
      ? 'https://zenjigo-backend.onrender.com/api/v1'
      : location.origin + '/api/v1';
    const candidate = saved || defaultBase;
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) return defaultBase;
      return parsed.href.replace(/\/$/, '');
    } catch (_) { return defaultBase; }
  })(),
  APP_NAME: 'ZenjiGO',
  ORG_PHONE: '+255 676 891 227',
  ORG_EMAIL: 'support@zenjigo.online',
  ORG_INSTAGRAM: 'zenjigo',
  CURRENCY: 'TZS',
  
  RIDE_TYPES: [
    { id: 'boda', name: 'Boda', nameSw: 'Boda', icon: 'bi-bicycle', baseFare: 1500, perKm: 400 },
    { id: 'bajaji', name: 'Bajaji', nameSw: 'Bajaji', icon: 'bi-scooter', baseFare: 2500, perKm: 600 },
    { id: 'taxi', name: 'Taxi', nameSw: 'Teksi', icon: 'bi-taxi-front', baseFare: 5000, perKm: 1200 }
  ],
  PAYMENT_METHODS: [
    { id: 'cash', name: 'Cash', icon: 'bi-cash-coin' },
    { id: 'momo', name: 'Mobile Money', icon: 'bi-phone' },
    { id: 'bank', name: 'Bank Card', icon: 'bi-credit-card' },
    { id: 'wallet', name: 'ZenjiGO Wallet', icon: 'bi-wallet2' }
  ],
  MOBILE_PROVIDERS: [
    { id: 'mpesa', name: 'M-Pesa', code: 'MPESA' },
    { id: 'tigo', name: 'Mix by Yas (Tigo)', code: 'TIGO' },
    { id: 'airtel', name: 'Airtel Money', code: 'AIRTEL' },
    { id: 'halopesa', name: 'HaloPesa', code: 'HALO' }
  ],
  /**
   * Maps – ready for production.
   * Default: Leaflet + OpenStreetMap (no API key required).
   * To use Google Maps instead:
   *   1. Set MAP_PROVIDER: 'google'
   *   2. Put your key in GOOGLE_MAPS_API_KEY
   *   3. Enable Maps JavaScript API + Places API in Google Cloud Console
   */
  MAP: {
    PROVIDER: 'google',
    // Paste your Google Maps JavaScript API key (Maps JS + Places enabled)
    GOOGLE_MAPS_API_KEY: 'AIzaSyD2_9WpUt3D0SlOJTMKY5kK_omBZ0tUhC4',
    DEFAULT_CENTER: { lat: -6.1659, lng: 39.2026 },
    DEFAULT_ZOOM: 14,
    COUNTRY: 'tz'
  }
};

// Persist API base override
function setApiBase(url) {
  const parsed = new URL(String(url || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('API URL must start with http:// or https://');
  const normalized = parsed.href.replace(/\/$/, '');
  localStorage.setItem('zenjigo_api_base', normalized);
  ZENJIGO_CONFIG.API_BASE = normalized;
  return normalized;
}
