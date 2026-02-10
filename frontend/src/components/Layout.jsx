import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
    {
        section: 'Principal', items: [
            { path: '/', icon: '📊', label: 'Dashboard', permission: null },
        ]
    },
    {
        section: 'Clínico', items: [
            { path: '/patients', icon: '👥', label: 'Pacientes', permission: { module: 'patients', action: 'read' } },
            { path: '/appointments', icon: '📅', label: 'Agenda / Citas', permission: { module: 'appointments', action: 'read' } },
            { path: '/medical', icon: '🩺', label: 'Atención Médica', permission: { module: 'medical', action: 'read' } },
        ]
    },
    {
        section: 'Financiero', items: [
            { path: '/billing', icon: '💰', label: 'Facturación', permission: { module: 'billing', action: 'read' } },
        ]
    },
    {
        section: 'Sistema', items: [
            { path: '/reports', icon: '📈', label: 'Reportes', permission: { module: 'reports', action: 'read' } },
            { path: '/admin', icon: '⚙️', label: 'Administración', permission: { module: 'admin', action: 'read' } },
            { path: '/audit', icon: '📋', label: 'Auditoría', permission: { module: 'audit', action: 'read' } },
        ]
    },
];

export default function Layout() {
    const { user, logout, hasPermission } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : '?';

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="brand-icon">🏥</div>
                    <div>
                        <h2>Clínica Vida Salud</h2>
                        <small>Sistema de Gestión</small>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(section => {
                        const visibleItems = section.items.filter(item =>
                            !item.permission || hasPermission(item.permission.module, item.permission.action)
                        );
                        if (visibleItems.length === 0) return null;

                        return (
                            <div className="nav-section" key={section.section}>
                                <div className="nav-section-title">{section.section}</div>
                                {visibleItems.map(item => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        end={item.path === '/'}
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="icon">{item.icon}</span>
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">{initials}</div>
                        <div className="user-details">
                            <div className="name">{user?.firstName} {user?.lastName}</div>
                            <div className="role">{user?.role}</div>
                        </div>
                    </div>
                    <button className="btn btn-secondary btn-sm btn-block" style={{ marginTop: '12px' }} onClick={handleLogout}>
                        🚪 Cerrar sesión
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
