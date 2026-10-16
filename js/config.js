// ZenjiGO Web - Configuration
// Change API_BASE to your deployed backend URL when ready.
const ZENJIGO_CONFIG = {
  API_BASE: localStorage.getItem('zenjigo_api_base') || 'http://localhost:5000/api/v1',
  APP_NAME: 'ZenjiGO',
  ORG_PHONE: '+255 676 891 227',
  ORG_EMAIL: 'zenjigo@support.com',
  ORG_INSTAGRAM: 'zenjigo',
  CURRENCY: 'TZS',
  DEMO_OTP: '1234', // Frontend hint only – backend validates real OTP
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
  ]
};

// Persist API base override
function setApiBase(url) {
  localStorage.setItem('zenjigo_api_base', url);
  ZENJIGO_CONFIG.API_BASE = url;
}
