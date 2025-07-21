import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './darkmode.css';
import './fiu-theme.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useTranslation } from './hooks/useTranslation';
import { apiService } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import DarkModeToggle from './components/DarkModeToggle';
import FIULogo from './components/FIULogo';
import ConfirmationModal from './components/ConfirmationModal';
// Pages
import HomePage from './pages/HomePage';
import RequestsPage from './pages/RequestsPage';
import CreateRequestPage from './pages/CreateRequestPage';
import RegisterPage from './pages/RegisterPage';
import UnifiedLoginPage from './pages/UnifiedLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

function App() {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        await apiService.testConnection();
        setApiStatus('connected');
      } catch (error) {
        setApiStatus('error');
      }
    };

    checkApiConnection();
  }, []);

  if (apiStatus === 'checking') {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <FIULogo size="xl" className="mb-3" />
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Connecting to API...</p>
        </div>
      </div>
    );
  }

  if (apiStatus === 'error') {
    return (
      <div className="container mt-5">
        <div className="text-center mb-4">
          <FIULogo size="xl" />
        </div>
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">API Connection Error</h4>
          <p>Cannot connect to the backend API. Please make sure the backend server is running on port 5000.</p>
          <hr />
          <p className="mb-0">Start the backend server with: <code>npm run dev</code></p>
        </div>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <Router>
                <AppRoutes />
              </Router>
            </AdminAuthProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

// Route yapısını ayrı component'e taşı
const AppRoutes = () => {
  return (
    <div className="App">
      <Routes>
        {/* Unified Login Route */}
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLoginRoute />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        
        {/* Protected Student Routes */}
        <Route path="/*" element={<StudentRoutes />} />
      </Routes>
    </div>
  );
};

// Unified Login Route
const LoginRoute = () => {
  const { isAuthenticated: studentAuth } = useAuth();
  const { isAuthenticated: adminAuth } = useAdminAuth();
  
  if (studentAuth) return <Navigate to="/" replace />;
  if (adminAuth) return <Navigate to="/admin/dashboard" replace />;
  
  return <UnifiedLoginPage />;
};

// Register Route
const RegisterRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />;
};

// Admin Login Route (redirect to unified login)
const AdminLoginRoute = () => {
  const { isAuthenticated: adminAuth } = useAdminAuth();
  return adminAuth ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/login" replace />;
};

// Admin Routes
const AdminRoutes = () => {
  return (
    <ProtectedAdminRoute>
      <Routes>
        <Route path="/dashboard" element={<AdminDashboardPage />} />
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </ProtectedAdminRoute>
  );
};

// Student Routes
const StudentRoutes = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <FIULogo size="lg" className="mb-3" />
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
};

// Basit Language Selector Component
const SimpleLanguageSelector = () => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  return (
    <div className="d-flex gap-1 me-2">
      {Object.entries(languages).map(([code, lang]) => (
        <button
          key={code}
          className={`btn btn-sm ${
            currentLanguage === code ? 'btn-light' : 'btn-outline-light'
          }`}
          onClick={() => changeLanguage(code)}
          title={lang.name}
          style={{ fontSize: '14px', padding: '4px 8px' }}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
};

// Ana uygulama component'i (student sayfaları)
const MainApp = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  return (
    <>
      {/* Navigation with FIU Logo */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <FIULogo size="sm" className="me-2" />
            <span>{t('systemTitle')}</span>
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/">{t('home')}</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/requests">{t('myRequests')}</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/create-request">{t('createRequest')}</Link>
              </li>
            </ul>
            
            {/* User Info, Language Selector ve Logout */}
            <div className="d-flex align-items-center">
              <span className="text-white me-3">
                {t('welcome')}, <strong>{user?.name}</strong>
              </span>
              
              {/* Simple Language Selector */}
              <SimpleLanguageSelector />
              
              <button 
                className="btn btn-outline-light btn-sm" 
                onClick={handleLogoutClick}
                title={t('logout')}
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mt-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/create-request" element={<CreateRequestPage />} />
        </Routes>
      </main>

      {/* Footer with FIU Logo */}
      <footer className="bg-light mt-5 py-4">
        <div className="container text-center">
          <div className="d-flex justify-content-center align-items-center mb-3">
            <FIULogo size="md" className="me-3" />
            <div>
              <p className="text-muted mb-1">
                <strong>{t('systemSubtitle')}</strong>
              </p>
              <small className="text-muted">
                Student Guidance Request System &copy; 2025
              </small>
            </div>
          </div>
          <small className="text-muted">
            Powered by FIU Information Technology Department
          </small>
        </div>
      </footer>

      {/* Site İçi Logout Onay Modalı */}
      <ConfirmationModal
        show={showLogoutModal}
        title="FIU Rehberlik Sistemi"
        message="Oturumu kapatmak istediğinizden emin misiniz?"
        confirmText="Tamam"
        cancelText="İptal"
        type="warning"
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />

      {/* Dark Mode Toggle */}
      <DarkModeToggle />
    </>
  );
};

export default App;