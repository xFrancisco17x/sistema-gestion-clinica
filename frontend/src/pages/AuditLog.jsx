import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AuditLog() {
    const [events, setEvents] = useState([]);
    const [modules, setModules] = useState([]);
    const [filterModule, setFilterModule] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

    const fetchEvents = async (page = 1) => {
        setLoading(true);
        try {
            let url = `/audit?page=${page}&limit=30`;
            if (filterModule) url += `&module=${filterModule}`;
            if (filterAction) url += `&action=${filterAction}`;
            const data = await api.get(url);
            setEvents(data.data);
            setPagination(data.pagination);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        api.get('/audit/modules').then(setModules).catch(() => { });
        fetchEvents();
    }, []);

    useEffect(() => { fetchEvents(1); }, [filterModule, filterAction]);

    const actionColor = (a) => {
        if (a === 'create') return 'badge-success';
        if (a === 'delete') return 'badge-danger';
        if (a === 'login') return 'badge-info';
        if (a === 'update') return 'badge-warning';
        return 'badge-gray';
    };

    return (
        <>
            <div className="top-header"><h1>📋 Registro de Auditoría</h1></div>
            <div className="page-content">
                <div className="toolbar">
                    <select className="form-control" value={filterModule} onChange={e => setFilterModule(e.target.value)} style={{ width: '180px' }}>
                        <option value="">Todos los módulos</option>
                        {modules.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className="form-control" value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ width: '160px' }}>
                        <option value="">Todas las acciones</option>
                        {['create', 'update', 'delete', 'login', 'logout', 'read'].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="card">
                    {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : (
                        <>
                            <div className="table-container">
                                <table>
                                    <thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Módulo</th><th>Acción</th><th>Entidad</th><th>Detalles</th><th>IP</th></tr></thead>
                                    <tbody>
                                        {events.map(e => (
                                            <tr key={e.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString('es-EC')}</td>
                                                <td>{e.user?.username || '—'}</td>
                                                <td><span className="badge badge-gray">{e.module}</span></td>
                                                <td><span className={`badge ${actionColor(e.action)}`}>{e.action}</span></td>
                                                <td>{e.entityType}{e.entityId ? ` #${e.entityId}` : ''}</td>
                                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.details || '—'}</td>
                                                <td style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{e.ipAddress}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="pagination">
                                <span>{pagination.total} eventos</span>
                                <div className="pagination-btns">
                                    <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => fetchEvents(pagination.page - 1)}>←</button>
                                    <span style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>{pagination.page} / {pagination.pages}</span>
                                    <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchEvents(pagination.page + 1)}>→</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
