import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import DarkModeToggle from '../components/DarkModeToggle';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguage } from '../contexts/LanguageContext';
import FIULogo from '../components/FIULogo';
import ReCAPTCHA from 'react-google-recaptcha';
import { apiService } from '../services/api';

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
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [captchaRequired, setCaptchaRequired] = useState(true);
  const [captchaToken, setCaptchaToken] = useState(null);
  
  // Magic Link State
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSuccess, setMagicLinkSuccess] = useState(false);


 // Language Dropdown State  ← BURAYA EKLE
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef(null);
  
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Captcha değişikliği
  const handleCaptchaChange = (token) => {
    console.log('✅ Captcha verified:', !!token);
    setCaptchaToken(token);
  };

// Language Dropdown - Click outside to close  ← BURAYA EKLE
 // Language Dropdown - Click outside to close
useEffect(() => {
  if (!isLangDropdownOpen) return;

  const handleClickOutside = (event) => {
    if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
      setIsLangDropdownOpen(false);
    }
  };

  const timer = setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
  }, 0);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [isLangDropdownOpen]);

  // Magic Link Request Handler
  const handleMagicLinkRequest = async (e) => {
    e.preventDefault();
    
    if (!magicLinkEmail || !magicLinkEmail.includes('@')) {
    setError(t('enterValidEmail', 'Please enter a valid email address'));
      return;
    }

    setMagicLinkLoading(true);
    setError(null);

    try {
      const response = await apiService.requestMagicLink(magicLinkEmail);
      
      if (response.data.success) {
        setMagicLinkSuccess(true);
        console.log('✅ Magic link request successful');
      }
    } catch (error) {
      console.error('Magic link request error:', error);
      
      // Rate limit hatası özel mesaj
      if (error.response?.status === 429) {
      setError(t('tooManyRequests', 'Too many requests. Please try again after 15 minutes.'));
      } else {
      setError(error.response?.data?.error || t('magicLinkFailed', 'Failed to send magic link. Please try again.'));
      }
    } finally {
      setMagicLinkLoading(false);
    }
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

  // Captcha kontrolü
  if (!captchaToken) {
  setError(t('captchaRequired', 'Please complete the captcha verification'));
    setLoading(false);
    return;
  }

  console.log('🔐 Login attempt:', { email, hasCaptchaToken: !!captchaToken });

  try {
    // ✅ ADIM 1: Email hangi tipe ait belirle
    console.log('🔍 Checking email type...');
    const emailCheckResponse = await apiService.checkEmailType(email);
    const userType = emailCheckResponse.data.userType;

    console.log('📧 Email type:', userType);

    // Email sistemde yoksa
    if (!userType) {
  setError(t('noAccountFound', 'No account found with this email address'));
      setLoading(false);
      setCaptchaToken(null);
      return;
    }

    // ✅ ADIM 2: Sadece doğru tipe login isteği at
    let loginResult;

    if (userType === 'admin') {
      console.log('🔐 Attempting admin login...');
      loginResult = await adminLogin(email, password, captchaToken);
      
      if (loginResult.success) {
        console.log('✅ Admin login successful');
        setCaptchaToken(null);
        
        // 🆕 Department-based redirect
        const adminData = loginResult.user || loginResult.admin;
        const targetDept = adminData?.is_super_admin && !adminData?.department
          ? 'all'
          : adminData?.department?.toLowerCase() || 'academic';
        
        console.log('✅ Redirecting to:', `/admin/dashboard/${targetDept}`);
        navigate(`/admin/dashboard/${targetDept}`);
        return;
      }
    
    } else if (userType === 'student') {
      console.log('🔐 Attempting student login...');
      loginResult = await studentLogin(email, password, captchaToken);
      
      if (loginResult.success) {
        console.log('✅ Student login successful');
        setCaptchaToken(null);
        navigate('/');
        return;
      }
    }

    // Login başarısız
    console.log('❌ Login failed');
    setError(t('invalidEmailPassword', 'Invalid email or password'));
    
  } catch (error) {
    console.error('❌ Login error:', error);
    
    const errorMessage = error.response?.data?.error || t('loginFailed', 'Login failed. Please try again.');
    setError(errorMessage);
    
  } finally {
    setLoading(false);
    // Her durumda captcha token'ı sıfırla (yeni captcha gerekli)
    setCaptchaToken(null);
  }
};


