import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguage } from '../contexts/LanguageContext';
import { apiService } from '../services/api';
import FIULogo from '../components/FIULogo';

// Fakülte → Program eşleştirmesi
const FACULTY_PROGRAMS = {
  'Faculty of Engineering': [
    'Computer Engineering',
    'Electrical and Electronics Engineering',
    'Civil Engineering',
    'Mechanical Engineering',
    'Industrial Engineering',
    'Software Engineering',
    'Biomedical Engineering',
  ],
  'Faculty of Economics and Administrative Sciences': [
    'Business Administration',
    'Economics',
    'International Relations',
    'Public Administration',
    'Finance and Banking',
  ],
  'Faculty of Communication': [
    'Journalism',
    'Public Relations and Advertising',
    'Radio, Television and Cinema',
    'Visual Communication Design',
  ],
  'Faculty of Education': [
    'English Language Teaching',
    'Pre-School Teaching',
    'Primary School Teaching',
    'Psychological Counseling and Guidance',
  ],
  'Faculty of Fine Arts and Design': [
    'Graphic Design',
    'Interior Architecture and Environmental Design',
    'Fashion and Textile Design',
  ],
  'Faculty of Arts and Sciences': [
    'Psychology',
    'Sociology',
    'English Language and Literature',
    'Turkish Language and Literature',
    'Mathematics',
  ],
  'Faculty of Dentistry': ['Dentistry'],
  'Faculty of Law': ['Law'],
  'Faculty of Medicine': ['Medicine'],
  'Faculty of Pharmacy': ['Pharmacy'],
  'Faculty of Health Sciences': [
    'Nursing',
    'Physiotherapy and Rehabilitation',
    'Nutrition and Dietetics',
    'Health Management',
  ],
  'Faculty of Sports Sciences': [
    'Sports Management',
    'Coaching Education',
    'Physical Education and Sports Teaching',
  ],
  'Faculty of Architecture': [
    'Architecture',
    'Urban and Regional Planning',
  ],
};

const FACULTIES = Object.keys(FACULTY_PROGRAMS);

