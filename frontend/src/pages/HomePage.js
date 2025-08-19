import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const HomePage = () => {
  const { t, translateRequestType } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [requestTypes, setRequestTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const { confirmationState, showConfirmation } = useConfirmation();
  const { logout } = useAuth();

  const handleLogoutClick = async () => {
    console.log('Student logout button clicked!');
    
    const confirmed = await showConfirmation({
      title: 'Logout Confirmation',
      message: 'Are you sure you want to logout from the student portal?',
      type: 'danger',
      confirmText: 'Logout',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      console.log('Student logout confirmed');
      logout();
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Request Types
        const typesResponse = await apiService.getRequestTypes();
        setRequestTypes(typesResponse.data.data);

        // Student statistics
        const statsResponse = await apiService.getMyStats();
        setStats(statsResponse.data.data);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Category click handler
  const handleCategoryClick = (category) => {
    navigate('/create-request', { 
      state: { 
        selectedCategory: category
      } 
    });
  };

  // Category icons
  const getCategoryIcon = (category) => {
    const icons = {
      'Accounting': 'bi-calculator',
      'Academic': 'bi-book',
      'Student Affairs': 'bi-people',
      'Dormitory': 'bi-building',
      'Campus Services': 'bi-gear',
      'Sport Affairs': 'bi-trophy',
    };
    return icons[category] || 'bi-folder';
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading</span>
        </div>
        <p className="mt-3">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <div 
        className="jumbotron p-5 rounded mb-4"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)'
            : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          color: '#ffffff'
        }}
      >
        <h1 className="display-4">Welcome to Student Portal</h1>
        <p className="lead">
          Submit and track your requests efficiently
        </p>
        <Link className="btn btn-light btn-lg" to="/create-request">
        
          Create Request
        </Link>
      </div>

      {/* Request Categories */}
      <div className="row">
        <div className="col-md-12">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className={isDark ? 'text-white' : 'text-dark'}>Request Categories</h3>
            <small className={isDark ? 'text-gray-400' : 'text-muted'}>
              Click on a category to create a request
            </small>
          </div>
          
          <div className="row">
            {Object.keys(requestTypes).map((category) => (
              <div key={category} className="col-md-6 mb-3">
                <div 
                  className="card h-100 category-card"
                  style={{ 
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    backgroundColor: isDark ? '#2d3748' : '#ffffff',
                    borderColor: isDark ? '#4a5568' : '#e2e8f0',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                  onClick={() => handleCategoryClick(category)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                    e.currentTarget.style.borderColor = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = isDark ? '#4a5568' : '#e2e8f0';
                  }}
                >
                  <div 
                    className="card-header d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                      borderColor: isDark ? '#718096' : '#e2e8f0'
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <i 
                        
                        style={{ fontSize: '1.5rem', color: '#dc2626' }}
                      ></i>
                      <h5 className="mb-0">
                        {category}
                      </h5>
                    </div>
                    <span className="badge bg-danger">
                      {requestTypes[category].length}
                    </span>
                  </div>
                  <div className="card-body">
                    <ul 
                      className="list-unstyled" 
                      style={{ maxHeight: '200px', overflowY: 'auto' }}
                    >
                      {requestTypes[category].map((type) => (
                        <li key={type.type_id} className="mb-1">
                          <span className="me-2 text-danger">•</span>
                          {translateRequestType(type.type_name)}
                        </li>
                      ))}
                    </ul>
                    
                    <div 
                      className="mt-3 pt-2 border-top"
                      style={{
                        borderColor: isDark ? '#4a5568' : '#e2e8f0'
                      }}
                    >
                      <small className={`${isDark ? 'text-gray-400' : 'text-muted'} d-flex align-items-center justify-content-between`}>
                        <span>
                          <i className="bi bi-cursor-fill me-2"></i>
                          Click to create request
                        </span>
                        <i className="bi bi-arrow-right text-danger"></i>
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="col-md-4">
          
          <div className="list-group mb-4">
            
            
          </div>

          {/* User Stats Card */}
          {stats && (
            <div 
              className="card"
              style={{
                backgroundColor: isDark ? '#2d3748' : '#ffffff',
                borderColor: isDark ? '#4a5568' : '#e2e8f0',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <div 
                className="card-header"
                style={{
                  backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                  borderColor: isDark ? '#718096' : '#e2e8f0'
                }}
              >
                <h5 className="mb-0">
                  <i className="bi bi-bar-chart me-2 text-danger"></i>
                  Your Statistics
                </h5>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-6">
                    <div className="h5 text-warning">{stats.pending_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>Pending</small>
                  </div>
                  <div className="col-6">
                    <div className="h5 text-info">{stats.informed_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>Informed</small>
                  </div>
                </div>
                <div className="row text-center mt-2">
                  <div className="col-6">
                    <div className="h5 text-success">{stats.completed_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>Completed</small>
                  </div>
                  <div className="col-6">
                    <div className="h4 text-danger">{stats.total_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>Total</small>
                  </div>
                </div>
              </div>
            </div>
          )}

         
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal {...confirmationState} />

      {/* Custom Styles */}
      <style jsx>{`
        .category-card:hover {
          box-shadow: 0 8px 25px rgba(220, 38, 38, 0.15) !important;
        }
        
        .list-group-item:hover {
          background-color: ${isDark ? '#4a5568' : '#f8f9fa'} !important;
          transform: translateX(5px);
          transition: all 0.2s ease-in-out;
        }
        
        .card {
          border-radius: 12px;
          overflow: hidden;
        }
        
        .btn {
          transition: all 0.2s ease-in-out;
        }
        
        .btn:hover {
          transform: translateY(-2px);
        }
        
        @media (max-width: 768px) {
          .display-4 {
            font-size: 2rem;
          }
          
          .jumbotron {
            padding: 2rem 1rem !important;
          }
          
          .card {
            margin-bottom: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;