// frontend/src/components/AdminStatisticsPage.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';

const AdminStatisticsPage = () => {
  const { admin, isSuperAdmin, isDepartmentAdmin, department } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // days
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [sortBy, setSortBy] = useState('total_requests');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadStatistics();
  }, [selectedPeriod, selectedDepartment]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      
      const params = {
        period: selectedPeriod,
        department: isSuperAdmin() ? selectedDepartment : department
      };

      const response = await apiService.getAdminStatistics(params);
      
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Error loading admin statistics:', error);
      showError('Failed to load admin statistics');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000'
  };

  const getPerformanceColor = (performance) => {
    if (performance >= 90) return 'text-success';
    if (performance >= 70) return 'text-warning';
    return 'text-danger';
  };

  const getPerformanceIcon = (performance) => {
    if (performance >= 90) return '🏆';
    if (performance >= 70) return '⭐';
    if (performance >= 50) return '📈';
    return '📉';
  };

  const sortAdmins = (admins) => {
    return [...admins].sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      
      if (sortOrder === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const renderOverview = () => {
    if (!statistics) return null;

    return (
      <div>
        {/* Summary Cards */}
        <div className="row mb-4">
          <div className="col-md-3 mb-3">
            <div className="card" style={cardStyle}>
              <div className="card-body text-center">
                <div className="h2 text-primary mb-1">{statistics.overview.total_admins}</div>
                <div className={isDark ? 'text-light' : 'text-muted'}>Total Admins</div>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card" style={cardStyle}>
              <div className="card-body text-center">
                <div className="h2 text-success mb-1">{statistics.overview.active_admins}</div>
                <div className={isDark ? 'text-light' : 'text-muted'}>Active Admins</div>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card" style={cardStyle}>
              <div className="card-body text-center">
                <div className="h2 text-info mb-1">{statistics.overview.total_requests_handled}</div>
                <div className={isDark ? 'text-light' : 'text-muted'}>Requests Handled</div>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card" style={cardStyle}>
              <div className="card-body text-center">
                <div className="h2 text-warning mb-1">{statistics.overview.avg_response_time}h</div>
                <div className={isDark ? 'text-light' : 'text-muted'}>Avg Response Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Department Breakdown (Super Admin Only) */}
        {isSuperAdmin() && statistics.department_breakdown && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h5 className="mb-0">📊 Department Performance</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th>Admins</th>
                          <th>Requests</th>
                          <th>Completed</th>
                          <th>Avg Time</th>
                          <th>Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.department_breakdown.map((dept) => (
                          <tr key={dept.department}>
                            <td>
                              <strong>{dept.department}</strong>
                            </td>
                            <td>{dept.admin_count}</td>
                            <td>{dept.total_requests}</td>
                            <td>
                              <span className="badge bg-success">
                                {dept.completed_requests}
                              </span>
                            </td>
                            <td>{dept.avg_response_time}h</td>
                            <td>
                              <span className={getPerformanceColor(dept.performance_score)}>
                                {getPerformanceIcon(dept.performance_score)} {dept.performance_score}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Performers */}
        <div className="row">
          <div className="col-md-6 mb-4">
            <div className="card" style={cardStyle}>
              <div className="card-header">
                <h6 className="mb-0">🏆 Top Performers (Requests)</h6>
              </div>
              <div className="card-body">
                {statistics.top_performers?.requests?.slice(0, 5).map((admin, index) => (
                  <div key={admin.admin_id} className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center">
                      <span className={`badge ${index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : 'bg-info'} me-2`}>
                        #{index + 1}
                      </span>
                      <div>
                        <strong className={isDark ? 'text-light' : 'text-dark'}>
                          {admin.full_name}
                        </strong>
                        <br />
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          {admin.department}
                        </small>
                      </div>
                    </div>
                    <span className="badge bg-primary">
                      {admin.total_requests} requests
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-md-6 mb-4">
            <div className="card" style={cardStyle}>
              <div className="card-header">
                <h6 className="mb-0">⚡ Fastest Response Times</h6>
              </div>
              <div className="card-body">
                {statistics.top_performers?.response_time?.slice(0, 5).map((admin, index) => (
                  <div key={admin.admin_id} className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center">
                      <span className={`badge ${index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : 'bg-info'} me-2`}>
                        #{index + 1}
                      </span>
                      <div>
                        <strong className={isDark ? 'text-light' : 'text-dark'}>
                          {admin.full_name}
                        </strong>
                        <br />
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          {admin.department}
                        </small>
                      </div>
                    </div>
                    <span className="badge bg-success">
                      {admin.avg_response_time}h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailedStats = () => {
    if (!statistics?.detailed_admins) return null;

    const sortedAdmins = sortAdmins(statistics.detailed_admins);

    return (
      <div>
        {/* Sorting Controls */}
        <div className="row mb-4">
          <div className="col-md-6">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
              Sort by:
            </label>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                borderColor: isDark ? '#333333' : '#ced4da',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <option value="total_requests">Total Requests</option>
              <option value="completed_requests">Completed Requests</option>
              <option value="avg_response_time">Response Time</option>
              <option value="performance_score">Performance Score</option>
              <option value="total_responses">Total Responses</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
              Order:
            </label>
            <select
              className="form-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                borderColor: isDark ? '#333333' : '#ced4da',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <option value="desc">Highest to Lowest</option>
              <option value="asc">Lowest to Highest</option>
            </select>
          </div>
        </div>

        {/* Detailed Admin Stats */}
        <div className="row">
          {sortedAdmins.map((admin, index) => (
            <div key={admin.admin_id} className="col-lg-6 mb-4">
              <div className="card" style={cardStyle}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className={`mb-0 ${isDark ? 'text-light' : 'text-dark'}`}>
                      #{index + 1} {admin.full_name}
                    </h6>
                    <small className={isDark ? 'text-light' : 'text-muted'}>
                      {admin.department} • {admin.username}
                    </small>
                  </div>
                  <div>
                    <span className={`badge ${admin.is_super_admin ? 'bg-danger' : 'bg-primary'}`}>
                      {admin.is_super_admin ? 'Super Admin' : 'Admin'}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h4 text-primary">{admin.total_requests}</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Total Requests</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h4 text-success">{admin.completed_requests}</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Completed</small>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h5 text-info">{admin.total_responses}</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Responses</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h5 text-warning">{admin.avg_response_time}h</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Avg Time</small>
                      </div>
                    </div>
                  </div>

                  {/* Performance Score */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className={isDark ? 'text-light' : 'text-muted'}>Performance Score</small>
                      <small className={getPerformanceColor(admin.performance_score)}>
                        {admin.performance_score}%
                      </small>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div 
                        className={`progress-bar ${
                          admin.performance_score >= 90 ? 'bg-success' :
                          admin.performance_score >= 70 ? 'bg-warning' : 'bg-danger'
                        }`}
                        style={{ width: `${admin.performance_score}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Activity Breakdown */}
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="text-center">
                      <div className="badge bg-warning text-dark">
                        {admin.pending_requests || 0}
                      </div>
                      <br />
                      <small className={isDark ? 'text-light' : 'text-muted'}>Pending</small>
                    </div>
                    <div className="text-center">
                      <div className="badge bg-info">
                        {admin.informed_requests || 0}
                      </div>
                      <br />
                      <small className={isDark ? 'text-light' : 'text-muted'}>Informed</small>
                    </div>
                    <div className="text-center">
                      <div className="badge bg-danger">
                        {admin.rejected_requests || 0}
                      </div>
                      <br />
                      <small className={isDark ? 'text-light' : 'text-muted'}>Rejected</small>
                    </div>
                    <div className="text-center">
                      <div className="badge bg-secondary">
                        {formatDuration(admin.total_work_time || 0)}
                      </div>
                      <br />
                      <small className={isDark ? 'text-light' : 'text-muted'}>Work Time</small>
                    </div>
                  </div>

                  {/* Last Activity */}
                  {admin.last_activity && (
                    <div className="mt-3 pt-2 border-top">
                      <small className={isDark ? 'text-light' : 'text-muted'}>
                        Last Activity: {new Date(admin.last_activity).toLocaleDateString()}
                        {' '}
                        {new Date(admin.last_activity).toLocaleTimeString()}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrends = () => {
    if (!statistics?.trends) return null;

    return (
      <div>
        {/* Trend Charts */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card" style={cardStyle}>
              <div className="card-header">
                <h5 className="mb-0">📈 Performance Trends</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {statistics.trends.weekly_data?.map((week, index) => (
                    <div key={index} className="col-md-3 mb-3">
                      <div className="text-center">
                        <div className="h5 text-primary">{week.requests}</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          Week {index + 1}
                        </small>
                        <div className="progress mt-2" style={{ height: '6px' }}>
                          <div 
                            className="progress-bar bg-primary" 
                            style={{ width: `${(week.requests / Math.max(...statistics.trends.weekly_data.map(w => w.requests))) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workload Distribution */}
        <div className="row">
          <div className="col-md-6 mb-4">
            <div className="card" style={cardStyle}>
              <div className="card-header">
                <h6 className="mb-0">🕐 Peak Activity Hours</h6>
              </div>
              <div className="card-body">
                {statistics.trends.peak_hours?.map((hour) => (
                  <div key={hour.hour} className="d-flex justify-content-between align-items-center mb-2">
                    <span className={isDark ? 'text-light' : 'text-dark'}>
                      {hour.hour}:00
                    </span>
                    <div className="flex-grow-1 mx-3">
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar bg-info" 
                          style={{ width: `${(hour.requests / Math.max(...statistics.trends.peak_hours.map(h => h.requests))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="badge bg-info">
                      {hour.requests}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-md-6 mb-4">
            <div className="card" style={cardStyle}>
              <div className="card-header">
                <h6 className="mb-0">📋 Request Type Distribution</h6>
              </div>
              <div className="card-body">
                {statistics.trends.request_types?.map((type) => (
                  <div key={type.type_name} className="d-flex justify-content-between align-items-center mb-2">
                    <span className={isDark ? 'text-light' : 'text-dark'}>
                      {type.type_name}
                    </span>
                    <div className="flex-grow-1 mx-3">
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar bg-success" 
                          style={{ width: `${type.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="badge bg-success">
                      {type.count} ({type.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isDepartmentAdmin() && !isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5>🔒 Access Denied</h5>
        <p>Admin Statistics is only available for Department Admins and Super Administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          Loading admin statistics...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={isDark ? 'text-light' : 'text-dark'}>
            📊 Admin Performance Statistics
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            {isSuperAdmin() ? 'System-wide' : department} admin performance and workload analysis
          </p>
        </div>

        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={loadStatistics}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <button 
            className="btn btn-outline-success btn-sm"
            onClick={() => showInfo('Export functionality coming soon!')}
          >
            📊 Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-4">
          <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
            Time Period:
          </label>
          <select
            className="form-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#333333' : '#ced4da',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
            <option value="365">Last year</option>
          </select>
        </div>

        {isSuperAdmin() && (
          <div className="col-md-4">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
              Department:
            </label>
            <select
              className="form-select"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                borderColor: isDark ? '#333333' : '#ced4da',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <option value="">All Departments</option>
              <option value="Accounting">Accounting</option>
              <option value="Academic">Academic</option>
              <option value="Student Affairs">Student Affairs</option>
              <option value="Dormitory">Dormitory</option>
              <option value="Campus Services">Campus Services</option>
            </select>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'detailed' ? 'active' : ''}`}
            onClick={() => setActiveTab('detailed')}
          >
            👥 Detailed Stats
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            📈 Trends
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'detailed' && renderDetailedStats()}
        {activeTab === 'trends' && renderTrends()}
      </div>

      {/* No Data Message */}
      {!loading && (!statistics || !statistics.detailed_admins || statistics.detailed_admins.length === 0) && (
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>📊</div>
            <h5 className="mt-3">No Statistics Available</h5>
            <p>No admin activity data found for the selected period.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStatisticsPage;