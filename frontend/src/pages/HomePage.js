import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';

const HomePage = () => {
  const { t, translateRequestType } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [requestTypes, setRequestTypes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Request Types
        const typesResponse = await apiService.getRequestTypes();
        setRequestTypes(typesResponse.data.data);

        // Otomatik olarak student istatistikleri al
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

  // Kategori tıklama fonksiyonu
  const handleCategoryClick = (category) => {
    navigate('/create-request', { 
      state: { 
        selectedCategory: category
      } 
    });
  };

  // Kategori ikonları
  const getCategoryIcon = (category) => {
    const icons = {
      'Accounting': ' 💼',
      'Academic': '🔬',
      'Student Affairs': '👥',
      'Dormitory': '🛏️',
      'Campus Services': '⚙️',
     'Sport Affairs': '🥇',
    };
    return icons[category] || '📋';
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">{t('loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <div className="jumbotron bg-primary text-white p-5 rounded mb-4">
        <h1 className="display-4">{t('welcome')} {t('systemTitle')}</h1>
        <p className="lead">
          {t('studentPortal')} - {t('submitAndTrack')}
        </p>
        <Link className="btn btn-light btn-lg" to="/create-request">
          {t('createRequest')}
        </Link>
      </div>

      {/* Request Categories */}
      <div className="row">
        <div className="col-md-8">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3>{t('requestType')} {t('categories')}</h3>
            <small className="text-muted">
             
            </small>
          </div>
          
          <div className="row">
            {Object.keys(requestTypes).map((category) => (
              <div key={category} className="col-md-6 mb-3">
                <div 
                  className="card h-100 category-card"
                  style={{ 
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => handleCategoryClick(category)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                  }}
                >
                  <div className="card-header d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="me-2" style={{ fontSize: '1.5rem' }}>
                        {getCategoryIcon(category)}
                      </span>
                      <h5 className="mb-0">
                        {t(category.toLowerCase().replace(/\s+/g, ''))}
                      </h5>
                    </div>
                    <span className="badge bg-primary">
                      {requestTypes[category].length}
                    </span>
                  </div>
                  <div className="card-body">
                    <ul className="list-unstyled" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {requestTypes[category].map((type) => (
                        <li key={type.type_id} className="mb-1">
                          <span className="me-2 text-primary">•</span>
                          {translateRequestType(type.type_name)}
                        </li>
                      ))}
                    </ul>
                    
                    <div className="mt-3 pt-2 border-top">
                      <small className="text-muted d-flex align-items-center justify-content-between">
                        <span>
                          <span className="me-2">👆</span>
                          Hızlı talep oluştur
                        </span>
                        <span className="text-primary">→</span>
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="col-md-4">
          <h3>{t('quickActions')}</h3>
          <div className="list-group mb-4">
            <Link to="/create-request" className="list-group-item list-group-item-action">
              <div className="d-flex align-items-center">
                <span className="me-3" style={{ fontSize: '1.5rem' }}>📝</span>
                <div>
                  <h6 className="mb-1">{t('createRequest')}</h6>
                  <p className="mb-1 small text-muted">{t('submitNewRequest')}</p>
                </div>
              </div>
            </Link>
            <Link to="/requests" className="list-group-item list-group-item-action">
              <div className="d-flex align-items-center">
                <span className="me-3" style={{ fontSize: '1.5rem' }}>📋</span>
                <div>
                  <h6 className="mb-1">{t('myRequests')}</h6>
                  <p className="mb-1 small text-muted">{t('checkStatus')}</p>
                </div>
              </div>
            </Link>
          </div>

          {/* User Stats Card */}
          {stats && (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">📊 İstatistikleriniz</h5>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-6">
                    <div className="h5 text-warning">{stats.pending_requests || 0}</div>
                    <small className="text-muted">{t('pending')}</small>
                  </div>
                  <div className="col-6">
                    <div className="h5 text-info">{stats.informed_requests || 0}</div>
                    <small className="text-muted">{t('informed')}</small>
                  </div>
                </div>
                <div className="row text-center mt-2">
                  <div className="col-6">
                    <div className="h5 text-success">{stats.completed_requests || 0}</div>
                    <small className="text-muted">{t('completed')}</small>
                  </div>
                  <div className="col-6">
                    <div className="h4 text-primary">{stats.total_requests || 0}</div>
                    <small className="text-muted">{t('totalRequests')}</small>
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

export default HomePage;