const GoogleRegister = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  const email    = searchParams.get('email')    || '';
  const googleId = searchParams.get('googleId') || '';
  const name     = searchParams.get('name')     || '';

  const [studentNumber, setStudentNumber] = useState('');
  const [faculty, setFaculty]             = useState('');
  const [program, setProgram]             = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [mounted, setMounted]             = useState(false);
  const [isLangOpen, setIsLangOpen]       = useState(false);

  const langRef = useRef(null);

  const availablePrograms = faculty ? FACULTY_PROGRAMS[faculty] || [] : [];

  useEffect(() => {
    if (!email || !googleId) { navigate('/login'); return; }
    setMounted(true);
  }, [email, googleId, navigate]);

  useEffect(() => {
    if (!isLangOpen) return;
    const handler = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setIsLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isLangOpen]);

  // Fakülte değişince programı sıfırla
  const handleFacultyChange = (val) => {
    setFaculty(val);
    setProgram('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!studentNumber.trim()) {
      setError(t('studentNumberRequired', 'Student number is required.'));
      return;
    }
    if (!faculty) {
      setError(t('pleaseSelect') + ' ' + t('faculty', 'Faculty'));
      return;
    }
    if (!program) {
      setError(t('pleaseSelect') + ' ' + t('program', 'Program'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.registerWithGoogle({
        email,
        googleId,
        name,
        student_number: studentNumber.trim(),
        faculty,
        program,
      });

      if (response.data.success) {
        const { token } = response.data.data;
        await loginWithToken(token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || t('magicLinkFailed', 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  // ── Styles ──────────────────────────────────────────────
  const inputStyle = {
    width: '100%',
    background: '#18181F',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    color: '#F2F2F7',
    padding: '13px 16px',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(242,242,247,0.35)',
    marginBottom: '7px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };

  const fieldWrap = { marginBottom: '14px', position: 'relative' };

  // Chevron icon for select
  const chevronStyle = {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: 'rgba(242,242,247,0.3)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gr-card { animation: fadeUp 0.45s ease; }
        .gr-input:focus {
          border-color: rgba(200,16,46,0.5) !important;
          background: #1F1F28 !important;
          box-shadow: 0 0 0 3px rgba(200,16,46,0.08) !important;
        }
        .gr-input::placeholder { color: rgba(242,242,247,0.2); }
        .gr-input option { background: #1F1F28; color: #F2F2F7; }
        .gr-btn {
          width: 100%;
          background: #C8102E;
          border: none;
          border-radius: 12px;
          color: white;
          padding: 14px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
        }
        .gr-btn:hover:not(:disabled) {
          background: #E8233F;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(200,16,46,0.3);
        }
        .gr-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .gr-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .lang-item:hover { background: rgba(255,255,255,0.05) !important; }
      `}</style>

      {/* Ambient glow — login ile aynı */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(200,16,46,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(200,16,46,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Language picker — sağ üst */}
      <div ref={langRef} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 100 }}>
        <button
          onClick={() => setIsLangOpen(p => !p)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            color: '#F2F2F7',
            padding: '8px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'inherit',
          }}
        >
          <i className="bi bi-globe2" style={{ fontSize: '14px' }} />
          {languages?.[currentLanguage]?.name || currentLanguage}
          <i className="bi bi-chevron-down" style={{ fontSize: '11px', opacity: 0.5 }} />
        </button>

        {isLangOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: '#16161C',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            overflow: 'hidden',
            minWidth: '140px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}>
            {languages && Object.entries(languages).map(([code, lang]) => (
              <button
                key={code}
                className="lang-item"
                onClick={() => { changeLanguage(code); setIsLangOpen(false); }}
                style={{
                  width: '100%',
                  background: currentLanguage === code ? 'rgba(200,16,46,0.1)' : 'transparent',
                  border: 'none',
                  color: currentLanguage === code ? '#FF8A96' : '#F2F2F7',
                  padding: '10px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card */}
      <div className="gr-card" style={{
        width: '100%',
        maxWidth: '460px',
        background: '#16161C',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '54px', height: '54px',
            background: 'linear-gradient(135deg, #C8102E, #8B0A1E)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 10px 28px rgba(200,16,46,0.4)',
          }}>
            <FIULogo size="sm" />
          </div>
          <h2 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '22px',
            color: '#F2F2F7',
            margin: '0 0 6px',
            letterSpacing: '-0.01em',
          }}>
            {t('completeRegistration', 'Complete Registration')}
          </h2>
          <p style={{ color: 'rgba(242,242,247,0.4)', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
            {t('googleVerifiedContinue', 'Google account verified. Fill in your details to continue.')}
          </p>
        </div>

        {/* Google account pill */}
        <div style={{
          background: '#1A1A22',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'rgba(242,242,247,0.3)', fontSize: '10px', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Google Account
            </p>
            <p style={{ color: '#F2F2F7', fontSize: '13px', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name && <span style={{ color: 'rgba(242,242,247,0.7)', marginRight: '6px' }}>{name}</span>}
              {email}
            </p>
          </div>
          <div style={{
            width: '8px', height: '8px',
            background: '#22C55E',
            borderRadius: '50%',
            flexShrink: 0,
            boxShadow: '0 0 6px rgba(34,197,94,0.6)',
          }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(200,16,46,0.08)',
            border: '1px solid rgba(200,16,46,0.2)',
            borderRadius: '10px',
            padding: '11px 14px',
            marginBottom: '16px',
            color: '#FF8A96',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <i className="bi bi-exclamation-circle" style={{ flexShrink: 0, marginTop: '1px' }} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Student Number */}
          <div style={fieldWrap}>
            <label style={labelStyle}>{t('studentNumber', 'Student Number')}</label>
            <input
              type="text"
              className="gr-input"
              style={inputStyle}
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="e.g. 20200001"
              maxLength={20}
              required
            />
          </div>

          {/* Faculty */}
          <div style={fieldWrap}>
            <label style={labelStyle}>{t('faculty', 'Faculty')}</label>
            <div style={{ position: 'relative' }}>
              <select
                className="gr-input"
                style={{ ...inputStyle, paddingRight: '38px', cursor: 'pointer' }}
                value={faculty}
                onChange={(e) => handleFacultyChange(e.target.value)}
                required
              >
                <option value="">{t('pleaseSelect', 'Please select')}...</option>
                {FACULTIES.map(f => (
                  <option key={f} value={f}>
                    {t(`facultyNames.${f}`, f)}
                  </option>
                ))}
              </select>
              <span style={chevronStyle}>
                <i className="bi bi-chevron-down" style={{ fontSize: '12px' }} />
              </span>
            </div>
          </div>

          {/* Program */}
          <div style={fieldWrap}>
            <label style={labelStyle}>{t('program', 'Program')}</label>
            <div style={{ position: 'relative' }}>
              <select
                className="gr-input"
                style={{
                  ...inputStyle,
                  paddingRight: '38px',
                  cursor: faculty ? 'pointer' : 'not-allowed',
                  opacity: faculty ? 1 : 0.45,
                }}
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                disabled={!faculty}
                required
              >
                <option value="">
                  {faculty
                    ? `${t('pleaseSelect', 'Please select')}...`
                    : t('selectFacultyFirst', 'Select faculty first')}
                </option>
               {availablePrograms.map(p => (
  <option key={p} value={p}>
    {t(`programNames.${p}`, p)}
  </option>
))}
              </select>
              <span style={chevronStyle}>
                <i className="bi bi-chevron-down" style={{ fontSize: '12px' }} />
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '6px 0 18px' }} />

          {/* Submit */}
          <button type="submit" className="gr-btn" disabled={loading}>
            {loading ? (
              <><div className="gr-spinner" />{t('sending', 'Processing')}...</>
            ) : (
              <>{t('completeRegistration', 'Complete Registration')} <i className="bi bi-arrow-right" /></>
            )}
          </button>
        </form>

        {/* Footer note */}
        <p style={{
          textAlign: 'center',
          color: 'rgba(242,242,247,0.2)',
          fontSize: '12px',
          marginTop: '20px',
          lineHeight: 1.7,
        }}>
          {t('whitelistNote', 'Your student number must be in the active student list.')}
          <br />
          {t('contactDepartment', 'If you have issues, contact your department.')}
        </p>
      </div>
    </div>
  );
};

export default GoogleRegister;