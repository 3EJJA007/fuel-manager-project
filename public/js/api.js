// API Client with JWT Auth & Request Handlers
const API = (() => {
  const TOKEN_KEY = 'fm_jwt_token';
  const BASE_URL = '/api';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const contentType = response.headers.get('content-type');
      let data = null;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          setToken(null);
          window.location.reload();
        }
        const errMessage = (data && data.message) || `Erreur serveur (${response.status})`;
        throw new Error(errMessage);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  return {
    getToken,
    setToken,

    // Auth (US 1, 2, 3, 4)
    auth: {
      login: (email, motDePasse) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, motDePasse }) }),
      register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
      me: () => request('/auth/me'),
      profile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
      resetDemo: () => request('/auth/reset-demo', { method: 'POST' })
    },

    // Users & Roles (US 5)
    users: {
      list: () => request('/users'),
      create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, patch) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
      delete: (id) => request(`/users/${id}`, { method: 'DELETE' })
    },

    // Stations (US 6, 7, 8, 9)
    stations: {
      list: () => request('/stations'),
      get: (id) => request(`/stations/${id}`),
      create: (data) => request('/stations', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, patch) => request(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
      delete: (id) => request(`/stations/${id}`, { method: 'DELETE' })
    },

    // Fuels (US 10, 11, 12, 13, 30)
    fuels: {
      list: () => request('/fuels'),
      get: (id) => request(`/fuels/${id}`),
      create: (data) => request('/fuels', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, patch) => request(`/fuels/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
      delete: (id) => request(`/fuels/${id}`, { method: 'DELETE' })
    },

    // Pumps (US 14, 15, 16)
    pumps: {
      list: (stationId) => request(`/pumps${stationId ? `?stationId=${stationId}` : ''}`),
      create: (data) => request('/pumps', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, patch) => request(`/pumps/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
      delete: (id) => request(`/pumps/${id}`, { method: 'DELETE' })
    },

    // Tanks (US 17, 18, 19, 29)
    tanks: {
      list: (stationId) => request(`/tanks${stationId ? `?stationId=${stationId}` : ''}`),
      create: (data) => request('/tanks', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, patch) => request(`/tanks/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
      delete: (id) => request(`/tanks/${id}`, { method: 'DELETE' })
    },

    // Suppliers (US 20, 21, 22, 23)
    suppliers: {
      list: () => request('/suppliers'),
      get: (id) => request(`/suppliers/${id}`),
      create: (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, patch) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
      delete: (id) => request(`/suppliers/${id}`, { method: 'DELETE' })
    },

    // Deliveries (US 24, 25)
    deliveries: {
      list: (stationId) => request(`/deliveries${stationId ? `?stationId=${stationId}` : ''}`),
      create: (data) => request('/deliveries', { method: 'POST', body: JSON.stringify(data) })
    },

    // Sales (US 26, 27, 28)
    sales: {
      list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/sales${query ? `?${query}` : ''}`);
      },
      create: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) })
    },

    // Stats & Stock (US 29, 30)
    stats: {
      dashboard: (stationId) => request(`/stats/dashboard${stationId ? `?stationId=${stationId}` : ''}`),
      stockSummary: (stationId) => request(`/stats/stock-summary${stationId ? `?stationId=${stationId}` : ''}`),
      movements: (stationId) => request(`/stats/movements${stationId ? `?stationId=${stationId}` : ''}`)
    }
  };
})();

