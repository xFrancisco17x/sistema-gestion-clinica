import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Admin() {
    const [tab, setTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([
            api.get('/admin/users').catch(() => []),
            api.get('/admin/roles').catch(() => []),
            api.get('/admin/specialties').catch(() => []),
        ]).then(([u, r, s]) => { setUsers(u); setRoles(r); setSpecialties(s); })
            .finally(() => setLoading(false));
    }, []);

    const handleToggleActive = async (user) => {
        try {
            await api.put(`/admin/users/${user.id}`, { isActive: !user.isActive });
            setSuccess(`Usuario ${!user.isActive ? 'activado' : 'desactivado'}`);
            const u = await api.get('/admin/users');
            setUsers(u);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    const handleResetPassword = async (userId) => {
        const newPwd = prompt('Nueva contraseña (mín. 8 caracteres):');
        if (!newPwd) return;
        try {
            await api.put(`/admin/users/${userId}/reset-password`, { newPassword: newPwd });
            setSuccess('Contraseña reseteada');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) { setError(err.message); }
    };

    return (
        <>
            <div className="top-header">
                <h1>⚙️ Administración</h1>
                {tab === 'users' && <button className="btn btn-primary" onClick={() => { setEditUser(null); setShowUserModal(true); }}>➕ Nuevo Usuario</button>}
            </div>
            <div className="page-content">
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">✅ {success}</div>}

                <div className="tabs">
                    <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>👤 Usuarios</button>
                    <button className={`tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>🔐 Roles y Permisos</button>
                    <button className={`tab ${tab === 'specialties' ? 'active' : ''}`} onClick={() => setTab('specialties')}>🏥 Especialidades</button>
                </div>

                {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : tab === 'users' ? (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Usuario</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td><strong>{u.username}</strong></td>
                                            <td>{u.firstName} {u.lastName}</td>
                                            <td>{u.email}</td>
                                            <td><span className="badge badge-info">{u.role?.name}</span></td>
                                            <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>{u.isActive ? 'Activo' : 'Inactivo'}</span></td>
                                            <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleString('es-EC') : 'Nunca'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleToggleActive(u)}>{u.isActive ? '🔒' : '🔓'}</button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleResetPassword(u.id)}>🔑</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : tab === 'roles' ? (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {roles.map(r => (
                            <div key={r.id} className="card">
                                <div className="card-header">
                                    <h3>{r.name} <span className="badge badge-gray">{r._count?.users || 0} usuarios</span></h3>
                                </div>
                                <div className="card-body">
                                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '12px' }}>{r.description}</p>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {r.permissions?.map(rp => (
                                            <span key={rp.id} className="badge badge-info">{rp.permission.module}: {rp.permission.action}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Especialidad</th><th>Descripción</th><th>Estado</th></tr></thead>
                                <tbody>
                                    {specialties.map(s => (
                                        <tr key={s.id}>
                                            <td><strong>{s.name}</strong></td>
                                            <td>{s.description || '—'}</td>
                                            <td><span className={`badge ${s.isActive ? 'badge-success' : 'badge-danger'}`}>{s.isActive ? 'Activa' : 'Inactiva'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {showUserModal && <CreateUserModal roles={roles} specialties={specialties} onClose={() => setShowUserModal(false)} onCreated={async () => {
                setShowUserModal(false);
                setSuccess('Usuario creado');
                const u = await api.get('/admin/users');
                setUsers(u);
                setTimeout(() => setSuccess(''), 3000);
            }} />}
        </>
    );
}

function CreateUserModal({ roles, specialties, onClose, onCreated }) {
    const [form, setForm] = useState({ username: '', email: '', password: '', firstName: '', lastName: '', roleId: '', specialtyId: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/admin/users', form);
            onCreated();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const isMedico = roles.find(r => r.id === parseInt(form.roleId))?.name === 'Médico';
    const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h2>👤 Nuevo Usuario</h2><button className="modal-close" onClick={onClose}>✕</button></div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="alert alert-error">{error}</div>}
                        <div className="form-row">
                            <div className="form-group"><label>Usuario *</label><input className="form-control" required value={form.username} onChange={e => update('username', e.target.value)} /></div>
                            <div className="form-group"><label>Email *</label><input type="email" className="form-control" required value={form.email} onChange={e => update('email', e.target.value)} /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>Nombres *</label><input className="form-control" required value={form.firstName} onChange={e => update('firstName', e.target.value)} /></div>
                            <div className="form-group"><label>Apellidos *</label><input className="form-control" required value={form.lastName} onChange={e => update('lastName', e.target.value)} /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>Contraseña *</label><input type="password" className="form-control" required minLength={8} value={form.password} onChange={e => update('password', e.target.value)} /></div>
                            <div className="form-group"><label>Rol *</label>
                                <select className="form-control" required value={form.roleId} onChange={e => update('roleId', e.target.value)}>
                                    <option value="">Seleccione</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {isMedico && (
                            <div className="form-group"><label>Especialidad *</label>
                                <select className="form-control" required value={form.specialtyId} onChange={e => update('specialtyId', e.target.value)}>
                                    <option value="">Seleccione</option>{specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear Usuario'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
