import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function MedicalAttention() {
    const { user } = useAuth();
    const [attentions, setAttentions] = useState([]);
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [activeAttention, setActiveAttention] = useState(null);
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [view, setView] = useState('agenda'); // agenda, attention

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        Promise.all([
            api.get(`/appointments?date=${today}&limit=50`).catch(() => ({ data: [] })),
            api.get('/medical/attentions?limit=20').catch(() => ({ data: [] })),
        ]).then(([aptsData, attData]) => {
            setTodayAppointments(aptsData.data || []);
            setAttentions(attData.data || []);
        }).finally(() => setLoading(false));
    }, []);

    const startAttention = async (appointment) => {
        try {
            const att = await api.post('/medical/attentions', {
                appointmentId: appointment.id,
                patientId: appointment.patientId,
                chiefComplaint: appointment.reason
            });
            setActiveAttention(att);
            setView('attention');
            setSuccess('Atención iniciada');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    const saveAttention = async (data) => {
        try {
            const updated = await api.put(`/medical/attentions/${activeAttention.id}`, data);
            setActiveAttention(updated);
            setSuccess('Atención guardada');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    const closeAttention = async () => {
        try {
            await api.put(`/medical/attentions/${activeAttention.id}/close`);
            setSuccess('Atención cerrada exitosamente');
            setActiveAttention(null);
            setView('agenda');
            const attData = await api.get('/medical/attentions?limit=20');
            setAttentions(attData.data || []);
            const aptsData = await api.get(`/appointments?date=${today}&limit=50`);
            setTodayAppointments(aptsData.data || []);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

    return (
        <>
            <div className="top-header">
                <h1>🩺 Atención Médica</h1>
                {view === 'attention' && <button className="btn btn-secondary" onClick={() => { setView('agenda'); setActiveAttention(null); }}>← Volver a Agenda</button>}
            </div>
            <div className="page-content">
                {error && <div className="alert alert-error">⚠️ {error} <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}
                {success && <div className="alert alert-success">✅ {success}</div>}

                {view === 'agenda' && (
                    <>
                        <h3 style={{ marginBottom: '16px' }}>📅 Citas del día — {new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                        <div className="card" style={{ marginBottom: '24px' }}>
                            {todayAppointments.length === 0 ? (
                                <div className="empty-state"><div className="icon">📅</div><p>No hay citas programadas para hoy</p></div>
                            ) : (
                                <div className="table-container">
                                    <table>
                                        <thead><tr><th>Hora</th><th>Paciente</th><th>HC</th><th>Motivo</th><th>Estado</th><th>Acción</th></tr></thead>
                                        <tbody>
                                            {todayAppointments.map(a => (
                                                <tr key={a.id}>
                                                    <td><strong>{new Date(a.dateTime).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</strong></td>
                                                    <td>{a.patient?.firstName} {a.patient?.lastName}</td>
                                                    <td><span className="badge badge-info">{a.patient?.medicalRecordNumber}</span></td>
                                                    <td>{a.reason || '—'}</td>
                                                    <td><span className={`badge ${a.status === 'attended' ? 'badge-success' : a.status === 'cancelled' ? 'badge-danger' : 'badge-info'}`}>{a.status === 'attended' ? 'Atendida' : a.status === 'cancelled' ? 'Cancelada' : 'Programada'}</span></td>
                                                    <td>
                                                        {!['attended', 'cancelled'].includes(a.status) && !a.medicalAttention && (
                                                            <button className="btn btn-primary btn-sm" onClick={() => startAttention(a)}>🩺 Atender</button>
                                                        )}
                                                        {a.medicalAttention && (
                                                            <button className="btn btn-secondary btn-sm" onClick={async () => { const att = await api.get(`/medical/attentions/${a.medicalAttention.id}`); setActiveAttention(att); setView('attention'); }}>
                                                                {a.medicalAttention.status === 'in_progress' ? '📝 Continuar' : '👁 Ver'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <h3 style={{ marginBottom: '16px' }}>📋 Atenciones recientes</h3>
                        <div className="card">
                            <div className="table-container">
                                <table>
                                    <thead><tr><th>Fecha</th><th>Paciente</th><th>Motivo</th><th>Diagnósticos</th><th>Estado</th></tr></thead>
                                    <tbody>
                                        {attentions.map(a => (
                                            <tr key={a.id} style={{ cursor: 'pointer' }} onClick={async () => { const att = await api.get(`/medical/attentions/${a.id}`); setActiveAttention(att); setView('attention'); }}>
                                                <td>{new Date(a.createdAt).toLocaleDateString('es-EC')}</td>
                                                <td>{a.patient?.firstName} {a.patient?.lastName}</td>
                                                <td>{a.chiefComplaint || '—'}</td>
                                                <td>{a.diagnoses?.map(d => d.description).join(', ') || '—'}</td>
                                                <td><span className={`badge ${a.status === 'closed' ? 'badge-success' : 'badge-info'}`}>{a.status === 'closed' ? 'Cerrada' : 'En curso'}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {view === 'attention' && activeAttention && (
                    <AttentionForm attention={activeAttention} onSave={saveAttention} onClose={closeAttention} />
                )}
            </div>
        </>
    );
}

function AttentionForm({ attention, onSave, onClose }) {
    const [form, setForm] = useState({
        chiefComplaint: attention.chiefComplaint || '',
        vitalSigns: attention.vitalSigns || '',
        anamnesis: attention.anamnesis || '',
        physicalExam: attention.physicalExam || '',
    });
    const [diagnoses, setDiagnoses] = useState(attention.diagnoses || []);
    const [prescriptions, setPrescriptions] = useState(attention.prescriptions || []);
    const [newNote, setNewNote] = useState('');
    const [saving, setSaving] = useState(false);
    const isClosed = attention.status === 'closed';

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({
                ...form,
                diagnoses: diagnoses.map(d => ({ code: d.code, description: d.description, type: d.type })),
                prescriptions: prescriptions.map(p => ({ medication: p.medication, dosage: p.dosage, frequency: p.frequency, duration: p.duration, instructions: p.instructions })),
                clinicalNotes: newNote ? [{ noteType: 'evolution', content: newNote }] : []
            });
            setNewNote('');
        } finally { setSaving(false); }
    };

    const addDiagnosis = () => setDiagnoses(p => [...p, { code: '', description: '', type: 'primary' }]);
    const addPrescription = () => setPrescriptions(p => [...p, { medication: '', dosage: '', frequency: '', duration: '', instructions: '' }]);

    return (
        <div style={{ display: 'grid', gap: '20px' }}>
            {/* Patient info bar */}
            <div className="card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <strong style={{ fontSize: '1.1rem' }}>👤 {attention.patient?.firstName} {attention.patient?.lastName}</strong>
                    <span className="badge badge-info" style={{ marginLeft: '8px' }}>{attention.patient?.medicalRecordNumber}</span>
                    {isClosed && <span className="badge badge-success" style={{ marginLeft: '8px' }}>Cerrada</span>}
                </div>
                {!isClosed && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Guardando...' : '💾 Guardar'}</button>
                        <button className="btn btn-accent" onClick={onClose} disabled={diagnoses.length === 0}>✅ Cerrar Atención</button>
                    </div>
                )}
            </div>

            {/* Main form */}
            <div className="card">
                <div className="card-header"><h3>📝 Consulta Médica</h3></div>
                <div className="card-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Motivo de consulta</label>
                            <textarea className="form-control" value={form.chiefComplaint} onChange={e => setForm(p => ({ ...p, chiefComplaint: e.target.value }))} disabled={isClosed} />
                        </div>
                        <div className="form-group">
                            <label>Signos vitales</label>
                            <textarea className="form-control" value={form.vitalSigns} onChange={e => setForm(p => ({ ...p, vitalSigns: e.target.value }))} disabled={isClosed} placeholder="TA: 120/80, FC: 72, FR: 18, Temp: 36.5°C" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Anamnesis / Hallazgos</label>
                        <textarea className="form-control" value={form.anamnesis} onChange={e => setForm(p => ({ ...p, anamnesis: e.target.value }))} disabled={isClosed} style={{ minHeight: '100px' }} />
                    </div>
                    <div className="form-group">
                        <label>Examen físico</label>
                        <textarea className="form-control" value={form.physicalExam} onChange={e => setForm(p => ({ ...p, physicalExam: e.target.value }))} disabled={isClosed} />
                    </div>
                </div>
            </div>

            {/* Diagnoses */}
            <div className="card">
                <div className="card-header">
                    <h3>🔍 Diagnósticos</h3>
                    {!isClosed && <button className="btn btn-secondary btn-sm" onClick={addDiagnosis}>+ Agregar</button>}
                </div>
                <div className="card-body">
                    {diagnoses.length === 0 ? <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No hay diagnósticos registrados</p> : (
                        diagnoses.map((d, i) => (
                            <div key={i} className="form-row" style={{ marginBottom: '12px', alignItems: 'end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Código CIE-10</label>
                                    <input className="form-control" value={d.code || ''} onChange={e => { const n = [...diagnoses]; n[i] = { ...n[i], code: e.target.value }; setDiagnoses(n); }} disabled={isClosed} placeholder="Ej: J06.9" />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Descripción *</label>
                                    <input className="form-control" value={d.description} onChange={e => { const n = [...diagnoses]; n[i] = { ...n[i], description: e.target.value }; setDiagnoses(n); }} disabled={isClosed} />
                                </div>
                                {!isClosed && <button className="btn btn-danger btn-sm" onClick={() => setDiagnoses(p => p.filter((_, j) => j !== i))} style={{ marginBottom: '0' }}>🗑</button>}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Prescriptions */}
            <div className="card">
                <div className="card-header">
                    <h3>💊 Prescripciones</h3>
                    {!isClosed && <button className="btn btn-secondary btn-sm" onClick={addPrescription}>+ Agregar</button>}
                </div>
                <div className="card-body">
                    {prescriptions.length === 0 ? <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No hay prescripciones</p> : (
                        prescriptions.map((p, i) => (
                            <div key={i} style={{ padding: '12px', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', marginBottom: '12px' }}>
                                <div className="form-row-3">
                                    <div className="form-group"><label>Medicamento *</label><input className="form-control" value={p.medication} onChange={e => { const n = [...prescriptions]; n[i] = { ...n[i], medication: e.target.value }; setPrescriptions(n); }} disabled={isClosed} /></div>
                                    <div className="form-group"><label>Dosis</label><input className="form-control" value={p.dosage || ''} onChange={e => { const n = [...prescriptions]; n[i] = { ...n[i], dosage: e.target.value }; setPrescriptions(n); }} disabled={isClosed} placeholder="500mg" /></div>
                                    <div className="form-group"><label>Frecuencia</label><input className="form-control" value={p.frequency || ''} onChange={e => { const n = [...prescriptions]; n[i] = { ...n[i], frequency: e.target.value }; setPrescriptions(n); }} disabled={isClosed} placeholder="Cada 8 horas" /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Duración</label><input className="form-control" value={p.duration || ''} onChange={e => { const n = [...prescriptions]; n[i] = { ...n[i], duration: e.target.value }; setPrescriptions(n); }} disabled={isClosed} placeholder="7 días" /></div>
                                    <div className="form-group"><label>Instrucciones</label><input className="form-control" value={p.instructions || ''} onChange={e => { const n = [...prescriptions]; n[i] = { ...n[i], instructions: e.target.value }; setPrescriptions(n); }} disabled={isClosed} /></div>
                                </div>
                                {!isClosed && <button className="btn btn-danger btn-sm" onClick={() => setPrescriptions(pp => pp.filter((_, j) => j !== i))}>🗑 Eliminar</button>}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Notes */}
            <div className="card">
                <div className="card-header"><h3>📝 Notas de Evolución</h3></div>
                <div className="card-body">
                    {attention.clinicalNotes?.map(n => (
                        <div key={n.id} style={{ padding: '12px', background: n.noteType === 'amendment' ? 'rgba(245,158,11,0.05)' : 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: '8px' }}>
                            <small style={{ color: 'var(--gray-400)' }}>{new Date(n.createdAt).toLocaleString('es-EC')}{n.noteType === 'amendment' ? ' [ENMIENDA]' : ''}</small>
                            <p style={{ fontSize: '0.875rem', marginTop: '4px' }}>{n.content}</p>
                        </div>
                    ))}
                    {!isClosed && (
                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <label>Nueva nota de evolución</label>
                            <textarea className="form-control" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Registro de evolución del paciente..." />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
