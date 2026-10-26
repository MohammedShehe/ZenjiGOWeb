// ZenjiGO Web - Configuration
// Change API_BASE to your deployed backend URL when ready.
var ZENJIGO_CONFIG = window.ZENJIGO_CONFIG = {
  API_BASE: 'https://zenjigo-backend.onrender.com/api/v1',
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
   * Maps — Google Maps JavaScript API + Places API (New) + Geocoding API.
   * Put your key in GOOGLE_MAPS_API_KEY and restrict it to this website (HTTP referrer) in Google Cloud.
   */
  MAP: {
    PROVIDER: 'google',
    GOOGLE_MAPS_API_KEY: 'AIzaSyD2_9WpUt3D0SlOJTMKY5kK_omBZ0tUhC4',
    DEFAULT_CENTER: { lat: -6.1659, lng: 39.2026 },
    DEFAULT_ZOOM: 14,
    COUNTRY: 'tz'
  }
};

// API base is fixed to the deployed backend.
function setApiBase(url) {
  const parsed = new URL(String(url || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('API URL must start with http:// or https://');
  const normalized = parsed.href.replace(/\/$/, '');
  ZENJIGO_CONFIG.API_BASE = normalized;
  return normalized;
}
