import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function Patients() {
    const [patients, setPatients] = useState([]);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editPatient, setEditPatient] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { hasPermission } = useAuth();
    const navigate = useNavigate();

    const fetchPatients = async (page = 1) => {
        setLoading(true);
        try {
            const data = await api.get(`/patients?page=${page}&limit=15&search=${search}`);
            setPatients(data.data);
            setPagination(data.pagination);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPatients(); }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchPatients(1);
    };

    const handleSave = async (formData) => {
        try {
            if (editPatient) {
                await api.put(`/patients/${editPatient.id}`, formData);
                setSuccess('Paciente actualizado correctamente');
            } else {
                await api.post('/patients', formData);
                setSuccess('Paciente registrado correctamente');
            }
            setShowModal(false);
            setEditPatient(null);
            fetchPatients();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            throw err;
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este paciente?')) return;
        try {
            await api.delete(`/patients/${id}`);
            setSuccess('Paciente eliminado');
            fetchPatients();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    return (
        <>
            <div className="top-header">
                <h1>👥 Pacientes</h1>
                {hasPermission('patients', 'create') && (
                    <button className="btn btn-primary" onClick={() => { setEditPatient(null); setShowModal(true); }}>
                        ➕ Nuevo Paciente
                    </button>
                )}
            </div>
            <div className="page-content">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                {success && <div className="alert alert-success">✅ {success}</div>}

                <div className="toolbar">
                    <form className="search-box" onSubmit={handleSearch}>
                        <input
                            type="text"
                            placeholder="Buscar por cédula, nombre, teléfono, historia clínica..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </form>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setTimeout(() => fetchPatients(1), 0); }}>
                        Limpiar
                    </button>
                </div>

                <div className="card">
                    {loading ? (
                        <div className="loading-spinner"><div className="spinner"></div></div>
                    ) : patients.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">👥</div>
                            <p>No se encontraron pacientes</p>
                        </div>
                    ) : (
                        <>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Historia Clínica</th>
                                            <th>Cédula/ID</th>
                                            <th>Nombre Completo</th>
                                            <th>Teléfono</th>
                                            <th>Email</th>
                                            <th>Edad</th>
                                            <th>Sexo</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patients.map(p => (
                                            <tr key={p.id}>
                                                <td><strong style={{ color: 'var(--primary-600)' }}>{p.medicalRecordNumber}</strong></td>
                                                <td>{p.idNumber}</td>
                                                <td>
                                                    <span style={{ cursor: 'pointer', color: 'var(--accent-600)', fontWeight: 500 }}
                                                        onClick={() => navigate(`/patients/${p.id}`)}>
                                                        {p.firstName} {p.lastName}
                                                    </span>
                                                </td>
                                                <td>{p.phone || '—'}</td>
                                                <td>{p.email || '—'}</td>
                                                <td>{p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth.split('T')[0] + 'T12:00:00')) / 31557600000) : '—'}</td>
                                                <td>{p.gender === 'M' ? '♂ Masc.' : '♀ Fem.'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/patients/${p.id}`)}>👁 Ver</button>
                                                        {hasPermission('patients', 'update') && (
                                                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditPatient(p); setShowModal(true); }}>✏️</button>
                                                        )}
                                                        {hasPermission('patients', 'delete') && (
                                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>🗑</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="pagination">
                                <span>Mostrando {patients.length} de {pagination.total} pacientes</span>
                                <div className="pagination-btns">
                                    <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => fetchPatients(pagination.page - 1)}>← Anterior</button>
                                    <span style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>Página {pagination.page} de {pagination.pages}</span>
                                    <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchPatients(pagination.page + 1)}>Siguiente →</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showModal && (
                <PatientModal
                    patient={editPatient}
                    onClose={() => { setShowModal(false); setEditPatient(null); }}
                    onSave={handleSave}
                />
            )}
        </>
    );
}

function PatientModal({ patient, onClose, onSave }) {
    const [form, setForm] = useState({
        idType: patient?.idType || 'cedula',
        idNumber: patient?.idNumber || '',
        firstName: patient?.firstName || '',
        lastName: patient?.lastName || '',
        dateOfBirth: patient?.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
        gender: patient?.gender || 'M',
        phone: patient?.phone || '',
        email: patient?.email || '',
        address: patient?.address || '',
        emergencyContactName: patient?.emergencyContactName || '',
        emergencyContactPhone: patient?.emergencyContactPhone || '',
        bloodType: patient?.bloodType || '',
        allergies: patient?.allergies || '',
        notes: patient?.notes || ''
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try { await onSave(form); }
        catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{patient ? '✏️ Editar Paciente' : '👤 Nuevo Paciente'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="alert alert-error">⚠️ {error}</div>}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Tipo de identificación</label>
                                <select className="form-control" value={form.idType} onChange={e => update('idType', e.target.value)}>
                                    <option value="cedula">Cédula</option>
                                    <option value="pasaporte">Pasaporte</option>
                                    <option value="ruc">RUC</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Número de identificación *</label>
                                <input className="form-control" required value={form.idNumber} onChange={e => update('idNumber', e.target.value)} placeholder="0000000000" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Nombres *</label>
                                <input className="form-control" required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Apellidos *</label>
                                <input className="form-control" required value={form.lastName} onChange={e => update('lastName', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-row-3">
                            <div className="form-group">
                                <label>Fecha de nacimiento *</label>
                                <input type="date" className="form-control" required value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Sexo *</label>
                                <select className="form-control" value={form.gender} onChange={e => update('gender', e.target.value)}>
                                    <option value="M">Masculino</option>
                                    <option value="F">Femenino</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Tipo de sangre</label>
                                <select className="form-control" value={form.bloodType} onChange={e => update('bloodType', e.target.value)}>
                                    <option value="">— Seleccione —</option>
                                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Teléfono</label>
                                <input className="form-control" value={form.phone} onChange={e => update('phone', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" className="form-control" value={form.email} onChange={e => update('email', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Dirección</label>
                            <input className="form-control" value={form.address} onChange={e => update('address', e.target.value)} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Contacto de emergencia</label>
                                <input className="form-control" value={form.emergencyContactName} onChange={e => update('emergencyContactName', e.target.value)} placeholder="Nombre del contacto" />
                            </div>
                            <div className="form-group">
                                <label>Teléfono de emergencia</label>
                                <input className="form-control" value={form.emergencyContactPhone} onChange={e => update('emergencyContactPhone', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Alergias</label>
                            <textarea className="form-control" value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="Describa alergias conocidas..." />
                        </div>
                        <div className="form-group">
                            <label>Notas</label>
                            <textarea className="form-control" value={form.notes} onChange={e => update('notes', e.target.value)} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : (patient ? 'Actualizar' : 'Registrar Paciente')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
