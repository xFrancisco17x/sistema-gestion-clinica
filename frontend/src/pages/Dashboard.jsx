import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/reports/dashboard')
            .then(setStats)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

    return (
        <>
            <div className="top-header">
                <h1>📊 Dashboard</h1>
                <span style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                    {new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
            </div>
            <div className="page-content">
                <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        ¡Bienvenido/a, {user?.firstName}! 👋
                    </h2>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                        Rol: <span className="badge badge-info">{user?.role}</span>
                        {user?.doctor && <> · Especialidad: <span className="badge badge-success">{user.doctor.specialty}</span></>}
                    </p>
                </div>

                {stats && (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon green">👥</div>
                            <div className="stat-info">
                                <h3>{stats.totalPatients}</h3>
                                <p>Pacientes registrados</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon blue">📅</div>
                            <div className="stat-info">
                                <h3>{stats.todayAppointments}</h3>
                                <p>Citas hoy</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon amber">📋</div>
                            <div className="stat-info">
                                <h3>{stats.monthAppointments}</h3>
                                <p>Citas del mes</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon green">✅</div>
                            <div className="stat-info">
                                <h3>{stats.attendedAppointments}</h3>
                                <p>Atendidas (mes)</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon red">❌</div>
                            <div className="stat-info">
                                <h3>{stats.cancelledAppointments}</h3>
                                <p>Canceladas (mes)</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon purple">💵</div>
                            <div className="stat-info">
                                <h3>${stats.monthRevenue?.toFixed(2) || '0.00'}</h3>
                                <p>Ingresos del mes</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon amber">📄</div>
                            <div className="stat-info">
                                <h3>{stats.pendingInvoices}</h3>
                                <p>Facturas pendientes</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon blue">📈</div>
                            <div className="stat-info">
                                <h3>{stats.occupancyRate}%</h3>
                                <p>Tasa de ocupación</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3>🏥 Accesos rápidos</h3>
                    </div>
                    <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {[
                            { label: 'Nuevo Paciente', icon: '👤', href: '/patients', color: 'var(--primary-500)' },
                            { label: 'Agendar Cita', icon: '📅', href: '/appointments', color: 'var(--accent-500)' },
                            { label: 'Atención Médica', icon: '🩺', href: '/medical', color: '#8b5cf6' },
                            { label: 'Facturación', icon: '💰', href: '/billing', color: 'var(--warning)' },
                            { label: 'Reportes', icon: '📈', href: '/reports', color: 'var(--danger)' },
                        ].map(item => (
                            <a
                                key={item.label}
                                href={item.href}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '16px', borderRadius: 'var(--radius)',
                                    border: '1px solid var(--gray-200)', textDecoration: 'none',
                                    transition: 'all 0.2s', cursor: 'pointer'
                                }}
                                onMouseOver={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseOut={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                            >
                                <span style={{ fontSize: '24px' }}>{item.icon}</span>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.label}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
