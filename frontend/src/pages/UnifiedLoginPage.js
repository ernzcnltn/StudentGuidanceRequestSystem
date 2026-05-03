import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
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

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const langDropdownRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError) {
      const errorMessages = {
        'only_school_email': t('onlySchoolEmail', 'Only @final.edu.tr email addresses are allowed.'),
        'account_inactive': t('accountInactive', 'Your account is inactive. Please contact your administrator.'),
        'oauth_failed': t('oauthFailed', 'Google sign-in failed. Please try again.'),
      };
      setError(errorMessages[urlError] || decodeURIComponent(urlError));
      window.history.replaceState({}, document.title, '/login');
    }
  }, []);

  useEffect(() => {
    if (!isLangDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setIsLangDropdownOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLangDropdownOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleCaptchaChange = (token) => setCaptchaToken(token);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    apiService.initiateGoogleAuth();
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

    if (!captchaToken) {
      setError(t('captchaRequired', 'Please complete the captcha verification'));
      setLoading(false);
      return;
    }

    try {
      const emailCheckResponse = await apiService.checkEmailType(email);
      const userType = emailCheckResponse.data.userType;

      if (!userType) {
        setError(t('noAccountFound', 'No account found with this email address'));
        setLoading(false);
        setCaptchaToken(null);
        return;
      }

      let loginResult;

      if (userType === 'admin') {
        loginResult = await adminLogin(email, password, captchaToken);
        if (loginResult.success) {
          setCaptchaToken(null);
          const adminData = loginResult.user || loginResult.admin;
          const targetDept = adminData?.is_super_admin && !adminData?.department
            ? 'all'
            : adminData?.department?.toLowerCase() || 'academic';
          navigate(`/admin/dashboard/${targetDept}`);
          return;
        }
      } else if (userType === 'student') {
        loginResult = await studentLogin(email, password, captchaToken);
        if (loginResult.success) {
          setCaptchaToken(null);
          navigate('/');
          return;
        }
      }

      setError(t('invalidEmailPassword', 'Invalid email or password'));
    } catch (err) {
      setError(err.response?.data?.error || t('loginFailed', 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
      setCaptchaToken(null);
    }
  };

  const currentLang = languages[currentLanguage];

  return (
    <div className={`lr ${mounted ? 'mounted' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display:ital@0;1&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; overflow: hidden; }

        :root {
          --red: #C8102E;
          --red-h: #E8233F;
          --s0: #0A0A0E;
          --s1: #111116;
          --s2: #18181F;
          --s3: #1F1F28;
          --s4: #27272F;
          --b0: rgba(255,255,255,0.05);
          --b1: rgba(255,255,255,0.10);
          --b2: rgba(255,255,255,0.18);
          --tp: #F2F2F7;
          --ts: rgba(242,242,247,0.55);
          --tm: rgba(242,242,247,0.28);
          --r: 12px;
        }

        .lr {
          font-family: 'DM Sans', sans-serif;
          height: 100vh; width: 100vw;
          display: flex; overflow: hidden;
          background: var(--s0);
        }

        /* ── LEFT ── */
        .lr-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 56px 64px;
          position: relative;
          overflow: hidden;
          background: var(--s1);
        }
        .lr-left::before {
          content: '';
          position: absolute; top: -200px; right: -200px;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(200,16,46,0.15) 0%, transparent 65%);
          pointer-events: none;
        }
        .lr-left::after {
          content: '';
          position: absolute; bottom: -150px; left: -100px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(200,16,46,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .lr-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .lr-left-inner {
          position: relative; z-index: 1;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .mounted .lr-left-inner { opacity: 1; transform: translateY(0); }

        .left-tagline {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(36px, 4.5vw, 58px);
          line-height: 1.08; color: var(--tp);
          letter-spacing: -0.025em; margin-bottom: 20px;
        }
        .left-tagline em { font-style: italic; color: var(--red); }

        .left-desc {
          font-size: 15px; line-height: 1.75;
          color: var(--ts); max-width: 420px; margin-bottom: 40px;
        }
        .left-features { display: flex; flex-direction: column; gap: 12px; }
        .left-feature {
          display: flex; align-items: center; gap: 12px;
          font-size: 14px; color: var(--ts);
        }
        .feature-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--red); flex-shrink: 0;
          box-shadow: 0 0 8px rgba(200,16,46,0.6);
        }
        .lr-copyright {
          position: absolute; bottom: 28px; left: 64px;
          font-size: 12px; color: var(--tm); z-index: 1;
          opacity: 0; transition: opacity 0.6s ease 0.4s;
        }
        .mounted .lr-copyright { opacity: 1; }

        /* ── RIGHT ── */
        .lr-right {
          width: 460px; min-width: 460px;
          background: var(--s0);
          border-left: 1px solid var(--b0);
          display: flex; flex-direction: column;
          justify-content: center;
          padding: 44px 44px;
          opacity: 0; transform: translateX(20px);
          transition: opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s;
          overflow: hidden;
        }
        .mounted .lr-right { opacity: 1; transform: translateX(0); }

        /* Logo — centered, stacked */
        .right-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
          text-align: center;
        }
        .right-logo-box {
          width: 56px; height: 56px;
          background: var(--red);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(200,16,46,0.4);
        }
        .right-logo-university {
          font-family: 'DM Serif Display', serif;
          font-size: 19px;
          color: var(--tp);
          line-height: 1;
          letter-spacing: -0.01em;
        }
        .right-logo-appname {
          font-size: 12px;
          color: var(--tm);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        /* Lang */
        .lang-wrap { position: relative; margin-bottom: 18px; }
        .lang-btn-el {
          width: 100%; background: var(--s2);
          border: 1px solid var(--b0); border-radius: var(--r);
          color: var(--ts); padding: 10px 13px;
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; font-size: 13px;
          font-family: 'DM Sans', sans-serif; transition: all 0.2s;
        }
        .lang-btn-el:hover { border-color: var(--b1); color: var(--tp); }
        .lang-menu {
          position: absolute; top: calc(100% + 5px); left: 0; right: 0;
          background: var(--s3); border: 1px solid var(--b2);
          border-radius: var(--r); z-index: 100; overflow: hidden;
          box-shadow: 0 12px 36px rgba(0,0,0,0.6);
          animation: dropIn 0.15s ease;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lang-item-el {
          width: 100%; background: transparent; border: none;
          color: var(--ts); padding: 10px 13px;
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; font-size: 13px;
          font-family: 'DM Sans', sans-serif; text-align: left; transition: all 0.15s;
        }
        .lang-item-el:hover { background: var(--s4); color: var(--tp); }
        .lang-item-el.active { color: var(--tp); background: rgba(200,16,46,0.12); }
        .lang-check { width: 6px; height: 6px; border-radius: 50%; background: var(--red); }

        /* Error */
        .err-box {
          background: rgba(200,16,46,0.1);
          border: 1px solid rgba(200,16,46,0.25);
          border-radius: var(--r); padding: 10px 13px; margin-bottom: 16px;
          color: #FF8A96; font-size: 13px;
          display: flex; align-items: flex-start; gap: 9px;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Fields */
        .field { margin-bottom: 12px; }
        .field-lbl {
          display: block; font-size: 11px; font-weight: 500;
          color: var(--tm); margin-bottom: 6px;
          letter-spacing: 0.05em; text-transform: uppercase;
        }
        .field-inp {
          width: 100%; background: var(--s2);
          border: 1px solid var(--b0); border-radius: var(--r);
          color: var(--tp); padding: 12px 14px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          transition: all 0.2s; outline: none;
        }
        .field-inp:focus {
          border-color: rgba(200,16,46,0.5); background: var(--s3);
          box-shadow: 0 0 0 3px rgba(200,16,46,0.08);
        }
        .field-inp::placeholder { color: var(--tm); }
        .pw-wrap { position: relative; }
        .pw-wrap .field-inp { padding-right: 42px; }
        .eye-toggle {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; color: var(--tm);
          cursor: pointer; padding: 2px;
          display: flex; align-items: center; transition: color 0.2s;
        }
        .eye-toggle:hover { color: var(--ts); }
        .field-count { font-size: 11px; color: var(--tm); text-align: right; margin-top: 3px; }

        /* Captcha */
        .captcha-box {
          background: var(--s2); border: 1px solid var(--b0);
          border-radius: var(--r); padding: 12px;
          display: flex; justify-content: center; margin-bottom: 14px;
        }

        /* Divider */
        .divider { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
        .div-line { flex: 1; height: 1px; background: var(--b0); }
        .div-txt { font-size: 11px; color: var(--tm); text-transform: uppercase; letter-spacing: 0.06em; }

        /* Buttons */
        .btn-main {
          width: 100%; background: var(--red); border: none;
          border-radius: var(--r); color: white; padding: 13px;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center;
          justify-content: center; gap: 8px;
        }
        .btn-main:hover:not(:disabled) {
          background: var(--red-h); transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(200,16,46,0.3);
        }
        .btn-main:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-google {
          width: 100%; background: var(--s2); border: 1px solid var(--b0);
          border-radius: var(--r); color: var(--tp); padding: 12px;
          font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center;
          justify-content: center; gap: 9px;
        }
        .btn-google:hover:not(:disabled) {
          background: var(--s3); border-color: var(--b1); transform: translateY(-1px);
        }
        .btn-google:disabled { opacity: 0.55; cursor: not-allowed; }
        .g-badge {
          font-size: 10px; color: var(--tm);
          background: var(--s3); border: 1px solid var(--b0);
          border-radius: 6px; padding: 2px 7px; margin-left: auto;
        }

        .spin {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: white; border-radius: 50%;
          animation: spinning 0.7s linear infinite; flex-shrink: 0;
        }
        .spin-dark {
          width: 15px; height: 15px;
          border: 2px solid var(--b1); border-top-color: var(--ts);
          border-radius: 50%;
          animation: spinning 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spinning { to { transform: rotate(360deg); } }

        .login-note {
          margin-top: 16px; padding-top: 16px;
          border-top: 1px solid var(--b0);
          font-size: 11px; color: var(--tm);
          text-align: center; line-height: 1.6;
        }

        @media (max-width: 860px) {
          .lr-left { display: none; }
          .lr-right { width: 100%; min-width: unset; border-left: none; padding: 32px 24px; }
        }
      `}</style>

      {/* ── LEFT ── */}
      <div className="lr-left">
        <div className="lr-grid" />
        <div className="lr-left-inner">
          <h1 className="left-tagline">
            Your <em>academic</em><br />
            journey starts<br />
            here.
          </h1>
          <p className="left-desc">
            {t('loginHeroDesc', 'Access the FIU Guidance System to manage your academic requests, track approvals, and stay connected with your advisors.')}
          </p>
          <div className="left-features">
            <div className="left-feature">
              <div className="feature-dot" />
              {t('featureRequests', 'Submit and track guidance requests')}
            </div>
            <div className="left-feature">
              <div className="feature-dot" />
              {t('featureApprovals', 'Real-time approval notifications')}
            </div>
            <div className="left-feature">
              <div className="feature-dot" />
              {t('featureMultilang', 'Available in 5 languages')}
            </div>
          </div>
        </div>
        <div className="lr-copyright">© 2025 Final International University</div>
      </div>

      {/* ── RIGHT ── */}
      <div className="lr-right">

        {/* Logo — centered, stacked */}
        <div className="right-logo">
          <div className="right-logo-box">
            <FIULogo size="sm" />
          </div>
          <span className="right-logo-university">Final International University</span>
          <span className="right-logo-appname">{t('guidanceRequestSystem', 'Guidance Request System')}</span>
        </div>

        {/* Lang */}
        <div className="lang-wrap" ref={langDropdownRef}>
          <button
            type="button"
            className="lang-btn-el"
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
          >
            <span>{currentLang?.name || 'English'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points={isLangDropdownOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
            </svg>
          </button>
          {isLangDropdownOpen && (
            <div className="lang-menu">
              {Object.entries(languages).map(([code, lang]) => (
                <button
                  key={code}
                  type="button"
                  className={`lang-item-el ${currentLanguage === code ? 'active' : ''}`}
                  onClick={() => { changeLanguage(code); setIsLangDropdownOpen(false); }}
                >
                  <span>{lang.name}</span>
                  {currentLanguage === code && <div className="lang-check" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="err-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-lbl">{t('email', 'Email')}</label>
            <input
              type="email" name="email" className="field-inp"
              placeholder={t('enterYourEmail', 'your@email.com')}
              value={formData.email} onChange={handleChange}
              maxLength={100} autoComplete="email" required
            />
            <div className="field-count">{formData.email.length}/100</div>
          </div>

          <div className="field">
            <label className="field-lbl">{t('password', 'Password')}</label>
            <div className="pw-wrap">
              <input
                type={showPassword ? 'text' : 'password'} name="password"
                className="field-inp" placeholder="••••••••"
                value={formData.password} onChange={handleChange}
                maxLength={50} autoComplete="current-password" required
              />
              <button type="button" className="eye-toggle"
                onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <div className="field-count">{formData.password.length}/50</div>
          </div>

          <div className="captcha-box">
            <ReCAPTCHA
              sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY}
              onChange={handleCaptchaChange}
              theme="dark"
            />
          </div>

          <button type="submit" className="btn-main" disabled={loading}>
            {loading
              ? <><div className="spin" />{t('signingIn', 'Signing in...')}</>
              : t('signin', 'Sign In')
            }
          </button>
        </form>

        <div className="divider">
          <div className="div-line" />
          <span className="div-txt">{t('or', 'or')}</span>
          <div className="div-line" />
        </div>

        <button type="button" className="btn-google" onClick={handleGoogleLogin} disabled={googleLoading}>
          {googleLoading ? (
            <><div className="spin-dark" />{t('redirecting', 'Redirecting...')}</>
          ) : (
            <>
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t('signInWithGoogle', 'Continue with Google')}
              <span className="g-badge">@final.edu.tr</span>
            </>
          )}
        </button>

        <div className="login-note">
          {t('googleLoginNote', 'Google sign-in is for students with an active @final.edu.tr account. Administrators must use email & password.')}
        </div>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;