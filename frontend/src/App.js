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
import LanguageDropdown from './components/LanguageDropdown';
import { useConfirmation } from './hooks/useConfirmation';
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
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
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

// Navbar'da kullanılacak Language Dropdown
const SimpleLanguageSelector = () => {
  return <LanguageDropdown variant="navbar" />;
};

// Ana uygulama component'i (student sayfaları)
const MainApp = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { confirmationState, showConfirmation } = useConfirmation();

  const handleLogoutClick = async () => {
    console.log('Navbar logout button clicked!');
    
    const confirmed = await showConfirmation({
      title: t('logoutConfirmation', 'Logout Confirmation'),
      message: t('logoutConfirmationMessage', 'Are you sure you want to logout?'),
      type: 'danger',
      confirmText: t('logout', 'Logout'),
      cancelText: t('cancel', 'Cancel')
    });

    if (confirmed) {
      console.log('Navbar logout confirmed');
      logout();
    }
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
            
            {/* User Info, Language Dropdown ve Logout */}
            <div className="d-flex align-items-center gap-3">
              <span className="text-white d-none d-md-inline">
                {t('welcome')}, <strong>{user?.name}</strong>
              </span>
              
              {/* Language Dropdown */}
              <SimpleLanguageSelector />
              
              <button 
                className="btn btn-outline-light btn-sm" 
                onClick={handleLogoutClick}
                title={t('logout')}
              >
                <span className="d-none d-md-inline">{t('logout')}</span>
                <span className="d-md-none">🚪</span>
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
                {t('studentGuidanceRequestSystem')} &copy; 2025
              </small>
            </div>
          </div>
          <small className="text-muted">
            {t('poweredBy')} FIU {t('informationTechnologyDepartment')}
          </small>
        </div>
      </footer>

      {/* Confirmation Modal - EN ÖNEMLİ KISIM! */}
      <ConfirmationModal {...confirmationState} />

      {/* Dark Mode Toggle */}
      <DarkModeToggle />
    </>
  );
};

export default App;