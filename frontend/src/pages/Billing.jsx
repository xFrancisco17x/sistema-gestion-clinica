import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function Billing() {
    const [invoices, setInvoices] = useState([]);
    const [tab, setTab] = useState('invoices'); // invoices, receivable, services
    const [loading, setLoading] = useState(true);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(null);
    const [accountsReceivable, setAccountsReceivable] = useState([]);
    const [services, setServices] = useState([]);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const { hasPermission } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [inv, ar, srv] = await Promise.all([
                api.get('/billing/invoices?limit=50'),
                api.get('/billing/accounts-receivable').catch(() => []),
                api.get('/billing/services')
            ]);
            setInvoices(inv.data || []);
            setAccountsReceivable(ar || []);
            setServices(srv || []);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleIssue = async (id) => {
        try { await api.put(`/billing/invoices/${id}/issue`); setSuccess('Factura emitida'); fetchData(); setTimeout(() => setSuccess(''), 3000); }
        catch (err) { setError(err.message); }
    };

    const handleCancel = async (id) => {
        const reason = prompt('Motivo de anulación:');
        if (!reason) return;
        try { await api.put(`/billing/invoices/${id}/cancel`, { reason }); setSuccess('Factura anulada'); fetchData(); setTimeout(() => setSuccess(''), 3000); }
        catch (err) { setError(err.message); }
    };

    const statusBadge = (s) => {
        const m = { draft: ['badge-gray', 'Borrador'], issued: ['badge-info', 'Emitida'], cancelled: ['badge-danger', 'Anulada'], pending: ['badge-warning', 'Pendiente'], partial: ['badge-warning', 'Parcial'], paid: ['badge-success', 'Pagado'] };
        const [cls, l] = m[s] || ['badge-gray', s];
        return <span className={`badge ${cls}`}>{l}</span>;
    };

    return (
        <>
            <div className="top-header">
                <h1>💰 Facturación</h1>
                {hasPermission('billing', 'create') && <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>➕ Nueva Factura</button>}
            </div>
            <div className="page-content">
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                {success && <div className="alert alert-success">✅ {success}</div>}

                <div className="tabs">
                    <button className={`tab ${tab === 'invoices' ? 'active' : ''}`} onClick={() => setTab('invoices')}>📄 Facturas</button>
                    <button className={`tab ${tab === 'receivable' ? 'active' : ''}`} onClick={() => setTab('receivable')}>📋 Cuentas por Cobrar ({accountsReceivable.length})</button>
                    <button className={`tab ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>🏷️ Catálogo de Servicios</button>
                </div>

                {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : tab === 'invoices' ? (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Factura</th><th>Paciente</th><th>Fecha</th><th>Subtotal</th><th>Impuesto</th><th>Total</th><th>Estado</th><th>Pago</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {invoices.map(inv => {
                                        const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
                                        return (
                                            <tr key={inv.id}>
                                                <td><strong>{inv.invoiceNumber}</strong></td>
                                                <td>{inv.patient?.firstName} {inv.patient?.lastName}</td>
                                                <td>{new Date(inv.createdAt).toLocaleDateString('es-EC')}</td>
                                                <td>${inv.subtotal?.toFixed(2)}</td>
                                                <td>${inv.tax?.toFixed(2)}</td>
                                                <td><strong>${inv.total?.toFixed(2)}</strong></td>
                                                <td>{statusBadge(inv.status)}</td>
                                                <td>{statusBadge(inv.paymentStatus)}<br /><small style={{ color: 'var(--gray-400)' }}>${paid.toFixed(2)} / ${inv.total?.toFixed(2)}</small></td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {inv.status === 'draft' && <button className="btn btn-primary btn-sm" onClick={() => handleIssue(inv.id)}>📤 Emitir</button>}
                                                        {inv.status !== 'cancelled' && inv.paymentStatus !== 'paid' && <button className="btn btn-accent btn-sm" onClick={() => setShowPaymentModal(inv)}>💵 Pagar</button>}
                                                        {inv.status !== 'cancelled' && <button className="btn btn-danger btn-sm" onClick={() => handleCancel(inv.id)}>❌</button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : tab === 'receivable' ? (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Factura</th><th>Paciente</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th>Acción</th></tr></thead>
                                <tbody>
                                    {accountsReceivable.map(inv => (
                                        <tr key={inv.id}>
                                            <td><strong>{inv.invoiceNumber}</strong></td>
                                            <td>{inv.patient?.firstName} {inv.patient?.lastName}</td>
                                            <td>${inv.total?.toFixed(2)}</td>
                                            <td>${inv.totalPaid?.toFixed(2)}</td>
                                            <td><strong style={{ color: 'var(--danger)' }}>${inv.balance?.toFixed(2)}</strong></td>
                                            <td>{statusBadge(inv.paymentStatus)}</td>
                                            <td><button className="btn btn-accent btn-sm" onClick={() => setShowPaymentModal(inv)}>💵 Cobrar</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Código</th><th>Servicio</th><th>Categoría</th><th>Precio</th></tr></thead>
                                <tbody>
                                    {services.map(s => (
                                        <tr key={s.id}>
                                            <td><strong>{s.code}</strong></td>
                                            <td>{s.name}</td>
                                            <td><span className="badge badge-gray">{s.category}</span></td>
                                            <td><strong>${s.price.toFixed(2)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {showInvoiceModal && <InvoiceModal services={services} onClose={() => setShowInvoiceModal(false)} onCreated={() => { setShowInvoiceModal(false); setSuccess('Factura creada'); fetchData(); setTimeout(() => setSuccess(''), 3000); }} />}
            {showPaymentModal && <PaymentModal invoice={showPaymentModal} onClose={() => setShowPaymentModal(null)} onPaid={() => { setShowPaymentModal(null); setSuccess('Pago registrado'); fetchData(); setTimeout(() => setSuccess(''), 3000); }} />}
        </>
    );
}

function InvoiceModal({ services, onClose, onCreated }) {
    const [patientSearch, setPatientSearch] = useState('');
    const [patientId, setPatientId] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [items, setItems] = useState([{ serviceId: '', description: '', quantity: 1, unitPrice: 0 }]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const searchPatients = async (q) => {
        if (q.length < 2) return;
        const data = await api.get(`/patients?search=${q}&limit=5`);
        setSearchResults(data.data);
    };

    const addItem = () => setItems(p => [...p, { serviceId: '', description: '', quantity: 1, unitPrice: 0 }]);

    const selectService = (idx, serviceId) => {
        const svc = services.find(s => s.id === parseInt(serviceId));
        const n = [...items];
        n[idx] = { ...n[idx], serviceId: parseInt(serviceId), description: svc?.name || '', unitPrice: svc?.price || 0 };
        setItems(n);
    };

    const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await api.post('/billing/invoices', { patientId, items, taxRate: 12 });
            onCreated();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h2>📄 Nueva Factura</h2><button className="modal-close" onClick={onClose}>✕</button></div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="alert alert-error">{error}</div>}
                        <div className="form-group">
                            <label>Paciente *</label>
                            <input className="form-control" placeholder="Buscar paciente..." value={patientSearch}
                                onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value); }} />
                            {searchResults.length > 0 && (
                                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', marginTop: '4px' }}>
                                    {searchResults.map(p => (
                                        <div key={p.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.875rem' }}
                                            onClick={() => { setPatientId(p.id); setPatientSearch(`${p.firstName} ${p.lastName}`); setSearchResults([]); }}
                                            onMouseOver={e => e.currentTarget.style.background = 'var(--gray-50)'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                                            {p.firstName} {p.lastName} — {p.idNumber}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <h4 style={{ marginBottom: '12px' }}>Ítems</h4>
                        {items.map((item, i) => (
                            <div key={i} className="form-row" style={{ marginBottom: '8px', gridTemplateColumns: '1fr 2fr 80px 100px 40px', alignItems: 'end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Servicio</label>
                                    <select className="form-control" value={item.serviceId} onChange={e => selectService(i, e.target.value)}>
                                        <option value="">— Seleccionar —</option>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Descripción</label>
                                    <input className="form-control" value={item.description} onChange={e => { const n = [...items]; n[i].description = e.target.value; setItems(n); }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Cant.</label>
                                    <input type="number" className="form-control" value={item.quantity} min="1" onChange={e => { const n = [...items]; n[i].quantity = parseInt(e.target.value); setItems(n); }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Precio</label>
                                    <input type="number" step="0.01" className="form-control" value={item.unitPrice} onChange={e => { const n = [...items]; n[i].unitPrice = parseFloat(e.target.value); setItems(n); }} />
                                </div>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ marginBottom: '0' }}>✕</button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Agregar ítem</button>
                        <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '0.9375rem' }}>
                            <p>Subtotal: <strong>${subtotal.toFixed(2)}</strong></p>
                            <p>IVA (12%): <strong>${(subtotal * 0.12).toFixed(2)}</strong></p>
                            <p style={{ fontSize: '1.125rem' }}>Total: <strong>${(subtotal * 1.12).toFixed(2)}</strong></p>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !patientId || items.length === 0}>{saving ? 'Creando...' : 'Crear Factura'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PaymentModal({ invoice, onClose, onPaid }) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [reference, setReference] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const paid = invoice.payments?.reduce((s, p) => s + p.amount, 0) || invoice.totalPaid || 0;
    const remaining = invoice.total - paid;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/billing/invoices/${invoice.id}/payments`, { amount: parseFloat(amount), method, reference });
            onPaid();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header"><h2>💵 Registrar Pago</h2><button className="modal-close" onClick={onClose}>✕</button></div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="alert alert-error">{error}</div>}
                        <p style={{ fontSize: '0.875rem', marginBottom: '16px' }}>Factura: <strong>{invoice.invoiceNumber}</strong> — Total: <strong>${invoice.total?.toFixed(2)}</strong> — Saldo: <strong style={{ color: 'var(--danger)' }}>${remaining.toFixed(2)}</strong></p>
                        <div className="form-group">
                            <label>Monto a pagar *</label>
                            <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} max={remaining} placeholder={`Máximo: $${remaining.toFixed(2)}`} required />
                        </div>
                        <div className="form-group">
                            <label>Método de pago</label>
                            <select className="form-control" value={method} onChange={e => setMethod(e.target.value)}>
                                <option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Referencia / Comprobante</label>
                            <input className="form-control" value={reference} onChange={e => setReference(e.target.value)} placeholder="Nro. de transacción" />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !amount}>{saving ? 'Procesando...' : 'Registrar Pago'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
