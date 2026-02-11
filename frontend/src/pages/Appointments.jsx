import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function Appointments() {
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [filterDoctor, setFilterDoctor] = useState('');
    const [filterDate, setFilterDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [actionModal, setActionModal] = useState(null); // { type: 'cancel'|'reschedule', appointment }
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const { hasPermission } = useAuth();

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            let url = '/appointments?limit=100';
            if (filterDate) url += `&date=${filterDate}`;
            if (filterDoctor) url += `&doctorId=${filterDoctor}`;
            if (filterStatus) url += `&status=${filterStatus}`;
            const data = await api.get(url);
            setAppointments(data.data);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        api.get('/doctors').then(setDoctors).catch(err => setError('Error cargando médicos: ' + err.message));
        fetchAppointments();
    }, []);

    useEffect(() => { fetchAppointments(); }, [filterDate, filterDoctor, filterStatus]);

    const handleCancel = async (id, reason) => {
        try {
            await api.put(`/appointments/${id}/cancel`, { reason });
            setSuccess('Cita cancelada');
            setActionModal(null);
            fetchAppointments();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    const handleReschedule = async (id, dateTime, reason) => {
        try {
            await api.put(`/appointments/${id}/reschedule`, { dateTime, reason });
            setSuccess('Cita reprogramada');
            setActionModal(null);
            fetchAppointments();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    const statusBadge = (s) => {
        const m = {
            scheduled: ['badge-info', '📅 Programada'], confirmed: ['badge-info', '✓ Confirmada'],
            attended: ['badge-success', '✅ Atendida'], cancelled: ['badge-danger', '❌ Cancelada'],
            rescheduled: ['badge-warning', '🔄 Reprogramada'], no_show: ['badge-gray', '⚠ No asistió']
        };
        const [cls, label] = m[s] || ['badge-gray', s];
        return <span className={`badge ${cls}`}>{label}</span>;
    };

    return (
        <>
            <div className="top-header">
                <h1>📅 Agenda / Citas</h1>
                {hasPermission('appointments', 'create') && (
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>➕ Nueva Cita</button>
                )}
            </div>
            <div className="page-content">
                {error && <div className="alert alert-error">⚠️ {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}
                {success && <div className="alert alert-success">✅ {success}</div>}

                <div className="toolbar">
                    <div className="form-group" style={{ margin: 0 }}>
                        <input type="date" className="form-control" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: '180px' }} />
                    </div>
                    <select className="form-control" value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} style={{ width: '220px' }}>
                        <option value="">Todos los médicos</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>Dr(a). {d.user.firstName} {d.user.lastName} — {d.specialty.name}</option>)}
                    </select>
                    <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '180px' }}>
                        <option value="">Todos los estados</option>
                        <option value="scheduled">Programada</option>
                        <option value="confirmed">Confirmada</option>
                        <option value="attended">Atendida</option>
                        <option value="cancelled">Cancelada</option>
                        <option value="rescheduled">Reprogramada</option>
                        <option value="no_show">No asistió</option>
                    </select>
                </div>

                <div className="card">
                    {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : appointments.length === 0 ? (
                        <div className="empty-state"><div className="icon">📅</div><p>No hay citas para esta fecha/filtro</p></div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Hora</th><th>Paciente</th><th>Médico</th><th>Especialidad</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr>
                                </thead>
                                <tbody>
                                    {appointments.map(a => (
                                        <tr key={a.id}>
                                            <td><strong>{new Date(a.dateTime).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</strong> — {new Date(a.endTime).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td>{a.patient.firstName} {a.patient.lastName}<br /><small style={{ color: 'var(--gray-400)' }}>{a.patient.medicalRecordNumber}</small></td>
                                            <td>Dr(a). {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}</td>
                                            <td>{a.doctor?.specialty?.name}</td>
                                            <td>{a.reason || '—'}</td>
                                            <td>{statusBadge(a.status)}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {!['cancelled', 'attended'].includes(a.status) && hasPermission('appointments', 'update') && (
                                                        <>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => setActionModal({ type: 'reschedule', appointment: a })}>🔄</button>
                                                            <button className="btn btn-danger btn-sm" onClick={() => setActionModal({ type: 'cancel', appointment: a })}>❌</button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showModal && <CreateAppointmentModal doctors={doctors} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); setSuccess('Cita creada'); fetchAppointments(); setTimeout(() => setSuccess(''), 3000); }} />}

            {actionModal?.type === 'cancel' && (
                <CancelModal appointment={actionModal.appointment} onClose={() => setActionModal(null)} onConfirm={handleCancel} />
            )}

            {actionModal?.type === 'reschedule' && (
                <RescheduleModal appointment={actionModal.appointment} onClose={() => setActionModal(null)} onConfirm={handleReschedule} />
            )}
        </>
    );
}

function CreateAppointmentModal({ doctors, onClose, onCreated }) {
    const [form, setForm] = useState({ patientSearch: '', patientId: '', doctorId: '', dateTime: '', duration: 30, reason: '' });
    const [patients, setPatients] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const searchPatients = async (q) => {
        if (q.length < 2) { setSearchResults([]); return; }
        try {
            const data = await api.get(`/patients?search=${q}&limit=5`);
            setSearchResults(data.data);
        } catch { }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await api.post('/appointments', {
                patientId: parseInt(form.patientId),
                doctorId: parseInt(form.doctorId),
                dateTime: form.dateTime,
                duration: parseInt(form.duration),
                reason: form.reason
            });
            onCreated();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h2>📅 Nueva Cita</h2><button className="modal-close" onClick={onClose}>✕</button></div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="alert alert-error">⚠️ {error}</div>}
                        <div className="form-group">
                            <label>Buscar Paciente *</label>
                            <input className="form-control" placeholder="Escriba nombre o cédula..." value={form.patientSearch}
                                onChange={e => { setForm(p => ({ ...p, patientSearch: e.target.value })); searchPatients(e.target.value); }} />
                            {searchResults.length > 0 && (
                                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', marginTop: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                                    {searchResults.map(p => (
                                        <div key={p.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', fontSize: '0.875rem' }}
                                            onClick={() => { setForm(f => ({ ...f, patientId: p.id, patientSearch: `${p.firstName} ${p.lastName} (${p.idNumber})` })); setSearchResults([]); }}
                                            onMouseOver={e => e.currentTarget.style.background = 'var(--gray-50)'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                                            <strong>{p.firstName} {p.lastName}</strong> — {p.idNumber} <span style={{ color: 'var(--gray-400)' }}>{p.medicalRecordNumber}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Médico *</label>
                            <select className="form-control" required value={form.doctorId} onChange={e => setForm(p => ({ ...p, doctorId: e.target.value }))}>
                                <option value="">Seleccione médico</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>Dr(a). {d.user.firstName} {d.user.lastName} — {d.specialty.name}</option>)}
                            </select>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Fecha y Hora *</label>
                                <input type="datetime-local" className="form-control" required value={form.dateTime} onChange={e => setForm(p => ({ ...p, dateTime: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label>Duración (min)</label>
                                <select className="form-control" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}>
                                    <option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Motivo de consulta</label>
                            <textarea className="form-control" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Ej: Control general, dolor de cabeza..." />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !form.patientId || !form.doctorId}>{saving ? 'Creando...' : 'Agendar Cita'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CancelModal({ appointment, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header"><h2>❌ Cancelar Cita</h2><button className="modal-close" onClick={onClose}>✕</button></div>
                <div className="modal-body">
                    <p style={{ marginBottom: '16px', fontSize: '0.875rem' }}>Paciente: <strong>{appointment.patient.firstName} {appointment.patient.lastName}</strong></p>
                    <div className="form-group">
                        <label>Motivo de cancelación *</label>
                        <textarea className="form-control" required value={reason} onChange={e => setReason(e.target.value)} placeholder="Ingrese motivo..." />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Volver</button>
                    <button className="btn btn-danger" disabled={!reason} onClick={() => onConfirm(appointment.id, reason)}>Confirmar Cancelación</button>
                </div>
            </div>
        </div>
    );
}

function RescheduleModal({ appointment, onClose, onConfirm }) {
    const [dateTime, setDateTime] = useState('');
    const [reason, setReason] = useState('');
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header"><h2>🔄 Reprogramar Cita</h2><button className="modal-close" onClick={onClose}>✕</button></div>
                <div className="modal-body">
                    <p style={{ marginBottom: '16px', fontSize: '0.875rem' }}>Paciente: <strong>{appointment.patient.firstName} {appointment.patient.lastName}</strong></p>
                    <div className="form-group">
                        <label>Nueva fecha y hora *</label>
                        <input type="datetime-local" className="form-control" required value={dateTime} onChange={e => setDateTime(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Motivo de reprogramación *</label>
                        <textarea className="form-control" required value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: Solicitud del paciente..." />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Volver</button>
                    <button className="btn btn-primary" disabled={!dateTime || !reason} onClick={() => onConfirm(appointment.id, dateTime, reason)}>Reprogramar</button>
                </div>
            </div>
        </div>
    );
}
