// frontend/src/components/AdminStatisticsPage.js - İyileştirmeler

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [sortBy, setSortBy] = useState('total_requests');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);

  // Memoized department options for super admin
  const departmentOptions = useMemo(() => [
    { value: '', label: 'All Departments' },
    { value: 'Accounting', label: 'Accounting' },
    { value: 'Academic', label: 'Academic' },
    { value: 'Student Affairs', label: 'Student Affairs' },
    { value: 'Dormitory', label: 'Dormitory' },
    { value: 'Campus Services', label: 'Campus Services' }
  ], []);

  // Load statistics with error handling and loading states
  const loadStatistics = useCallback(async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const params = {
        period: selectedPeriod,
        department: isSuperAdmin() ? selectedDepartment : department
      };

      console.log('📊 Loading statistics with params:', params);

      const response = await apiService.getAdminStatistics(params);
      
      if (response.data.success) {
        setStatistics(response.data.data);
        
        // Show cache indicator if data is from cache
        if (response.data.fromCache) {
          showInfo('Data loaded from cache - refresh for latest data');
        }
        
        console.log('✅ Statistics loaded:', response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to load statistics');
      }
    } catch (error) {
      console.error('❌ Error loading admin statistics:', error);
      
      // Better error messages
      let errorMessage = 'Failed to load admin statistics';
      if (error.response?.status === 403) {
        errorMessage = 'Access denied: Insufficient permissions to view statistics';
      } else if (error.response?.status === 404) {
        errorMessage = 'Statistics endpoint not found';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      showError(errorMessage);
      setStatistics(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, selectedDepartment, isSuperAdmin, department, showError, showInfo]);

  // Effect for loading statistics
  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Memoized card style
  const cardStyle = useMemo(() => ({
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000'
  }), [isDark]);

  // Performance calculation helpers
  const getPerformanceColor = useCallback((performance) => {
    if (performance >= 90) return 'text-success';
    if (performance >= 70) return 'text-warning';
    if (performance >= 50) return 'text-info';
    return 'text-danger';
  }, []);

  const getPerformanceIcon = useCallback((performance) => {
    if (performance >= 90) return '🏆';
    if (performance >= 70) return '⭐';
    if (performance >= 50) return '📈';
    return '📉';
  }, []);

  const getPerformanceBadge = useCallback((performance) => {
    if (performance >= 90) return 'bg-success';
    if (performance >= 70) return 'bg-warning';
    if (performance >= 50) return 'bg-info';
    return 'bg-danger';
  }, []);

  // Sorting function with null handling
  const sortAdmins = useCallback((admins) => {
    if (!admins || admins.length === 0) return [];
    
    return [...admins].sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      
      if (sortOrder === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });
  }, [sortBy, sortOrder]);

  // Format duration helper
  const formatDuration = useCallback((minutes) => {
    if (!minutes || minutes === 0) return '0m';
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }, []);

  // Calculate department summary
  const departmentSummary = useMemo(() => {
    if (!statistics?.detailed_admins) return null;
    
    const admins = statistics.detailed_admins;
    const totalRequests = admins.reduce((sum, admin) => sum + (admin.total_requests || 0), 0);
    const totalCompleted = admins.reduce((sum, admin) => sum + (admin.completed_requests || 0), 0);
    const avgPerformance = admins.length > 0 ? 
      Math.round(admins.reduce((sum, admin) => sum + (admin.performance_score || 0), 0) / admins.length) : 0;
    
    return {
      total_admins: admins.length,
      total_requests: totalRequests,
      total_completed: totalCompleted,
      completion_rate: totalRequests > 0 ? Math.round((totalCompleted / totalRequests) * 100) : 0,
      avg_performance: avgPerformance
    };
  }, [statistics]);

  // Render loading state
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          Loading admin statistics...
        </p>
        <small className={isDark ? 'text-light' : 'text-muted'}>
          This may take a few moments for large datasets
        </small>
      </div>
    );
  }

  // Access control
  if (!isDepartmentAdmin() && !isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5>🔒 Access Denied</h5>
        <p>Admin Statistics is only available for Department Admins and Super Administrators.</p>
        <small>Contact your system administrator if you believe this is an error.</small>
      </div>
    );
  }

  // Render overview tab with improved layout
  const renderOverview = () => {
    if (!statistics) return null;

    return (
      <div>
        {/* Department Summary Card */}
        {departmentSummary && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-primary" style={cardStyle}>
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">
                    📊 {isSuperAdmin() && selectedDepartment ? selectedDepartment : department} Performance Summary
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row text-center">
                    <div className="col-md-3">
                      <div className="h3 text-primary">{departmentSummary.total_admins}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Active Admins</small>
                    </div>
                    <div className="col-md-3">
                      <div className="h3 text-info">{statistics.overview.total_requests_handled}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Total Requests</small>
                    </div>
                    <div className="col-md-3">
                      <div className="h3 text-success">{departmentSummary.completion_rate}%</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Completion Rate</small>
                    </div>
                    <div className="col-md-3">
                      <div className={`h3 ${getPerformanceColor(departmentSummary.avg_performance)}`}>
                        {getPerformanceIcon(departmentSummary.avg_performance)} {departmentSummary.avg_performance}%
                      </div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Avg Performance</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        

        {/* Department Breakdown (Super Admin Only) */}
        {isSuperAdmin() && statistics.department_breakdown && statistics.department_breakdown.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h5 className="mb-0">📊 Department Performance Comparison</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th>Admins</th>
                          <th>Total Requests</th>
                          <th>Completed</th>
                          <th>Rejected</th>
                          <th>Completion Rate</th>
                          <th>Avg Response Time</th>
                          <th>Performance Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.department_breakdown.map((dept) => (
                          <tr key={dept.department}>
                            <td>
                              <strong>{dept.department}</strong>
                            </td>
                            <td>{dept.admin_count}</td>
                            <td>{dept.total_requests || 0}</td>
                            <td>
                              <span className="badge bg-success">
                                {dept.completed_requests || 0}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-danger">
                                {dept.rejected_requests || 0}
                              </span>
                            </td>
                            <td>
                              {dept.total_requests > 0 
                                ? Math.round(((dept.completed_requests || 0) / dept.total_requests) * 100)
                                : 0}%
                            </td>
                            <td>{dept.avg_response_time || 0}h</td>
                            <td>
                              <span className={`badge ${getPerformanceBadge(dept.performance_score || 0)}`}>
                                {getPerformanceIcon(dept.performance_score || 0)} {dept.performance_score || 0}%
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
                <h6 className="mb-0">⚡ Fastest Response Times</h6>
              </div>
              <div className="card-body">
                {statistics.top_performers?.response_time?.length > 0 ? (
                  statistics.top_performers.response_time.slice(0, 5).map((admin, index) => (
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
                        {admin.avg_response_time || 0}h
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted py-3">
                    <div>⚡</div>
                    <small>No response time data available</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render detailed stats with improved error handling
  const renderDetailedStats = () => {
    if (!statistics?.detailed_admins || statistics.detailed_admins.length === 0) {
      return (
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>📊</div>
            <h5 className="mt-3">No Admin Data Available</h5>
            <p>No admin activity found for the selected period and department.</p>
            <button 
              className="btn btn-outline-primary"
              onClick={() => loadStatistics(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Refreshing...
                </>
              ) : (
                '🔄 Refresh Data'
              )}
            </button>
          </div>
        </div>
      );
    }

    const sortedAdmins = sortAdmins(statistics.detailed_admins);

    return (
      <div>
        {/* Enhanced Sorting Controls */}
        <div className="row mb-4">
          <div className="col-md-4">
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
              <option value="performance_score">Performance Score</option>
              <option value="avg_response_time">Response Time</option>
              <option value="total_responses">Total Responses</option>
              <option value="rejected_requests">Rejected Requests</option>
            </select>
          </div>
          <div className="col-md-4">
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
          <div className="col-md-4 d-flex align-items-end">
            <button 
              className="btn btn-outline-secondary w-100"
              onClick={() => loadStatistics(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Refreshing...
                </>
              ) : (
                '🔄 Refresh Data'
              )}
            </button>
          </div>
        </div>

       

        {/* Enhanced Admin Cards */}
        <div className="row">
          {sortedAdmins.map((admin, index) => (
            <div key={admin.admin_id} className="col-lg-6 mb-4">
              <div className="card h-100" style={cardStyle}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className={`mb-1 ${isDark ? 'text-light' : 'text-dark'}`}>
                      #{index + 1} {admin.full_name}
                      {admin.is_super_admin && (
                        <span className="badge bg-danger ms-1">Super</span>
                      )}
                    </h6>
                    <small className={isDark ? 'text-light' : 'text-muted'}>
                      {admin.department} • {admin.username}
                    </small>
                  </div>
                  <div>
                    <span className={`badge ${getPerformanceBadge(admin.performance_score || 0)}`}>
                      {getPerformanceIcon(admin.performance_score || 0)} {admin.performance_score || 0}%
                    </span>
                  </div>
                </div>
                
                <div className="card-body">
                  {/* Main Metrics Row */}
                  <div className="row mb-3">
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h4 text-primary">{admin.total_requests || 0}</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Total Requests</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h4 text-success">{admin.completed_requests || 0}</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Completed</small>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="row mb-3">
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h5 text-info">{admin.total_responses || 0}</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Responses</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-center mb-3">
                        <div className="h5 text-warning">{admin.avg_response_time || 0}h</div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>Avg Time</small>
                      </div>
                    </div>
                  </div>

                  {/* Performance Progress Bar */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className={isDark ? 'text-light' : 'text-muted'}>Performance Score</small>
                      <small className={getPerformanceColor(admin.performance_score || 0)}>
                        <strong>{admin.performance_score || 0}%</strong>
                      </small>
                    </div>
                    <div className="progress" style={{ height: '10px' }}>
                      <div 
                        className={`progress-bar ${
                          (admin.performance_score || 0) >= 90 ? 'bg-success' :
                          (admin.performance_score || 0) >= 70 ? 'bg-warning' :
                          (admin.performance_score || 0) >= 50 ? 'bg-info' : 'bg-danger'
                        }`}
                        style={{ width: `${Math.min(admin.performance_score || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Request Status Breakdown */}
                  <div className="row mb-3">
                    <div className="col-3 text-center">
                      <div className="badge bg-warning text-dark mb-1 d-block">
                        {admin.pending_requests || 0}
                      </div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Pending</small>
                    </div>
                    <div className="col-3 text-center">
                      <div className="badge bg-info mb-1 d-block">
                        {admin.informed_requests || 0}
                      </div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Informed</small>
                    </div>
                    <div className="col-3 text-center">
                      <div className="badge bg-danger mb-1 d-block">
                        {admin.rejected_requests || 0}
                      </div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Rejected</small>
                    </div>
                    <div className="col-3 text-center">
                      <div className="badge bg-secondary mb-1 d-block">
                        {formatDuration(admin.total_work_time || 0)}
                      </div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Work Time</small>
                    </div>
                  </div>

                  {/* Last Activity */}
                  {admin.last_activity && (
                    <div className="border-top pt-2">
                      <small className={isDark ? 'text-light' : 'text-muted'}>
                        Last Activity: {new Date(admin.last_activity).toLocaleDateString()} 
                        {' '}
                        {new Date(admin.last_activity).toLocaleTimeString()}
                      </small>
                    </div>
                  )}

                  {/* No Activity Warning */}
                  {(!admin.last_activity || (admin.total_requests || 0) === 0) && (
                    <div className="border-top pt-2">
                      <small className="text-warning">
                        ⚠️ No activity in selected period
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

  // Render trends with better error handling
  const renderTrends = () => {
    if (!statistics?.trends) {
      return (
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>📈</div>
            <h5 className="mt-3">No Trend Data Available</h5>
            <p>Trend analysis requires more historical data.</p>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Weekly Trends */}
        {statistics.trends.weekly_data && statistics.trends.weekly_data.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h5 className="mb-0">📈 Weekly Performance Trends</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    {statistics.trends.weekly_data.map((week, index) => {
                      const maxRequests = Math.max(...statistics.trends.weekly_data.map(w => w.requests || 0));
                      const percentage = maxRequests > 0 ? ((week.requests || 0) / maxRequests) * 100 : 0;
                      
                      return (
                        <div key={index} className="col-md-3 mb-3">
                          <div className="text-center">
                            <div className="h5 text-primary">{week.requests || 0}</div>
                            <small className={isDark ? 'text-light' : 'text-muted'}>
                              Week {index + 1}
                            </small>
                            <div className="progress mt-2" style={{ height: '8px' }}>
                              <div 
                                className="progress-bar bg-primary" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            {week.responses && (
                              <small className={`${isDark ? 'text-light' : 'text-muted'} d-block mt-1`}>
                                {week.responses} responses
                              </small>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Peak Hours and Request Types Row */}
        <div className="row">
          {/* Peak Hours */}
          {statistics.trends.peak_hours && statistics.trends.peak_hours.length > 0 && (
            <div className="col-md-6 mb-4">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h6 className="mb-0">🕐 Peak Activity Hours</h6>
                </div>
                <div className="card-body">
                  {statistics.trends.peak_hours.map((hour) => {
                    const maxRequests = Math.max(...statistics.trends.peak_hours.map(h => h.requests || 0));
                    const percentage = maxRequests > 0 ? ((hour.requests || 0) / maxRequests) * 100 : 0;
                    
                    return (
                      <div key={hour.hour} className="d-flex justify-content-between align-items-center mb-2">
                        <span className={isDark ? 'text-light' : 'text-dark'}>
                          {String(hour.hour).padStart(2, '0')}:00
                        </span>
                        <div className="flex-grow-1 mx-3">
                          <div className="progress" style={{ height: '10px' }}>
                            <div 
                              className="progress-bar bg-info" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="badge bg-info">
                          {hour.requests || 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Request Types */}
          {statistics.trends.request_types && statistics.trends.request_types.length > 0 && (
            <div className="col-md-6 mb-4">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h6 className="mb-0">📋 Request Type Distribution</h6>
                </div>
                <div className="card-body">
                  {statistics.trends.request_types.map((type) => (
                    <div key={type.type_name} className="d-flex justify-content-between align-items-center mb-2">
                      <span className={`${isDark ? 'text-light' : 'text-dark'} text-truncate`} style={{ maxWidth: '150px' }}>
                        {type.type_name}
                      </span>
                      <div className="flex-grow-1 mx-3">
                        <div className="progress" style={{ height: '10px' }}>
                          <div 
                            className="progress-bar bg-success" 
                            style={{ width: `${type.percentage || 0}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="badge bg-success">
                        {type.count || 0} ({type.percentage || 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Enhanced Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={isDark ? 'text-light' : 'text-dark'}>
            📊 Admin Performance Statistics
            {refreshing && <span className="spinner-border spinner-border-sm ms-2"></span>}
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            {isSuperAdmin() 
              ? (selectedDepartment ? `${selectedDepartment} Department` : 'System-wide') 
              : department
            } admin performance and workload analysis
            {statistics?.meta && (
              <span className="ms-2">
                • {new Date(statistics.meta.start_date).toLocaleDateString()} - {new Date(statistics.meta.end_date).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>

        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={() => loadStatistics(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <span className="spinner-border spinner-border-sm me-1"></span>
                Refreshing...
              </>
            ) : (
              '🔄 Refresh'
            )}
          </button>
          <button 
            className="btn btn-outline-success btn-sm"
            onClick={() => showInfo('Export functionality coming soon!')}
          >
            📊 Export
          </button>
        </div>
      </div>

      {/* Enhanced Filters */}
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
            <option value="180">Last 6 months</option>
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
              {departmentOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="col-md-4">
          <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
            Data Status:
          </label>
          <div className={`form-control ${isDark ? 'bg-dark text-light' : 'bg-light'}`}>
            {statistics ? (
              <span className="text-success">✅ Data loaded</span>
            ) : (
              <span className="text-warning">⚠️ No data</span>
            )}
            {statistics?.meta?.fromCache && (
              <small className="text-info ms-2">(cached)</small>
            )}
          </div>
        </div>
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
            {statistics?.detailed_admins && (
              <span className="badge bg-primary ms-1">
                {statistics.detailed_admins.length}
              </span>
            )}
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

      {/* Error State */}
      {!loading && !statistics && (
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>⚠️</div>
            <h5 className="mt-3">Failed to Load Statistics</h5>
            <p>Unable to fetch admin performance data. Please try again.</p>
            <button 
              className="btn btn-danger"
              onClick={() => loadStatistics()}
            >
              🔄 Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStatisticsPage;