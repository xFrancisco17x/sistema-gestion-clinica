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


            </div>
        </>
    );
}
