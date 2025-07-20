import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    student_number: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

    const result = await login(formData.student_number, formData.password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow">
              <div className="card-body p-5">
                <div className="text-center mb-4">
                  <h2 className="text-primary">🎓 FIU Guidance System</h2>
                  <p className="text-muted">Student Portal Login</p>
                </div>

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="student_number" className="form-label">
                      Student Number
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="student_number"
                      name="student_number"
                      value={formData.student_number}
                      onChange={handleChange}
                      placeholder="Enter your student number"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      required
                    />
                  </div>

                  <div className="d-grid">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Signing In...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </button>
                  </div>
                </form>

                <hr className="my-4" />

                <div className="text-center">
                  <p className="text-muted mb-2">Don't have an account?</p>
                  <Link to="/register" className="btn btn-outline-secondary">
                    Create Account
                  </Link>
                </div>

                {/* DÜZELTME: Admin paneli için ayrı link */}
                <div className="text-center mt-3">
                  <Link to="/admin/login" className="btn btn-outline-dark btn-sm">
                    🏢 Admin Panel
                  </Link>
                </div>

                <div className="mt-4">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6 className="card-title">Test Student Account:</h6>
                      <small className="text-muted">
                        <strong>Student Number:</strong> 20210001<br/>
                        <strong>Password:</strong> 123456
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;