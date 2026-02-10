import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import MedicalAttention from './pages/MedicalAttention';
import Billing from './pages/Billing';
import Admin from './pages/Admin';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';

function ProtectedRoute({ children, requiredPermission }) {
    const { user, loading, hasPermission } = useAuth();

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
    if (!user) return <Navigate to="/login" />;
    if (requiredPermission && !hasPermission(requiredPermission.module, requiredPermission.action)) {
        return <div className="page-content"><div className="alert alert-error">⛔ No tiene permisos para acceder a esta sección</div></div>;
    }
    return children;
}

export default function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="loading-spinner" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;
    }

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="patients" element={<ProtectedRoute requiredPermission={{ module: 'patients', action: 'read' }}><Patients /></ProtectedRoute>} />
                <Route path="patients/:id" element={<ProtectedRoute requiredPermission={{ module: 'patients', action: 'read' }}><PatientDetail /></ProtectedRoute>} />
                <Route path="appointments" element={<ProtectedRoute requiredPermission={{ module: 'appointments', action: 'read' }}><Appointments /></ProtectedRoute>} />
                <Route path="medical" element={<ProtectedRoute requiredPermission={{ module: 'medical', action: 'read' }}><MedicalAttention /></ProtectedRoute>} />
                <Route path="billing" element={<ProtectedRoute requiredPermission={{ module: 'billing', action: 'read' }}><Billing /></ProtectedRoute>} />
                <Route path="admin" element={<ProtectedRoute requiredPermission={{ module: 'admin', action: 'read' }}><Admin /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute requiredPermission={{ module: 'reports', action: 'read' }}><Reports /></ProtectedRoute>} />
                <Route path="audit" element={<ProtectedRoute requiredPermission={{ module: 'audit', action: 'read' }}><AuditLog /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}
