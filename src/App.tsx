import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Activities } from './pages/Activities';
import { Conditional } from './pages/Conditional';
import { Scheduled } from './pages/Scheduled';
import { Submissions } from './pages/Submissions';
import { Feedbacks } from './pages/Feedbacks';
import { Questionnaires } from './pages/Questionnaires';
import { Users } from './pages/Users';
import { Stats } from './pages/Stats';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/conditional" element={<Conditional />} />
          <Route path="/scheduled" element={<Scheduled />} />
          <Route path="/submissions" element={<Submissions />} />
          <Route path="/feedbacks" element={<Feedbacks />} />
          <Route path="/questionnaires" element={<Questionnaires />} />
          <Route
            path="/users"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="/stats" element={<Stats />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
  );
}
