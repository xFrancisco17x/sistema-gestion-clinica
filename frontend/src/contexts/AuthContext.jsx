import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api.setToken(token);
            api.get('/auth/me')
                .then(userData => setUser(userData))
                .catch(() => { api.setToken(null); })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (username, password) => {
        const data = await api.post('/auth/login', { username, password });
        api.setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post('/auth/logout'); } catch { }
        api.setToken(null);
        setUser(null);
    };

    const hasPermission = (module, action) => {
        if (!user) return false;
        if (user.role === 'Administrador') return true;
        return user.permissions?.some(p => p.module === module && (p.action === action || p.action === 'all'));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
