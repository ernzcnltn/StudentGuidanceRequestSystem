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
  const [activeTab, setActiveTab] = useState('student');
  const [studentFormData, setStudentFormData] = useState({
    student_number: '',
    password: ''
  });
  const [adminFormData, setAdminFormData] = useState({
    username: '',
    password: ''
  });
  
  const [studentLoading, setStudentLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [studentError, setStudentError] = useState(null);
  const [adminError, setAdminError] = useState(null);

  const handleStudentChange = (e) => {
    setStudentFormData({
      ...studentFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleAdminChange = (e) => {
    setAdminFormData({
      ...adminFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setStudentLoading(true);
    setStudentError(null);

    const result = await studentLogin(studentFormData.student_number, studentFormData.password);

    if (result.success) {
      navigate('/');
    } else {
      setStudentError(result.error);
    }

    setStudentLoading(false);
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError(null);

    const result = await adminLogin(adminFormData.username, adminFormData.password);

    if (result.success) {
      navigate('/admin/dashboard');
    } else {
      setAdminError(result.error);
    }

    setAdminLoading(false);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setStudentError(null);
    setAdminError(null);
  };

  const LoginLanguageSelector = () => {
    return (
      <div className="d-flex justify-content-center gap-2 mb-3">
        {Object.entries(languages).map(([code, lang]) => (
          <button
            key={code}
            className={`btn btn-sm ${
              currentLanguage === code ? 'btn-danger' : 'btn-outline-danger'
            }`}
            onClick={() => changeLanguage(code)}
            title={lang.name}
            style={{ 
              fontSize: '12px', 
              padding: '6px 10px',
              borderRadius: '20px',
              minWidth: '45px'
            }}
          >
            {lang.flag}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-vh-100 d-flex">
      {/* Left Side - Image */}
      <div 
        className="d-none d-lg-flex col-lg-6"
        style={{ 
          backgroundImage: 'url("/images/fiu-logo-red.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative'
        }}
      >
        {/* Overlay with gradient */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          //  background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.9) 0%, rgba(185, 28, 28, 0.9) 100%)',
            display: 'flex',
           // border: '2px solid red',
           // boxShadow: '2px 4px 20px 5px rgba(52, 14, 14, 1)',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '2rem'
          }}
        >

        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center p-4 bg-light " > 
          

        <div className="w-100" style={{ maxWidth: '450px' }}>
          {/* Dark Mode Toggle */}
          <DarkModeToggle />
          
           {/* Logo - HEM MOBİL HEM DESKTOP */}
    <div className="text-center mb-4">
      <div className="mb-3">
        <FIULogo size=" xl " />
      </div>
      <h1 className="text-danger fw-bold d-lg-none">FIU</h1> {/* Sadece mobilde yazı */}
      <p className="text-muted d-lg-none">Guidance System</p> {/* Sadece mobilde yazı */}
    </div>
          {/* Language Selector */}
          <LoginLanguageSelector />

          {/* Tab Navigation */}
          <ul className="nav nav-tabs nav-justified mb-4">
            <li className="nav-item">
              <button
                className={`nav-link border-0 fw-semibold ${activeTab === 'student' ? 'active' : ''}`}
                onClick={() => switchTab('student')}
                style={{
                  backgroundColor: activeTab === 'student' ? '#dc2626' : '#f8f9fa',
                  color: activeTab === 'student' ? 'white' : '#dc2626',
                  borderRadius: '8px 8px 0 0',
                  padding: '12px',
                  transition: 'all 0.3s ease'
                }}
              >
                {t('studentLogin', 'Student Login')}
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link border-0 fw-semibold ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => switchTab('admin')}
                style={{
                  backgroundColor: activeTab === 'admin' ? '#dc2626' : '#f8f9fa',
                  color: activeTab === 'admin' ? 'white' : '#dc2626',
                  borderRadius: '8px 8px 0 0',
                  padding: '12px',
                  transition: 'all 0.3s ease'
                }}
              >
                {t('adminLogin', 'Admin Login')}
              </button>
            </li>
          </ul>

          {/* Tab Content */}
          {activeTab === 'student' ? (
            <div>
              <div className="text-center mb-4">
                <h4 className="text-danger">{t('studentPortal')}</h4>
                <p className="text-muted">{t('submitAndTrack')}</p>
              </div>

              {studentError && (
                <div className="alert alert-danger" role="alert">
                  {studentError}
                </div>
              )}

              <form onSubmit={handleStudentSubmit}>
                <div className="mb-3">
                  <label htmlFor="student_number" className="form-label fw-semibold">
                    {t('studentNumber')}
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="student_number"
                    name="student_number"
                    value={studentFormData.student_number}
                    onChange={handleStudentChange}
                    placeholder={t('enterYourStudentNumber', 'Enter your student number')}
                    style={{ borderRadius: '8px' }}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="student_password" className="form-label fw-semibold">
                    {t('password')}
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="student_password"
                    name="password"
                    value={studentFormData.password}
                    onChange={handleStudentChange}
                    placeholder={t('enterYourPassword', 'Enter your password')}
                    style={{ borderRadius: '8px' }}
                    required
                  />
                </div>

                <div className="d-grid">
                  <button
                    type="submit"
                    className="btn btn-danger btn-lg"
                    style={{ borderRadius: '8px' }}
                    disabled={studentLoading}
                  >
                    {studentLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {t('signingIn')}...
                      </>
                    ) : (
                      t('signin') + ' ' + t('asStudent', 'as Student')
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-4">
                <div className="card border-0" style={{ borderRadius: '8px' }}>
                  <div className="card-body">
                    <h6 className="card-title text-danger">🔐 Test Student Account:</h6>
                    <small className="text-muted">
                      <strong>Student Number:</strong> 20210001<br/>
                      <strong>Password:</strong> 123456
                    </small>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-center mb-4">
                <h4 className="text-danger">{t('adminPortal')}</h4>
                <p className="text-muted">{t('departmentAdministratorAccess', 'Department administrator access')}</p>
              </div>

              {adminError && (
                <div className="alert alert-danger" role="alert">
                  {adminError}
                </div>
              )}

              <form onSubmit={handleAdminSubmit}>
                <div className="mb-3">
                  <label htmlFor="admin_username" className="form-label fw-semibold">
                    {t('username')}
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="admin_username"
                    name="username"
                    value={adminFormData.username}
                    onChange={handleAdminChange}
                    placeholder={t('enterYourUsername', 'Enter your username')}
                    style={{ borderRadius: '8px' }}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="admin_password" className="form-label fw-semibold">
                    {t('password')}
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="admin_password"
                    name="password"
                    value={adminFormData.password}
                    onChange={handleAdminChange}
                    placeholder={t('enterYourPassword', 'Enter your password')}
                    style={{ borderRadius: '8px' }}
                    required
                  />
                </div>

                <div className="d-grid">
                  <button
                    type="submit"
                    className="btn btn-danger btn-lg"
                    style={{ borderRadius: '8px' }}
                    disabled={adminLoading}
                  >
                    {adminLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {t('signingIn')}...
                      </>
                    ) : (
                      t('signin') + ' ' + t('asAcademic')
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-4">
                <div className="card border-0" style={{ borderRadius: '8px' }}>
                  <div className="card-body">
                    <h6 className="card-title text-danger">🔐 Test Admin Accounts:</h6>
                    <div className="row">
                      <div className="col-md-6">
                        <small className="text-muted">
                          <strong>📊 Accounting:</strong> accounting_admin<br/>
                          <strong>📚 Academic:</strong> academic_admin<br/>
                          <strong>🏠 Dormitory:</strong> dormitory_admin
                        </small>
                      </div>
                      <div className="col-md-6">
                        <small className="text-muted">
                          <strong>👥 Student Affairs:</strong> student_affairs_admin<br/>
                          <strong>🏢 Campus Services:</strong> campus_services_admin<br/>
                          <strong>🔑 All passwords:</strong> admin123
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;