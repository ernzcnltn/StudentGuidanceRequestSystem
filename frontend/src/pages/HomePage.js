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
  const { logout, user } = useAuth();

  const handleLogoutClick = async () => {
    console.log('Student logout button clicked!');
    
    const confirmed = await showConfirmation({
      title: t('logoutConfirmation'),
      message: t('logoutConfirmationMessage'),
      type: 'danger',
      confirmText: t('logout'),
      cancelText: t('cancel')
    });

    if (confirmed) {
      console.log('Student logout confirmed');
      logout();
    }
  };

  // Notification click handler - öğrenciyi ilgili talebe yönlendirir
  const handleNotificationClick = (requestId, type) => {
    console.log('Student notification clicked:', { requestId, type });
    
    if (requestId) {
      // Öğrenciyi "My Requests" sayfasına yönlendir ve ilgili talebi vurgula
      navigate('/my-requests', { 
        state: { 
          highlightRequestId: requestId,
          fromNotification: true 
        } 
      });
    } else {
      // Eğer requestId yoksa genel talep sayfasına yönlendir
      navigate('/my-requests');
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
       // const statsResponse = await apiService.getMyStats();
        //setStats(statsResponse.data.data);

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
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-3">{t('loading')}...</p>
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
            : 'linear-gradient(135deg, #2d3748  0%, #1a202c 100%)',
          color: '#ffffff'
        }}
      >
        <h1 className="display-4">{t('welcome_to_student_portal')}</h1>
        <p className="lead">
          {t('submit_and_track_efficiently')}
        </p>
        <Link className="btn btn-light btn-lg" to="/create-request">
          {t('createRequest')}
        </Link>
      </div>

      {/* Request Categories */}
      <div className="row">
        <div className="col-md-8">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className={isDark ? 'text-white' : 'text-dark'}>{t('request_categories')}</h3>
            <small className={isDark ? 'text-gray-400' : 'text-muted'}>
              {t('click_on_category_to_create')}
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
                        className={`${getCategoryIcon(category)} me-2`}
                        style={{ fontSize: '1.5rem', color: '#dc2626' }}
                      ></i>
                      <h5 className="mb-0">
                        {t(category.toLowerCase().replace(/\s+/g, ''))}
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
                          {t('click_to_create_request')}
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
          {/* User Stats Card */}
          {stats && (
            <div 
              className="card sticky-top"
              style={{
                backgroundColor: isDark ? '#2d3748' : '#ffffff',
                borderColor: isDark ? '#4a5568' : '#e2e8f0',
                color: isDark ? '#ffffff' : '#000000',
                top: '20px'
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
                  {t('your_statistics')}
                </h5>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-6">
                    <div className="h5 text-warning">{stats.pending_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>{t('pending')}</small>
                  </div>
                  <div className="col-6">
                    <div className="h5 text-info">{stats.informed_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>{t('informed')}</small>
                  </div>
                </div>
                <div className="row text-center mt-2">
                  <div className="col-6">
                    <div className="h5 text-success">{stats.completed_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>{t('completed')}</small>
                  </div>
                  <div className="col-6">
                    <div className="h4 text-danger">{stats.total_requests || 0}</div>
                    <small className={isDark ? 'text-gray-400' : 'text-muted'}>{t('totalRequests')}</small>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="border-top mt-3 pt-3" style={{
                  borderColor: isDark ? '#4a5568' : '#e2e8f0'
                }}>
                  <h6 className="mb-2">{t('quick_actions', 'Quick Actions')}</h6>
                  <div className="d-grid gap-2">
                    <Link 
                      to="/create-request" 
                      className="btn btn-outline-danger btn-sm"
                    >
                      <i className="bi bi-plus-circle me-2"></i>
                      {t('new_request', 'New Request')}
                    </Link>
                    <Link 
                      to="/my-requests" 
                      className="btn btn-outline-primary btn-sm"
                    >
                      <i className="bi bi-list-check me-2"></i>
                      {t('my_requests', 'My Requests')}
                    </Link>
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
          
          .sticky-top {
            position: relative !important;
            top: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;