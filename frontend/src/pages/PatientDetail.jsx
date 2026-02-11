import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function PatientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/patients/${id}`)
            .then(setPatient)
            .catch(() => navigate('/patients'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
    if (!patient) return null;

    const dob = patient.dateOfBirth.split('T')[0] + 'T12:00:00';
    const age = Math.floor((Date.now() - new Date(dob)) / 31557600000);
    const tabs = [
        { key: 'info', label: '📋 Datos Personales' },
        { key: 'appointments', label: `📅 Citas (${patient.appointments?.length || 0})` },
        { key: 'medical', label: `🩺 Atenciones (${patient.medicalAttentions?.length || 0})` },
        { key: 'billing', label: `💰 Facturas (${patient.invoices?.length || 0})` },
    ];

    const statusBadge = (status) => {
        const map = {
            scheduled: ['badge-info', 'Programada'], confirmed: ['badge-info', 'Confirmada'],
            attended: ['badge-success', 'Atendida'], cancelled: ['badge-danger', 'Cancelada'],
            rescheduled: ['badge-warning', 'Reprogramada'], no_show: ['badge-gray', 'No asistió'],
            draft: ['badge-gray', 'Borrador'], issued: ['badge-info', 'Emitida'],
            pending: ['badge-warning', 'Pendiente'], partial: ['badge-warning', 'Parcial'],
            paid: ['badge-success', 'Pagado'], in_progress: ['badge-info', 'En curso'],
            closed: ['badge-success', 'Cerrada'],
        };
        const [cls, label] = map[status] || ['badge-gray', status];
        return <span className={`badge ${cls}`}>{label}</span>;
    };

    return (
        <>
            <div className="top-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/patients')}>← Volver</button>
                    <h1>Paciente: {patient.firstName} {patient.lastName}</h1>
                    <span className="badge badge-info">{patient.medicalRecordNumber}</span>
                </div>
            </div>
            <div className="page-content">
                <div className="tabs">
                    {tabs.map(t => (
                        <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'info' && (
                    <div className="card">
                        <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                                <InfoField label="Nombre completo" value={`${patient.firstName} ${patient.lastName}`} />
                                <InfoField label="Identificación" value={`${patient.idType?.toUpperCase()}: ${patient.idNumber}`} />
                                <InfoField label="Fecha de nacimiento" value={`${new Date(dob).toLocaleDateString('es-EC', { timeZone: 'UTC' })} (${age} años)`} />
                                <InfoField label="Sexo" value={patient.gender === 'M' ? 'Masculino' : 'Femenino'} />
                                <InfoField label="Teléfono" value={patient.phone} />
                                <InfoField label="Email" value={patient.email} />
                                <InfoField label="Dirección" value={patient.address} />
                                <InfoField label="Tipo de sangre" value={patient.bloodType} />
                                <InfoField label="Alergias" value={patient.allergies} highlight />
                                <InfoField label="Contacto emergencia" value={patient.emergencyContactName ? `${patient.emergencyContactName} (${patient.emergencyContactPhone || ''})` : null} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'appointments' && (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Fecha/Hora</th><th>Médico</th><th>Especialidad</th><th>Motivo</th><th>Estado</th></tr>
                                </thead>
                                <tbody>
                                    {patient.appointments?.length === 0 ? (
                                        <tr><td colSpan="5"><div className="empty-state"><p>Sin citas registradas</p></div></td></tr>
                                    ) : patient.appointments?.map(a => (
                                        <tr key={a.id}>
                                            <td>{new Date(a.dateTime).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                            <td>Dr(a). {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}</td>
                                            <td>{a.doctor?.specialty?.name}</td>
                                            <td>{a.reason || '—'}</td>
                                            <td>{statusBadge(a.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'medical' && (
                    <div className="card">
                        {patient.medicalAttentions?.length === 0 ? (
                            <div className="empty-state"><div className="icon">🩺</div><p>Sin atenciones médicas</p></div>
                        ) : patient.medicalAttentions?.map(att => (
                            <div key={att.id} style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-100)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <strong>{new Date(att.createdAt).toLocaleDateString('es-EC')} — Dr(a). {att.doctor?.user?.firstName} {att.doctor?.user?.lastName}</strong>
                                    {statusBadge(att.status)}
                                </div>
                                {att.chiefComplaint && <p style={{ fontSize: '0.875rem' }}><strong>Motivo:</strong> {att.chiefComplaint}</p>}
                                {att.diagnoses?.map(d => <p key={d.id} style={{ fontSize: '0.875rem' }}>🔹 <strong>Diagnóstico:</strong> {d.description} {d.code ? `(${d.code})` : ''}</p>)}
                                {att.prescriptions?.map(p => <p key={p.id} style={{ fontSize: '0.875rem' }}>💊 {p.medication} — {p.dosage} {p.frequency} {p.duration}</p>)}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Factura</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Pago</th></tr>
                                </thead>
                                <tbody>
                                    {patient.invoices?.length === 0 ? (
                                        <tr><td colSpan="5"><div className="empty-state"><p>Sin facturas</p></div></td></tr>
                                    ) : patient.invoices?.map(inv => (
                                        <tr key={inv.id}>
                                            <td><strong>{inv.invoiceNumber}</strong></td>
                                            <td>{new Date(inv.createdAt).toLocaleDateString('es-EC')}</td>
                                            <td><strong>${inv.total?.toFixed(2)}</strong></td>
                                            <td>{statusBadge(inv.status)}</td>
                                            <td>{statusBadge(inv.paymentStatus)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function InfoField({ label, value, highlight }) {
    return (
        <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: '4px' }}>{label}</div>
            <div style={{
                fontSize: '0.9375rem', color: value ? (highlight ? 'var(--danger)' : 'var(--gray-800)') : 'var(--gray-400)',
                fontWeight: highlight && value ? 600 : 400
            }}>
                {value || '—'}
            </div>
        </div>
    );
}
