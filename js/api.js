// ZenjiGO Web - API Client (exact endpoints from mobile apps & backend)
const Api = (() => {
  const getTokens = () => ({
    access: localStorage.getItem('accessToken'),
    refresh: localStorage.getItem('refreshToken')
  });

  const setTokens = (access, refresh) => {
    if (access) {
      localStorage.setItem('accessToken', access);
      // Keep the legacy key in sync for older pages/integrations.
      localStorage.setItem('zenjigo_access', access);
    }
    if (refresh) localStorage.setItem('refreshToken', refresh);
  };

  // Normalize the different token response shapes returned by the auth API.
  // Rider login/registration used to call this method, but only setTokens existed.
  const saveTokens = (payload, role) => {
    const root = payload && typeof payload === 'object' ? payload : {};
    const data = root.data && typeof root.data === 'object' ? root.data : root;
    const tokens = data.tokens && typeof data.tokens === 'object' ? data.tokens : {};
    const access = data.accessToken || data.access_token || data.access ||
      tokens.accessToken || tokens.access_token || tokens.access ||
      root.accessToken || root.access_token || root.access;
    const refresh = data.refreshToken || data.refresh_token || data.refresh ||
      tokens.refreshToken || tokens.refresh_token || tokens.refresh ||
      root.refreshToken || root.refresh_token || root.refresh;

    if (!access) {
      throw new Error('OTP was verified, but the server did not return an access token. Please try again or contact support.');
    }
    setTokens(access, refresh);
    if (role) localStorage.setItem('userRole', role);
    const user = data.user || data.rider || data.driver || root.user || root.rider || root.driver;
    if (user && typeof user === 'object') localStorage.setItem('userData', JSON.stringify(user));
    return { access, refresh: refresh || null, user: user || null };
  };

  const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('zenjigo_access');
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

  function friendlyApiMessage(message, status) {
    const raw = String(message || '').toLowerCase();
    if (status === 401 || status === 403) return 'Your session may have expired. Please sign in again and try once more.';
    if (status === 404) return 'We could not find what you requested. Please refresh the page and try again.';
    if (status === 409) return 'This action conflicts with an existing request. Please review your details and try again.';
    if (status === 422 || status === 400) return 'Please check the information you entered and try again.';
    if (status >= 500) return 'Something went wrong on our side. Please try again shortly.';
    if (/network|fetch|cors|api at|stack|exception|undefined|null reference|sql|database|internal server/.test(raw))
      return 'We could not complete that request. Please check your connection and try again.';
    if (/invalid otp|incorrect otp|otp expired|wrong code/.test(raw)) return 'That verification code is not valid or has expired. Please request a new code.';
    if (/already exists|already registered/.test(raw)) return 'An account with these details may already exist. Please sign in or use different details.';
    if (/too many|rate limit/.test(raw)) return 'You have tried too many times. Please wait a little and try again.';
    return message && String(message).length < 180 ? message : 'We could not complete that request. Please try again.';
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

    let res;
    try {
      res = await fetch(`${ZENJIGO_CONFIG.API_BASE}${path}`, opts);
    } catch (cause) {
      const err = new Error('We could not connect to ZenjiGO right now. Please check your internet connection and try again.');
      err.cause = cause;
      throw err;
    }

    if (res.status === 401 && auth) {
      if (await tryRefresh()) {
        const { access } = getTokens();
        if (access) headers['Authorization'] = `Bearer ${access}`;
        try { res = await fetch(`${ZENJIGO_CONFIG.API_BASE}${path}`, opts); } catch (cause) { const err = new Error('We could not connect to ZenjiGO right now. Please try again in a moment.'); err.cause = cause; throw err; }
      }
    }

    let data = {};
    const text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }

    if (!res.ok || data.success === false) {
      const rawMsg = data.message || data.error || '';
      const msg = friendlyApiMessage(rawMsg, res.status);
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
    sendRiderOtp: (phone, email) =>
      data('POST', '/auth/rider/send-otp', { body: { phone, email }, auth: false }),
    verifyRiderOtp: (phone, email, code, profile = {}) =>
      data('POST', '/auth/rider/verify-otp', {
        body: { phone, email, code, ...(typeof profile === 'string' ? (profile ? { fullName: profile } : {}) : profile) },
        auth: false
      }),
    sendDriverOtp: (phone, email, purpose = 'login') =>
      data('POST', '/auth/driver/send-otp', { body: { phone, email, purpose }, auth: false }),
    sendDriverRegistrationOtp: (email) =>
      data('POST', '/auth/driver/send-email-otp', { body: { email, purpose: 'driver_registration' }, auth: false }),
    verifyDriverRegistrationOtp: (email, code) =>
      data('POST', '/auth/driver/verify-otp', { body: { target: email, code, purpose: 'driver_registration' }, auth: false }),
    loginDriver: (phone, email, code) =>
      data('POST', '/auth/driver/login', { body: { phone, email, code }, auth: false }),
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
    /** Cancel ride. Backend may apply a fee when cancellation is close to pickup / after driver accepted. */
    cancelRide: (id, reason) => data('POST', `/rider/rides/${id}/cancel`, { body: { reason } }),
    /** Optional preview of cancellation fee (if backend supports it). Returns null on failure. */
    cancelPreview: async (id) => {
      try {
        return await data('GET', `/rider/rides/${id}/cancel-preview`);
      } catch (_) {
        return null;
      }
    },
    /** Nearby online drivers for map display. */
    nearbyDrivers: (lat, lng, radiusKm = 5) =>
      data('GET', `/rider/drivers/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${radiusKm}`),
    rate: (id, stars, feedback, tip) =>
      data('POST', `/rider/rides/${id}/rating`, {
        body: { stars, ...(feedback ? { feedback } : {}), ...(tip != null ? { tip } : {}) }
      }),
    history: () => data('GET', '/rider/rides'),
    walletBalance: () => data('GET', '/rider/wallet'),
    walletTransactions: () => data('GET', '/rider/wallet/transactions'),
    topUp: (amount, paymentMethod, phone) =>
      data('POST', '/rider/wallet/topup', { body: { amount, paymentMethod, phone, provider: 'snippe' } }),
    topUpStatus: (id) => data('GET', '/rider/wallet/topup/' + id),
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
    markRead: (id) => data('POST', `/rider/chat/${id}/read`),
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
    applicationStatus: (driverId) => data('GET', `/driver/application-status/${encodeURIComponent(driverId)}`, { auth: false }),
    documents: () => data('GET', '/driver/documents'),
    placesAutocomplete: (input) => data('GET', `/driver/places/autocomplete?input=${encodeURIComponent(input)}`, { auth: false }),
    placeDetails: (placeId) => data('GET', `/driver/places/details?placeId=${encodeURIComponent(placeId)}`, { auth: false }),
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
    // Starts a mobile-money charge for the commission owed. Poll settlementStatus() —
    // the settlement is only 'paid' once the payment provider confirms it.
    settle: (opts = {}) =>
      data('POST', '/driver/settlements', { body: opts }),
    settlements: () => data('GET', '/driver/settlements'),
    settlementStatus: (id) => data('GET', `/driver/settlements/${id}`),
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
    markRead: (id) => data('POST', `/driver/chat/${id}/read`),
    notifications: () => data('GET', '/driver/notifications')
  };

  return {
    request,
    data,
    auth,
    rider,
    driver,
    setTokens,
    saveTokens,
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
