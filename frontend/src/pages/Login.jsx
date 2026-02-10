import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Error de autenticación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <div className="icon">🏥</div>
                    <h1>Clínica Vida Salud</h1>
                    <p>Sistema de Gestión Clínica</p>
                </div>

                {error && <div className="alert alert-error">⚠️ {error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Usuario</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Ingrese su usuario"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="Ingrese su contraseña"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                        {loading ? 'Ingresando...' : '🔐 Iniciar Sesión'}
                    </button>
                </form>

                <div style={{ marginTop: '24px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                    <strong>Usuarios demo:</strong><br />
                    admin / Admin123! — dra.martinez / Medico123!<br />
                    recepcion / Recep123! — caja / Caja123! — gerencia / Geren123!
                </div>
            </div>
        </div>
    );
}
