// ZenjiGO Web - API Client (exact endpoints from mobile apps & backend)
const Api = (() => {
  const getTokens = () => ({
    access: localStorage.getItem('accessToken'),
    refresh: localStorage.getItem('refreshToken')
  });

  const setTokens = (access, refresh) => {
    if (access) localStorage.setItem('accessToken', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
  };

  const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userData');
  };

  async function tryRefresh() {
    const { refresh } = getTokens();
    if (!refresh) return false;
    try {
      const res = await fetch(`${ZENJIGO_CONFIG.API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      });
      const data = await res.json();
      if (res.ok && data.success !== false && data.data) {
        setTokens(data.data.accessToken || data.data.access, data.data.refreshToken || data.data.refresh);
        return true;
      }
    } catch (e) {}
    clearTokens();
    return false;
  }

  async function request(method, path, { body = null, auth = true, isForm = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (!isForm) headers['Content-Type'] = 'application/json';
    if (auth) {
      const { access } = getTokens();
      if (access) headers['Authorization'] = `Bearer ${access}`;
    }

    const opts = { method: method.toUpperCase(), headers };
    if (body && method.toUpperCase() !== 'GET') {
      opts.body = isForm ? body : JSON.stringify(body);
    }

    let res = await fetch(`${ZENJIGO_CONFIG.API_BASE}${path}`, opts);

    if (res.status === 401 && auth) {
      if (await tryRefresh()) {
        const { access } = getTokens();
        if (access) headers['Authorization'] = `Bearer ${access}`;
        res = await fetch(`${ZENJIGO_CONFIG.API_BASE}${path}`, opts);
      }
    }

    let data = {};
    const text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }

    if (!res.ok || data.success === false) {
      const msg = data.message || data.error || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Helper that returns data payload
  async function data(method, path, opts = {}) {
    const res = await request(method, path, opts);
    return res.data !== undefined ? res.data : res;
  }

  /* ===================== AUTH ===================== */
  const auth = {
    sendRiderOtp: (phone, channel = 'sms') =>
      data('POST', '/auth/rider/send-otp', { body: { phone, channel }, auth: false }),
    verifyRiderOtp: (phone, code, fullName) =>
      data('POST', '/auth/rider/verify-otp', {
        body: { phone, code, ...(fullName ? { fullName } : {}) },
        auth: false
      }),
    sendDriverOtp: (phone, purpose = 'login') =>
      data('POST', '/auth/driver/send-otp', { body: { phone, purpose }, auth: false }),
    loginDriver: (phone, code) =>
      data('POST', '/auth/driver/login', { body: { phone, code }, auth: false }),
    refresh: (refreshToken) =>
      data('POST', '/auth/refresh', { body: { refreshToken }, auth: false }),
    logout: () => request('POST', '/auth/logout').finally(clearTokens)
  };

  /* ===================== RIDER ===================== */
  const rider = {
    me: () => data('GET', '/rider/me'),
    updateMe: (body) => data('PATCH', '/rider/me', { body }),
    savedLocations: () => data('GET', '/rider/saved-locations'),
    createSavedLocation: (body) => data('POST', '/rider/saved-locations', { body }),
    deleteSavedLocation: (id) => data('DELETE', `/rider/saved-locations/${id}`),
    paymentMethods: () => data('GET', '/rider/payment-methods'),
    addPaymentMethod: (body) => data('POST', '/rider/payment-methods', { body }),
    setDefaultPayment: (id) => data('PATCH', `/rider/payment-methods/${id}/default`),
    deletePaymentMethod: (id) => data('DELETE', `/rider/payment-methods/${id}`),
    quote: (body) => data('POST', '/rider/rides/quote', { body }),
    createRide: (body) => data('POST', '/rider/rides', { body }),
    getRide: (id) => data('GET', `/rider/rides/${id}`),
    track: (id) => data('GET', `/rider/rides/${id}/track`),
    cancelRide: (id, reason) => data('POST', `/rider/rides/${id}/cancel`, { body: { reason } }),
    rate: (id, stars, feedback, tip) =>
      data('POST', `/rider/rides/${id}/rating`, {
        body: { stars, ...(feedback ? { feedback } : {}), ...(tip != null ? { tip } : {}) }
      }),
    history: () => data('GET', '/rider/rides'),
    walletBalance: () => data('GET', '/rider/wallet'),
    walletTransactions: () => data('GET', '/rider/wallet/transactions'),
    topUp: (amount, paymentMethod) =>
      data('POST', '/rider/wallet/topup', { body: { amount, paymentMethod } }),
    promos: () => data('GET', '/promos'),
    applyPromo: (code, rideId) =>
      data('POST', '/promos/apply', { body: { code, ...(rideId ? { rideId } : {}) } }),
    parcels: () => data('GET', '/rider/parcels'),
    createParcel: (body) => data('POST', '/rider/parcels', { body }),
    tourPackages: () => data('GET', '/rider/tour-packages'),
    tours: () => data('GET', '/rider/tours'),
    bookTour: (body) => data('POST', '/rider/tours', { body }),
    conversations: () => data('GET', '/rider/chat'),
    openSupport: () => data('POST', '/rider/chat/support'),
    messages: (id) => data('GET', `/rider/chat/${id}/messages`),
    sendMessage: (id, text) => data('POST', `/rider/chat/${id}/messages`, { body: { text } }),
    notifications: () => data('GET', '/rider/notifications'),
    markNotificationRead: (id) => data('PATCH', `/rider/notifications/${id}/read`),
    registerFcm: (token, platform = 'web') =>
      data('POST', '/rider/notifications/token', { body: { token, platform } })
  };

  /* ===================== DRIVER ===================== */
  const driver = {
    register: async (fields, files) => {
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v == null ? '' : String(v)));
      if (files) {
        Object.entries(files).forEach(([key, fileList]) => {
          (Array.isArray(fileList) ? fileList : [fileList]).forEach(f => {
            if (f) form.append(key, f);
          });
        });
      }
      return data('POST', '/driver/register', { body: form, auth: false, isForm: true });
    },
    me: () => data('GET', '/driver/me'),
    documents: () => data('GET', '/driver/documents'),
    setOnline: (online) => data('PATCH', '/driver/online', { body: { online } }),
    updateLocation: (lat, lng, heading, speed) =>
      data('POST', '/driver/location', {
        body: { lat, lng, ...(heading != null ? { heading } : {}), ...(speed != null ? { speed } : {}) }
      }),
    rideRequests: () => data('GET', '/driver/ride-requests'),
    acceptRide: (id) => data('POST', `/driver/rides/${id}/accept`),
    updateStatus: (id, status) =>
      data('PATCH', `/driver/rides/${id}/status`, { body: { status } }),
    history: (limit = 50) => data('GET', `/driver/rides?limit=${limit}`),
    finance: () => data('GET', '/driver/finance'),
    earnings: (from, to) => {
      const q = [];
      if (from) q.push(`from=${from}`);
      if (to) q.push(`to=${to}`);
      return data('GET', `/driver/earnings${q.length ? '?' + q.join('&') : ''}`);
    },
    settle: (provider = 'example') =>
      data('POST', '/driver/settlements', { body: { provider } }),
    markSettlementPaid: (id, externalReference) =>
      data('POST', `/driver/settlements/${id}/mark-paid`, { body: { externalReference } }),
    autopay: (enabled, provider, providerToken) =>
      data('POST', '/driver/autopay', {
        body: { enabled, ...(provider ? { provider } : {}), ...(providerToken ? { providerToken } : {}) }
      }),
    paymentMethods: () => data('GET', '/driver/payment-methods'),
    addPaymentMethod: (body) => data('POST', '/driver/payment-methods', { body }),
    removePaymentMethod: (id) => data('DELETE', `/driver/payment-methods/${id}`),
    payout: (amount, method, accountDetails) =>
      data('POST', '/driver/payout', {
        body: { amount, method, ...(accountDetails ? { accountDetails } : {}) }
      }),
    conversations: () => data('GET', '/driver/chat'),
    openSupport: () => data('POST', '/driver/chat/support'),
    messages: (id) => data('GET', `/driver/chat/${id}/messages`),
    sendMessage: (id, text) => data('POST', `/driver/chat/${id}/messages`, { body: { text } }),
    notifications: () => data('GET', '/driver/notifications')
  };

  return {
    request,
    data,
    auth,
    rider,
    driver,
    setTokens,
    clearTokens,
    getTokens,
    isLoggedIn: () => !!getTokens().access,
    getRole: () => localStorage.getItem('userRole'),
    setRole: (r) => localStorage.setItem('userRole', r),
    getUser: () => {
      try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch { return null; }
    },
    setUser: (u) => localStorage.setItem('userData', JSON.stringify(u))
  };
})();
