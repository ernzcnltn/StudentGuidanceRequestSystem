import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useTranslation } from '../hooks/useTranslation'; // YENİ EKLENEN

const HomePage = () => {
  const { t, translateRequestType } = useTranslation();
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
      setStats(statsResponse.data.data); // backend yapısına göre .data olabilir

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);


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

      {/* Statistics */}
      {stats && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card bg-info text-white">
              <div className="card-body">
                <h5 className="card-title">{t('totalRequests')}</h5>
                <h2>{stats.totals.total_requests}</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-warning text-white">
              <div className="card-body">
                <h5 className="card-title">{t('pending')}</h5>
                <h2>{stats.totals.pending}</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-primary text-white">
              <div className="card-body">
                <h5 className="card-title">{t('informed')}</h5>
                <h2>{stats.totals.informed}</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white">
              <div className="card-body">
                <h5 className="card-title">{t('completed')}</h5>
                <h2>{stats.totals.completed}</h2>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Categories */}
   <div className="row">
        <div className="col-md-8">
          <h3>{t('requestType')} {t('categories')}</h3>
          <div className="row">
            {Object.keys(requestTypes).map((category) => (
              <div key={category} className="col-md-6 mb-3">
                <div className="card">
                  <div className="card-header">
                    <h5 className="mb-0">{t(category.toLowerCase().replace(/\s+/g, ''))}</h5>
                  </div>
                  <div className="card-body">
                    <ul className="list-unstyled">
                      {requestTypes[category].slice(0, 3).map((type) => (
                        <li key={type.type_id} className="mb-1">
                          • {translateRequestType(type.type_name)} {/* BURADA ÇEVİRİ */}
                        </li>
                      ))}
                      {requestTypes[category].length > 3 && (
                        <li className="text-muted">
                          ... {t('andMore')} {requestTypes[category].length - 3} {t('more')}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
        
        <div className="col-md-4">
  <h3>{t('quickActions')}</h3>
  <div className="list-group">
    <Link to="/create-request" className="list-group-item list-group-item-action">
      <h6 className="mb-1">{t('createRequest')}</h6>
      <p className="mb-1">{t('submitNewRequest')}</p>
    </Link>
    <Link to="/requests" className="list-group-item list-group-item-action">
      <h6 className="mb-1">{t('myRequests')}</h6>
      <p className="mb-1">{t('checkStatus')}</p>
    </Link>
    <a href="http://localhost:5000/api/docs" target="_blank" rel="noopener noreferrer" className="list-group-item list-group-item-action">
      <h6 className="mb-1">{t('apiDocumentation')}</h6>
      <p className="mb-1">{t('viewApiDocumentation')}</p>
    </a>
  </div>
  
  <div className="mt-4">
    <h5>{t('guidelines')}</h5>
    <div className="alert alert-info">
      <small>
        • {t('everyDayOneRequest')}<br/>
        • {t('maximumCharacters')}<br/>
        • {t('maximumFiles')}<br/>
        • {t('allowedTypes')}
      </small>
    </div>
  </div>
</div>
      </div>
    </div>
  );
};

export default HomePage;