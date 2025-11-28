import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './darkmode.css';
import './fiu-theme.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useTranslation } from './hooks/useTranslation';
import { apiService } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import DarkModeToggle from './components/DarkModeToggle';
import FIULogo from './components/FIULogo';
import ConfirmationModal from './components/ConfirmationModal';
import LanguageDropdown from './components/LanguageDropdown';
import StudentNotificationCenter from './components/StudentNotificationCenter';
import { useConfirmation } from './hooks/useConfirmation';
// Pages
import HomePage from './pages/HomePage';
import RequestsPage from './pages/RequestsPage';
import CreateRequestPage from './pages/CreateRequestPage';
import RegisterPage from './pages/RegisterPage';
import UnifiedLoginPage from './pages/UnifiedLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ExamRequestPage from './pages/ExamRequestPage';
import SecretaryExamRequestsPage from './pages/SecretaryExamRequestsPage.js'; // 👈 YENİ

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
                <Route path="/secretary/exam-requests" element={<SecretaryExamRequestsPage />} /> {/* 👈 YENİ */}

        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </ProtectedAdminRoute>
  );
};

// Student Routes
const StudentRoutes = () => {
  const { loading, isAuthenticated } = useAuth();

  // Loading durumunu kontrol et
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

  // Authentication kontrolü
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <MainApp />;
};

// Navbar'da kullanılacak Language Dropdown
const SimpleLanguageSelector = () => {
  return <LanguageDropdown variant="navbar" />;
};

// Enhanced Sidebar Component with User Profile
const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: t('home'), icon: 'bi-house-door' },
    { path: '/requests', label: t('myRequests'), icon: 'bi-file-earmark-text' },
    { path: '/create-request', label: t('createRequest'), icon: 'bi-plus-circle' },
    { path: '/exam-request', label: 'Exam Request', icon: 'bi-calendar-check' }  // 👈 YENİ

  ];

 // Basitleştirilmiş ve çalışan profil avatar fonksiyonu
const renderProfileAvatar = () => {
  console.log('User data:', user);
  console.log('Profile photo value:', user?.profile_photo);
  
  // Kullanıcı yoksa varsayılan
  if (!user) {
    return (
      <div style={{
        width: '45px', height: '45px', borderRadius: '50%',
        background: '#6c757d', display: 'flex', alignItems: 'center', 
        justifyContent: 'center', color: 'white', fontSize: '1.2rem'
      }}>
        ?
      </div>
    );
  }

  // Profil fotoğrafı varsa göster
  if (user.profile_photo && user.profile_photo.trim() !== '') {
const photoUrl = apiService.getProfilePhotoUrl(user.profile_photo);
    console.log('Photo URL:', photoUrl);
    
    return (
      <img 
        src={photoUrl}
        alt="Profil"
        style={{
          width: '45px',
          height: '45px',
          objectFit: 'cover',
          borderRadius: '50%',
          border: '2px solid #e9ecef'
        }}
        onError={(e) => {
          console.log('Image load failed:', photoUrl);
          // Hata durumunda initials göster
          e.target.outerHTML = `<div style="width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, #dc2626, #b91c1c); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; font-weight: bold; border: 2px solid #e9ecef;">${getInitials()}</div>`;
        }}
        onLoad={() => {
          console.log('Image loaded successfully:', photoUrl);
        }}
      />
    );
  }

  // Profil fotoğrafı yoksa initials
  return (
    <div style={{
      width: '45px', height: '45px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: '1.2rem', fontWeight: 'bold',
      border: '2px solid #e9ecef'
    }}>
      {getInitials()}
    </div>
  );

  function getInitials() {
    if (!user?.name) return 'ST';
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  }
};
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1040
          }}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: isOpen ? 0 : '-320px',
          width: '320px',
          height: '100vh',
          backgroundColor: isDark ? '#1a202c' : '#ffffff',
          borderRight: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`,
          transition: 'left 0.3s ease-in-out',
          zIndex: 1050,
          boxShadow: isOpen ? '0 0 20px rgba(0,0,0,0.2)' : 'none',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Sidebar Header */}
        <div 
          className="sidebar-header p-3 border-bottom"
          style={{
            borderColor: isDark ? '#4a5568' : '#e2e8f0',
            backgroundColor: isDark ? '#2d3748' : '#f8f9fa'
          }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <FIULogo size="sm" className="me-2" />
              <span className={`fw-bold ${isDark ? 'text-white' : 'text-dark'}`}>
                {t('systemTitle')}
              </span>
            </div>
            <button
              className="btn btn-sm"
              onClick={toggleSidebar}
              style={{ border: 'none', background: 'none' }}
            >
              <i className={`bi bi-x-lg ${isDark ? 'text-white' : 'text-dark'}`}></i>
            </button>
          </div>
        </div>

        {/* User Profile Section - DÜZENLENMİŞ */}
        <div 
          className="user-profile-section p-4 border-bottom"
          style={{
            borderColor: isDark ? '#4a5568' : '#e2e8f0',
            backgroundColor: isDark ? '#2d3748' : '#ffffff'
          }}
        >
          <div className="d-flex align-items-center">
            {/* Profile Avatar Container */}
            <div className="profile-avatar-container position-relative me-3">
              {renderProfileAvatar()}
              
              {/* Varsayılan avatar (fotoğraf yüklenemezse gösterilir) */}
              <div 
                className="default-fallback-avatar"
                style={{
                  display: 'none', // Başlangıçta gizli
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6c757d, #495057)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  border: '2px solid #e9ecef'
                }}
              >
                <i className="bi bi-person"></i>
              </div>
            </div>

            {/* User Info */}
            <div className="user-info flex-grow-1">
              <h6 className={`mb-1 fw-bold ${isDark ? 'text-white' : 'text-dark'}`}>
                {user?.name || 'Kullanıcı'}
              </h6>
              <p className={`mb-1 small ${isDark ? 'text-gray-300' : 'text-muted'}`}>
                <i className="bi bi-person-badge me-1"></i>
                {user?.student_number || 'N/A'}
              </p>
              <p className={`mb-0 small ${isDark ? 'text-gray-400' : 'text-muted'}`}>
                <i className="bi bi-envelope me-1"></i>
                {user?.email || 'E-posta yok'}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Menu */}
        <div className="sidebar-menu p-3 flex-grow-1">
          <ul className="list-unstyled mb-0">
            {menuItems.map((item) => (
              <li key={item.path} className="mb-2">
                <Link
                  to={item.path}
                  onClick={toggleSidebar}
                  className={`d-flex align-items-center p-3 rounded text-decoration-none sidebar-item ${
                    location.pathname === item.path ? 'active' : ''
                  }`}
                  style={{
                    color: isDark ? '#e2e8f0' : '#4a5568',
                    backgroundColor: location.pathname === item.path 
                      ? (isDark ? '#dc2626' : '#dc2626') 
                      : 'transparent',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <i className={`${item.icon} me-3`} style={{ fontSize: '1.2rem' }}></i>
                  <span className="fw-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        .sidebar-item:hover {
          background-color: ${isDark ? '#4a5568' : '#f8f9fa'} !important;
          transform: translateX(5px);
        }
        
        .sidebar-item.active {
          color: white !important;
        }
        
        .sidebar-item.active:hover {
          background-color: #b91c1c !important;
          transform: translateX(5px);
        }
        
        .profile-avatar-container:hover {
          transform: scale(1.05);
          transition: transform 0.2s ease-in-out;
        }
        
        @media (max-width: 768px) {
          .sidebar {
            width: 280px !important;
            left: ${isOpen ? '0' : '-280px'} !important;
          }
        }
      `}</style>
    </>
  );
};

