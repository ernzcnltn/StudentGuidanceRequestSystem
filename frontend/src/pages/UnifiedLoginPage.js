import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import DarkModeToggle from '../components/DarkModeToggle'; // YENİ EKLENEN

const UnifiedLoginPage = () => {
  const navigate = useNavigate();
  const { login: studentLogin } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  
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

  return (
     <div className="min-vh-100 d-flex align-items-center" 
       style={{ 
         background: 'linear-gradient(135deg, #dc2626 0%, #1e40af 100%)',
         position: 'relative'
       }}>
      {/* Background Pattern */}
       <DarkModeToggle />
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}
      />
      
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="card-body p-0">
                {/* Header */}
                <div 
                  className="text-center p-4 text-white"
                  style={{ 
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    borderRadius: '16px 16px 0 0'
                  }}
                >
                  <h2 className="mb-1 fw-bold">🎓 FIU Guidance System</h2>
                  <p className="mb-0 opacity-90">Final International University</p>
                </div>

                {/* Tab Navigation */}
                <div className="p-4 pb-0">
                  <ul className="nav nav-tabs nav-justified border-0">
                    <li className="nav-item">
                      <button
                        className={`nav-link border-0 fw-semibold ${activeTab === 'student' ? 'active' : ''}`}
                        onClick={() => switchTab('student')}
                        style={{
                          backgroundColor: activeTab === 'student' ? '#dc2626' : 'transparent',
                          color: activeTab === 'student' ? 'white' : '#dc2626',
                          borderRadius: '8px'
                        }}
                      >
                        👨‍🎓 Student Login
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link border-0 fw-semibold ${activeTab === 'admin' ? 'active' : ''}`}
                        onClick={() => switchTab('admin')}
                        style={{
                          backgroundColor: activeTab === 'admin' ? '#dc2626' : 'transparent',
                          color: activeTab === 'admin' ? 'white' : '#dc2626',
                          borderRadius: '8px'
                        }}
                      >
                        👨‍💼 Admin Login
                      </button>
                    </li>
                  </ul>
                </div>

                {/* Tab Content */}
                <div className="p-4">
                  {activeTab === 'student' ? (
                    <div>
                      <div className="text-center mb-4">
                        <h4 className="text-primary">Student Portal</h4>
                        <p className="text-muted">Submit and track your guidance requests</p>
                      </div>

                      {studentError && (
                        <div className="alert alert-danger" role="alert">
                          {studentError}
                        </div>
                      )}

                      <form onSubmit={handleStudentSubmit}>
                        <div className="mb-3">
                          <label htmlFor="student_number" className="form-label fw-semibold">
                            Student Number
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            id="student_number"
                            name="student_number"
                            value={studentFormData.student_number}
                            onChange={handleStudentChange}
                            placeholder="Enter your student number"
                            style={{ borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div className="mb-4">
                          <label htmlFor="student_password" className="form-label fw-semibold">
                            Password
                          </label>
                          <input
                            type="password"
                            className="form-control form-control-lg"
                            id="student_password"
                            name="password"
                            value={studentFormData.password}
                            onChange={handleStudentChange}
                            placeholder="Enter your password"
                            style={{ borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div className="d-grid">
                          <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{ borderRadius: '8px' }}
                            disabled={studentLoading}
                          >
                            {studentLoading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Signing In...
                              </>
                            ) : (
                              '👨‍🎓 Sign In as Student'
                            )}
                          </button>
                        </div>
                      </form>

                      <hr className="my-4" />

                      <div className="text-center">
                        <p className="text-muted mb-2">Don't have an account?</p>
                        <button 
                          className="btn btn-outline-primary"
                          style={{ borderRadius: '8px' }}
                          onClick={() => navigate('/register')}
                        >
                          Create Student Account
                        </button>
                      </div>

                      <div className="mt-4">
                        <div className="card bg-light border-0" style={{ borderRadius: '8px' }}>
                          <div className="card-body">
                            <h6 className="card-title text-primary">📝 Test Student Account:</h6>
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
                        <h4 className="text-primary">Admin Portal</h4>
                        <p className="text-muted">Department administrator access</p>
                      </div>

                      {adminError && (
                        <div className="alert alert-danger" role="alert">
                          {adminError}
                        </div>
                      )}

                      <form onSubmit={handleAdminSubmit}>
                        <div className="mb-3">
                          <label htmlFor="admin_username" className="form-label fw-semibold">
                            Username
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            id="admin_username"
                            name="username"
                            value={adminFormData.username}
                            onChange={handleAdminChange}
                            placeholder="Enter your username"
                            style={{ borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div className="mb-4">
                          <label htmlFor="admin_password" className="form-label fw-semibold">
                            Password
                          </label>
                          <input
                            type="password"
                            className="form-control form-control-lg"
                            id="admin_password"
                            name="password"
                            value={adminFormData.password}
                            onChange={handleAdminChange}
                            placeholder="Enter your password"
                            style={{ borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div className="d-grid">
                          <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{ borderRadius: '8px' }}
                            disabled={adminLoading}
                          >
                            {adminLoading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Signing In...
                              </>
                            ) : (
                              '👨‍💼 Sign In as Admin'
                            )}
                          </button>
                        </div>
                      </form>

                      <div className="mt-4">
                        <div className="card bg-light border-0" style={{ borderRadius: '8px' }}>
                          <div className="card-body">
                            <h6 className="card-title text-primary">🔑 Test Admin Accounts:</h6>
                            <div className="row">
                              <div className="col-md-6">
                                <small className="text-muted">
                                  <strong>💰 Accounting:</strong> accounting_admin<br/>
                                  <strong>📚 Academic:</strong> academic_admin<br/>
                                  <strong>🏠 Dormitory:</strong> dormitory_admin
                                </small>
                              </div>
                              <div className="col-md-6">
                                <small className="text-muted">
                                  <strong>👥 Student Affairs:</strong> student_affairs_admin<br/>
                                  <strong>🏢 Campus Services:</strong> campus_services_admin<br/>
                                  <strong>🔒 All passwords:</strong> admin123
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;