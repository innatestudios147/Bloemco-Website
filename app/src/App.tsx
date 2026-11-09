import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BlogList } from './pages/BlogList';
import { BlogDetail } from './pages/BlogDetail';
import { Login } from './pages/Login';
import { StaffList } from './pages/StaffList';
import { StaffEditor } from './pages/StaffEditor';
import { StaffUsers } from './pages/StaffUsers';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Header />
        <Routes>
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/staff" element={<ProtectedRoute><StaffList /></ProtectedRoute>} />
          <Route path="/staff/new" element={<ProtectedRoute><StaffEditor /></ProtectedRoute>} />
          <Route path="/staff/edit/:id" element={<ProtectedRoute><StaffEditor /></ProtectedRoute>} />
          <Route path="/staff/users" element={<ProtectedRoute adminOnly><StaffUsers /></ProtectedRoute>} />
        </Routes>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  );
}