// Ana uygulama component'i (student sayfaları)
const MainApp = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { confirmationState, showConfirmation } = useConfirmation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

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

  // Notification click handler
  const handleNotificationClick = (requestId, type) => {
    console.log('Student notification clicked:', { requestId, type });
    
    if (requestId) {
      // Navigate to requests page and highlight the specific request
      window.location.href = `/requests#request-${requestId}`;
    } else {
      // Navigate to general requests page
      window.location.href = '/requests';
    }
  };

  return (
    <>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Navigation with FIU Logo */}
      <nav className="navbar navbar-dark bg-primary">
        <div className="container">
          <div className="d-flex align-items-center">
            {/* Hamburger Menu Button */}
            <button
              className="btn me-3 hamburger-menu-btn"
              onClick={toggleSidebar}
              style={{ 
                background: 'transparent',
                border: '2px solid white',
                color: 'white',
                padding: '8px 12px',
                fontSize: '1.2rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px'
              }}
              type="button"
            >
              <i className="bi bi-list" style={{ fontSize: '1.4rem' }}></i>
            </button>
            
            <Link className="navbar-brand d-flex align-items-center mb-0" to="/">
              <FIULogo size="sm" className="me-2" />
              <span>{t('systemTitle')}</span>
            </Link>
          </div>
          
          {/* User Info, Notifications, Language Dropdown ve Logout */}
          <div className="d-flex align-items-center gap-3">
            <span className="text-white d-none d-md-inline">
              {t('welcome')}, <strong>{user?.first_name || user?.name}</strong>
            </span>
            
            {/* Language Dropdown */}
            <SimpleLanguageSelector />
            
            {/* Student Notification Center */}
            <StudentNotificationCenter onNotificationClick={handleNotificationClick} />
            
            <button 
              className="btn btn-outline-light btn-sm" 
              onClick={handleLogoutClick}
              title={t('logout')}
            >
              <span className="d-none d-md-inline">{t('logout')}</span>
              <i className="bi bi-box-arrow-right d-md-none"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mt-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/create-request" element={<CreateRequestPage />} />
       <Route path="/exam-request" element={<ExamRequestPage />} />
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