import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import DarkModeToggle from '../components/DarkModeToggle';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguage } from '../contexts/LanguageContext';
import FIULogo from '../components/FIULogo';

const UnifiedLoginPage = () => {
  const navigate = useNavigate();
  const { login: studentLogin } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { email, password } = formData;

    if (!email || !password) {
      setError(t('emailPasswordRequired', 'Email and password are required'));
      setLoading(false);
      return;
    }

    try {
      // Önce admin girişi dene
      const adminResult = await adminLogin(email, password);
      
      if (adminResult.success) {
        navigate('/admin/dashboard');
        return;
      }

      // Admin girişi başarısızsa öğrenci girişi dene
      const studentResult = await studentLogin(email, password);
      
      if (studentResult.success) {
        navigate('/');
        return;
      }

      // Her ikisi de başarısızsa hata göster
      setError(t('invalidEmailPassword', 'Invalid email or password'));
      
    } catch (error) {
      console.error('Login error:', error);
      setError(t('loginFailed', 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

 

  const LoginLanguageSelector = () => {
    return (
      <div className="d-flex justify-content-center gap-2 mb-3">
        {Object.entries(languages).map(([code, lang]) => (
          <button
            key={code}
            className={`lang-btn ${currentLanguage === code ? 'active' : ''}`}
            onClick={() => changeLanguage(code)}
            title={lang.name}
          >
            {lang.flag}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="glassmorphism-login-container">
      {/* CSS Styles */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        .glassmorphism-login-container {
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          background: 
            linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.6) 100%),
            url('/images/fiu-logo-red.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-attachment: fixed;
          position: relative;
          overflow: hidden;
        }
        
        /* Gradient overlay to match original colors */
        .glassmorphism-login-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, 
            rgba(30, 64, 175, 0.3) 0%, 
            rgba(147, 51, 234, 0.3) 50%, 
            rgba(220, 38, 38, 0.2) 100%
          );
          z-index: 1;
        }
        
        .glassmorphism-login-container > * {
          position: relative;
          z-index: 2;
        }
        
        .floating-shape {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          opacity: 0.6;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .shape-1 {
          width: 300px;
          height: 300px;
          top: -150px;
          left: -150px;
          animation: float 6s ease-in-out infinite;
        }
        
        .shape-2 {
          width: 200px;
          height: 200px;
          bottom: -100px;
          right: -100px;
          animation: float 8s ease-in-out infinite reverse;
        }
        
        .shape-3 {
          width: 150px;
          height: 150px;
          top: 30%;
          right: 10%;
          animation: float 7s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .glass-morphism {
          backdrop-filter: blur(25px);
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 
            0 8px 32px 0 rgba(31, 38, 135, 0.37),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
        
        .login-card {
          animation: fadeInUp 0.8s ease-out;
          max-width: 450px;
          margin: 0 auto;
        }
        
        .logo-container {
          width: 100px;
          height: 100px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        
        .logo-container:hover {
          transform: translateY(-4px);
          filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.4));
        }
        
        .input-field {
          background: rgba(255, 255, 255, 0.15) !important;
          border: 1.5px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 12px !important;
          color: white !important;
          backdrop-filter: blur(15px);
          transition: all 0.3s ease;
          padding: 15px 20px;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        
        .input-field:focus {
          box-shadow: 
            0 0 0 3px rgba(102, 126, 234, 0.3) !important,
            0 8px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.5) !important;
          background: rgba(255, 255, 255, 0.2) !important;
          outline: none;
        }
        
        .input-field::placeholder {
          color: rgba(255, 255, 255, 0.7) !important;
        }
        
        .btn-gradient {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #dc2626 100%);
          border: none;
          border-radius: 12px;
          padding: 15px;
          font-weight: 600;
          font-size: 1.1rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
        }
        
        .btn-gradient:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(220, 38, 38, 0.4);
          background: linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #b91c1c 100%);
        }
        
        .btn-gradient:active {
          transform: translateY(0);
        }
        
        .btn-gradient::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }
        
        .btn-gradient:hover::before {
          left: 100%;
        }
        
        .password-toggle {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: color 0.3s ease;
          z-index: 10;
        }
        
        .password-toggle:hover {
          color: white;
        }
        
        .test-accounts {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 15px;
          backdrop-filter: blur(15px);
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        
        .test-account-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 8px;
          padding: 0.5rem 1rem;
          font-size: 0.8rem;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .test-account-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }
        
        .lang-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          width: 45px;
          height: 35px;
          border-radius: 8px;
          margin: 0 2px;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        
        .lang-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }
        
        .lang-btn.active {
          background: rgba(220, 38, 38, 0.9);
          border-color: #dc2626;
          box-shadow: 0 0 10px rgba(220, 38, 38, 0.5);
        }
        
        .alert-custom {
          background: rgba(220, 53, 69, 0.2) !important;
          border: 1px solid rgba(220, 53, 69, 0.3) !important;
          backdrop-filter: blur(10px);
          border-radius: 12px;
        }
        
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .dark-mode-toggle {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 10;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 50%;
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .dark-mode-toggle:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(180deg);
        }
        
        @media (max-width: 768px) {
          .login-card {
            margin: 20px;
            padding: 1.5rem !important;
          }
          
          .logo-container {
            width: 60px;
            height: 60px;
            font-size: 1.5rem;
          }
        }
      `}</style>

      {/* Floating Background Shapes */}
      <div className="floating-shape shape-1"></div>
      <div className="floating-shape shape-2"></div>
      <div className="floating-shape shape-3"></div>
      
      {/* Dark Mode Toggle */}
      <DarkModeToggle />
      
      {/* Main Content */}
      <div className="container-fluid h-100 d-flex align-items-center justify-content-center min-vh-100 p-3">
        <div className="login-card glass-morphism p-4 p-md-5">
          {/* Logo Section */}
          <div className="text-center mb-4">
            <div className="logo-container">
              <FIULogo size="xl" />
            </div>
            <h1 className="text-white fw-bold mb-2" style={{ fontSize: '2.5rem' }}>
              FIU
            </h1>
            <p className="text-white-50 mb-0">
              {t('guidanceSystem', 'Guidance System')}
            </p>
          </div>

          {/* Welcome Message */}
          <div className="text-center mb-4">
            <h4 className="text-white mb-2" style={{ fontWeight: '600' }}>
              {t('login', 'Giriş')}
            </h4>
            <p className="text-white-50 small">
              {t('loginDescription', 'Sisteme erişmek için email ve şifrenizi girin')}
            </p>
          </div>

          {/* Language Selector */}
          <LoginLanguageSelector />

          {/* Error Alert */}
          {error && (
            <div className="alert alert-custom text-white mb-4" role="alert">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            {/* Email Input */}
            <div className="mb-3">
              <label className="form-label text-white fw-semibold">
                {t('email', 'E-posta')}
              </label>
              <input
                type="email"
                name="email"
                className="form-control form-control-lg input-field"
                placeholder={t('enterYourEmail', 'E-posta adresinizi girin')}
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Password Input */}
            <div className="mb-4">
              <label className="form-label text-white fw-semibold">
                {t('password', 'Şifre')}
              </label>
              <div className="position-relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-control form-control-lg input-field pe-5"
                  placeholder={t('enterYourPassword', 'Şifrenizi girin')}
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Login Button */}
            <div className="d-grid mb-4">
              <button
                type="submit"
                className="btn btn-gradient text-white fw-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner me-2"></div>
                    {t('signingIn', 'Signing In')}...
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    {t('signin', 'Sign In')}
                  </>
                )}
              </button>
            </div>

           
          </form>

          
        </div>
      </div>

      {/* Footer */}
      <div 
        className="text-center text-white-50 small"
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      >
        © 2024 Final International University
      </div>
    </div>
  );
};

export default UnifiedLoginPage;