const LoginLanguageSelector = () => {
  const currentLang = languages[currentLanguage];
  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';

  return (
    <div ref={langDropdownRef} className="language-dropdown-wrapper mb-3">
      {/* Dropdown Button */}
      <button
        type="button"
        className="language-dropdown-button"
        onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
      >
        <span className="selected-lang-name">{currentLang.name}</span>
        <i className={`bi bi-chevron-${isLangDropdownOpen ? 'up' : 'down'}`}></i>
      </button>

      {/* Dropdown Menu */}
      {isLangDropdownOpen && (
        <div className="language-dropdown-menu" style={{ 
          left: isRTL ? 'auto' : '0',
          right: isRTL ? '0' : 'auto'
        }}>
          {Object.entries(languages).map(([code, lang]) => (
            <button
              key={code}
              type="button"
              className={`language-dropdown-item ${currentLanguage === code ? 'active' : ''}`}
              onClick={() => {
                changeLanguage(code);
                setIsLangDropdownOpen(false);
              }}
            >
              <span className="lang-name">{lang.name}</span>
              {currentLanguage === code && (
                <i className="bi bi-check-lg ms-auto"></i>
              )}
            </button>
          ))}
        </div>
      )}
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
        
     /* Language Dropdown Styles */
.language-dropdown-wrapper {
  position: relative;
  width: 100%;
}

.language-dropdown-button {
  width: 100%;
  background: rgba(255, 255, 255, 0.15);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: white;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(15px);
}

.language-dropdown-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.selected-lang-name {
  flex: 1;
  text-align: left;
  font-weight: 500;
  font-size: 1rem;
}

.language-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  width: 100%;
  background: rgba(30, 30, 50, 0.95);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  z-index: 1000;
  overflow: hidden;
  animation: fadeInUp 0.2s ease-out;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.language-dropdown-item {
  width: 100%;
  background: transparent;
  border: none;
  color: white;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.95rem;
  text-align: left;
}

.language-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.15);
}

.language-dropdown-item.active {
  background: rgba(220, 38, 38, 0.5);
  font-weight: 600;
}

.lang-name {
  flex: 1;
  text-align: left;
}

