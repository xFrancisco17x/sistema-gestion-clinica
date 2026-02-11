import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Reports() {
    const [tab, setTab] = useState('dashboard');
    const [dashboard, setDashboard] = useState(null);
    const [report, setReport] = useState(null);
    const getLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        return getLocalDate(d);
    });
    const [endDate, setEndDate] = useState(getLocalDate(new Date()));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/reports/dashboard').then(setDashboard).catch(console.error);
    }, []);

    const fetchReport = async (type) => {
        setLoading(true);
        try {
            const data = await api.get(`/reports/${type}?startDate=${startDate}&endDate=${endDate}`);
            setReport(data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (tab === 'clinical') fetchReport('clinical');
        if (tab === 'financial') fetchReport('financial');
        if (tab === 'appointments') fetchReport('appointments');
    }, [tab, startDate, endDate]);

    return (
        <>
            <div className="top-header"><h1>📈 Reportes</h1></div>
            <div className="page-content">
                <div className="tabs">
                    <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>📊 Dashboard</button>
                    <button className={`tab ${tab === 'clinical' ? 'active' : ''}`} onClick={() => setTab('clinical')}>🩺 Clínico</button>
                    <button className={`tab ${tab === 'financial' ? 'active' : ''}`} onClick={() => setTab('financial')}>💰 Financiero</button>
                    <button className={`tab ${tab === 'appointments' ? 'active' : ''}`} onClick={() => setTab('appointments')}>📅 Agenda</button>
                </div>

                {tab !== 'dashboard' && (
                    <div className="toolbar">
                        <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.75rem' }}>Desde</label>
                            <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '160px' }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.75rem' }}>Hasta</label>
                            <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '160px' }} />
                        </div>
                    </div>
                )}

                {loading && <div className="loading-spinner"><div className="spinner"></div></div>}

                {tab === 'dashboard' && dashboard && (
                    <div className="stats-grid">
                        {[
                            { icon: '👥', label: 'Total Pacientes', value: dashboard.totalPatients, color: 'green' },
                            { icon: '📅', label: 'Citas Hoy', value: dashboard.todayAppointments, color: 'blue' },
                            { icon: '📋', label: 'Citas del Mes', value: dashboard.monthAppointments, color: 'amber' },
                            { icon: '✅', label: 'Atendidas', value: dashboard.attendedAppointments, color: 'green' },
                            { icon: '❌', label: 'Canceladas', value: dashboard.cancelledAppointments, color: 'red' },
                            { icon: '💵', label: 'Ingresos Mes', value: `$${(dashboard.monthRevenue || 0).toFixed(2)}`, color: 'purple' },
                            { icon: '📄', label: 'Facturas Pend.', value: dashboard.pendingInvoices, color: 'amber' },
                            { icon: '📈', label: 'Tasa Ocupación', value: `${dashboard.occupancyRate}%`, color: 'blue' },
                        ].map(s => (
                            <div className="stat-card" key={s.label}>
                                <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                                <div className="stat-info"><h3>{s.value}</h3><p>{s.label}</p></div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'clinical' && report && !loading && (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div className="card"><div className="card-header"><h3>👨‍⚕️ Atenciones por Médico</h3></div>
                            <div className="card-body"><div className="table-container"><table><thead><tr><th>Médico</th><th>Especialidad</th><th>Atenciones</th></tr></thead>
                                <tbody>{report.byDoctor?.map(d => <tr key={d.doctor}><td>{d.doctor}</td><td>{d.specialty}</td><td><strong>{d.count}</strong></td></tr>)}</tbody>
                            </table></div></div></div>
                        <div className="card"><div className="card-header"><h3>🔍 Top Diagnósticos</h3></div>
                            <div className="card-body"><div className="table-container"><table><thead><tr><th>Diagnóstico</th><th>Frecuencia</th></tr></thead>
                                <tbody>{report.topDiagnoses?.map(d => <tr key={d.diagnosis}><td>{d.diagnosis}</td><td><strong>{d.count}</strong></td></tr>)}</tbody>
                            </table></div></div></div>
                    </div>
                )}

                {tab === 'financial' && report && !loading && (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div className="stats-grid">
                            <div className="stat-card"><div className="stat-icon green">💰</div><div className="stat-info"><h3>${report.totalInvoiced?.toFixed(2)}</h3><p>Facturado</p></div></div>
                            <div className="stat-card"><div className="stat-icon blue">✅</div><div className="stat-info"><h3>${report.totalCollected?.toFixed(2)}</h3><p>Cobrado</p></div></div>
                            <div className="stat-card"><div className="stat-icon red">⏳</div><div className="stat-info"><h3>${report.totalPending?.toFixed(2)}</h3><p>Pendiente</p></div></div>
                        </div>
                        <div className="card"><div className="card-header"><h3>💳 Pagos por Método</h3></div>
                            <div className="card-body"><div className="table-container"><table><thead><tr><th>Método</th><th>Total</th></tr></thead>
                                <tbody>{report.paymentsByMethod?.map(p => <tr key={p.method}><td>{p.method === 'cash' ? 'Efectivo' : p.method === 'transfer' ? 'Transferencia' : p.method === 'card' ? 'Tarjeta' : p.method}</td><td><strong>${p.total?.toFixed(2)}</strong></td></tr>)}</tbody>
                            </table></div></div></div>
                    </div>
                )}

                {tab === 'appointments' && report && !loading && (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div className="card"><div className="card-header"><h3>📊 Citas por Estado</h3></div>
                            <div className="card-body" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {report.byStatus?.map(s => (
                                    <div key={s.status} className="stat-card" style={{ flex: '1 1 140px' }}>
                                        <div className="stat-info"><h3>{s.count}</h3><p>{s.status === 'attended' ? 'Atendidas' : s.status === 'cancelled' ? 'Canceladas' : s.status === 'scheduled' ? 'Programadas' : s.status}</p></div>
                                    </div>
                                ))}
                            </div></div>
                        <div className="card"><div className="card-header"><h3>👨‍⚕️ Por Médico</h3></div>
                            <div className="card-body"><div className="table-container"><table><thead><tr><th>Médico</th><th>Total</th><th>Atendidas</th><th>Canceladas</th></tr></thead>
                                <tbody>{report.byDoctor?.map(d => <tr key={d.doctor}><td>{d.doctor}</td><td><strong>{d.total}</strong></td><td>{d.attended}</td><td>{d.cancelled}</td></tr>)}</tbody>
                            </table></div></div></div>
                    </div>
                )}
            </div>
        </>
    );
}
