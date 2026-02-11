const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = { 'Content-Type': 'application/json', ...options.headers };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 && !endpoint.startsWith('/auth/')) {
            this.setToken(null);
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
            throw new Error('Sesión expirada');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error del servidor');
        }

        return data;
    }

    get(endpoint) { return this.request(endpoint); }
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
}

const api = new ApiService();
export default api;