.language-dropdown-item i.bi-check-lg {
  color: white;
  font-size: 1.1rem;
  font-weight: bold;
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
          display: inline-block;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Captcha Styles - İYİLEŞTİRİLMİŞ */
        .captcha-wrapper {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(10px);
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 20px 0;
        }
        
        .captcha-container {
          transform: scale(1);
          transform-origin: center;
          display: flex;
          justify-content: center;
        }
        
        /* Captcha iframe override */
        .captcha-container iframe {
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        }

        /* Magic Link Styles */
        .magic-link-toggle {
          text-align: center;
          margin: 15px 0;
        }

        .magic-link-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: underline;
        }

        .magic-link-btn:hover {
          color: white;
        }

        .magic-link-form {
          animation: fadeInUp 0.5s ease-out;
        }

        .success-message {
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.4);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          backdrop-filter: blur(10px);
        }

        .success-message h4 {
          color: #4ade80;
          margin-bottom: 10px;
          font-size: 18px;
        }

        .success-message p {
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
          font-size: 14px;
        }

        .back-to-login {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 15px;
          font-size: 14px;
        }

        .back-to-login:hover {
          background: rgba(255, 255, 255, 0.2);
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
          
          .captcha-wrapper {
            padding: 15px;
          }
          
          .captcha-container {
            transform: scale(0.9);
          }
        }
        
        @media (max-width: 400px) {
          .captcha-container {
            transform: scale(0.85);
          }
        }
      `}</style>

      {/* Floating Background Shapes */}
      <div className="floating-shape shape-1"></div>
      <div className="floating-shape shape-2"></div>
      <div className="floating-shape shape-3"></div>
      
      {/* Dark Mode Toggle */}
     
     {/* <DarkModeToggle />}
      
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
  {showMagicLink ? t('magicLinkLogin', 'Magic Link Login') : t('login', 'Giriş')}
            </h4>
            <p className="text-white-50 small">
              {showMagicLink 
    ? t('magicLinkDescription', 'Enter your email to receive a login link')
    : t('loginDescription', 'Sisteme erişmek için email ve şifrenizi girin')
              }
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

          {/* Magic Link Success Message */}
         {magicLinkSuccess && (
  <div className="success-message mb-4">
    <h4>✓ {t('emailSent', 'Email Sent!')}</h4>
    <p>{t('checkYourInbox', 'Check your inbox for the login link.')}</p>
    <p className="mt-2" style={{ fontSize: '13px', opacity: 0.8 }}>
      {t('linkWillExpire', 'The link will expire in 15 minutes.')}
    </p>
  </div>
)}

          {/* Show Magic Link Form OR Regular Login Form */}
          {showMagicLink && !magicLinkSuccess ? (
            // MAGIC LINK FORM
            <form onSubmit={handleMagicLinkRequest} className="magic-link-form">
              <div className="mb-4">
                <label className="form-label text-white fw-semibold">
                  {t('email', 'E-posta')}
                </label>
                <input
                  type="email"
                  className="form-control form-control-lg input-field"
                  placeholder={t('enterYourEmail', 'E-posta adresinizi girin')}
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  required
                />
              </div>

              <div className="d-grid mb-3">
                <button
                  type="submit"
                  className="btn btn-gradient text-white fw-semibold"
                  disabled={magicLinkLoading}
                >
                  {magicLinkLoading ? (
                    <>
                      <span className="loading-spinner me-2"></span>
      {t('sending', 'Sending')}...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-envelope me-2"></i>
      {t('sendMagicLink', 'Send Magic Link')}
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                className="back-to-login w-100"
                onClick={() => {
                  setShowMagicLink(false);
                  setMagicLinkSuccess(false);
                  setError(null);
                }}
              >
  {t('backToPasswordLogin', '← Back to Password Login')}
              </button>
            </form>
          ) : !magicLinkSuccess ? (
            // REGULAR LOGIN FORM
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
                  maxLength={100}
                  required
                />
                <small className="text-white-50">
                  {formData.email.length}/100 {t('characters', 'characters')}
                </small>
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
                    maxLength={50}
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
                <small className="text-white-50">
                  {formData.password.length}/50 {t('characters', 'characters')}
                </small>
              </div>

              {/* Captcha */}
              {captchaRequired && (
                <div className="mb-4">
                  <div className="captcha-wrapper">
                    <div className="captcha-container">
                      <ReCAPTCHA
                        sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY}
                        onChange={handleCaptchaChange}
                        theme="dark"
                      />
                    </div>
                  </div>
                </div>
              )}

            

              {/* Login Button */}
              <div className="d-grid mb-3">
                <button
                  type="submit"
                  className="btn btn-gradient text-white fw-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner me-2"></span>
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

              {/* Magic Link Toggle */}
              <div className="magic-link-toggle">
                <button
                  type="button"
                  className="magic-link-btn"
                  onClick={() => {
                    setShowMagicLink(true);
                    setError(null);
                  }}
                >
  {t('orSignInWithMagicLink', ' Or sign in with Magic Link (No password needed)')}
                </button>
              </div>
            </form>
          ) : (
            // MAGIC LINK SUCCESS - BACK BUTTON
            <button
              className="back-to-login w-100"
              onClick={() => {
                setShowMagicLink(false);
                setMagicLinkSuccess(false);
                setMagicLinkEmail('');
                setError(null);
              }}
            >
  {t('backToLogin', '← Back to Login')}
            </button>
          )}
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
        © 2025 Final International University
      </div>
    </div>
  );
};

export default UnifiedLoginPage;