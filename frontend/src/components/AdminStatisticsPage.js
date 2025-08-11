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
  const [sortBy, setSortBy] = useState('performance_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterConfig, setFilterConfig] = useState({
    minPerformance: 0,
    maxPerformance: 100,
    hasActivity: null,
    minRequests: 0
  });
  const [viewMode, setViewMode] = useState('cards'); // cards, table, compact

  // Department options for super admin
  const departmentOptions = useMemo(() => [
    { value: '', label: 'All Departments' },
    { value: 'Accounting', label: 'Accounting' },
    { value: 'Academic', label: 'Academic' },
    { value: 'Student Affairs', label: 'Student Affairs' },
    { value: 'Dormitory', label: 'Dormitory' },
    { value: 'Campus Services', label: 'Campus Services' }
  ], []);

  // Period options with descriptions
  const periodOptions = useMemo(() => [
    { value: '7', label: 'Last 7 days', description: 'Recent weekly performance' },
    { value: '30', label: 'Last 30 days', description: 'Monthly overview' },
    { value: '90', label: 'Last 3 months', description: 'Quarterly analysis' },
    { value: '180', label: 'Last 6 months', description: 'Semester performance' },
    { value: '365', label: 'Last year', description: 'Annual overview' }
  ], []);

  // Load statistics with enhanced error handling
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
        setLastRefresh(new Date());
        
        if (response.data.fromCache) {
          showInfo('Data loaded from cache - refresh for latest data');
        } else {
        
        }
        
        console.log('✅ Statistics loaded:', response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to load statistics');
      }
    } catch (error) {
      console.error('❌ Error loading admin statistics:', error);
      
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
  }, [selectedPeriod, selectedDepartment, isSuperAdmin, department, showError, showInfo, showSuccess]);

  // Auto refresh functionality
  useEffect(() => {
    let intervalId;
    if (autoRefresh && !loading) {
      intervalId = setInterval(() => {
        loadStatistics(true);
      }, 5 * 60 * 1000); // 5 minutes
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, loading, loadStatistics]);

  // Load statistics on parameter change
  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Enhanced card style
  const cardStyle = useMemo(() => ({
    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000',
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
  }), [isDark]);

  // Performance helper functions
  const getPerformanceColor = useCallback((performance) => {
    if (performance >= 90) return 'text-success';
    if (performance >= 80) return 'text-primary';
    if (performance >= 70) return 'text-warning';
    if (performance >= 50) return 'text-info';
    return 'text-danger';
  }, []);

  const getPerformanceIcon = useCallback((performance) => {
    if (performance >= 90) return '🏆';
    if (performance >= 80) return '⭐';
    if (performance >= 70) return '📈';
    if (performance >= 50) return '📊';
    return '📉';
  }, []);

  const getPerformanceBadgeClass = useCallback((performance) => {
    if (performance >= 90) return 'bg-success';
    if (performance >= 80) return 'bg-primary';
    if (performance >= 70) return 'bg-warning text-dark';
    if (performance >= 50) return 'bg-info';
    return 'bg-danger';
  }, []);

  // Advanced filtering and sorting
  const filteredAndSortedAdmins = useMemo(() => {
    if (!statistics?.detailed_admins) return [];
    
    let filtered = statistics.detailed_admins.filter(admin => {
      const performance = admin.performance_score || 0;
      const requests = admin.total_requests || 0;
      
      if (performance < filterConfig.minPerformance || performance > filterConfig.maxPerformance) {
        return false;
      }
      
      if (requests < filterConfig.minRequests) {
        return false;
      }
      
      if (filterConfig.hasActivity !== null) {
        const hasActivity = requests > 0;
        if (hasActivity !== filterConfig.hasActivity) {
          return false;
        }
      }
      
      return true;
    });

    // Sort filtered results
    filtered.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      
      if (sortOrder === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });

    return filtered;
  }, [statistics, filterConfig, sortBy, sortOrder]);

  // Calculate enhanced department summary
  const departmentSummary = useMemo(() => {
    if (!statistics?.detailed_admins) return null;
    
    const admins = statistics.detailed_admins;
    const totalRequests = admins.reduce((sum, admin) => sum + (admin.total_requests || 0), 0);
    const totalCompleted = admins.reduce((sum, admin) => sum + (admin.completed_requests || 0), 0);
    const totalPending = admins.reduce((sum, admin) => sum + (admin.pending_requests || 0), 0);
    const totalRejected = admins.reduce((sum, admin) => sum + (admin.rejected_requests || 0), 0);
    const totalResponses = admins.reduce((sum, admin) => sum + (admin.total_responses || 0), 0);
    
    const avgPerformance = admins.length > 0 ? 
      Math.round(admins.reduce((sum, admin) => sum + (admin.performance_score || 0), 0) / admins.length) : 0;
    
    const avgResponseTime = admins.length > 0 ?
      Math.round(admins.reduce((sum, admin) => sum + (admin.avg_response_time || 0), 0) / admins.length * 10) / 10 : 0;
    
    const activeAdmins = admins.filter(admin => (admin.total_requests || 0) > 0).length;
    
    return {
      total_admins: admins.length,
      active_admins: activeAdmins,
      total_requests: totalRequests,
      total_completed: totalCompleted,
      total_pending: totalPending,
      total_rejected: totalRejected,
      total_responses: totalResponses,
      completion_rate: totalRequests > 0 ? Math.round((totalCompleted / totalRequests) * 100) : 0,
      avg_performance: avgPerformance,
      avg_response_time: avgResponseTime,
      utilization_rate: admins.length > 0 ? Math.round((activeAdmins / admins.length) * 100) : 0
    };
  }, [statistics]);

  // Format duration helper
  const formatDuration = useCallback((hours) => {
    if (!hours || hours === 0) return '0h';
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <h5 className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          📊 Loading Admin Performance Statistics
        </h5>
        <p className={isDark ? 'text-light' : 'text-muted'}>
          Analyzing performance data and generating insights...
        </p>
        <div className="progress mt-3" style={{ width: '300px', margin: '0 auto' }}>
          <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }}></div>
        </div>
      </div>
    );
  }

  // Access control
  if (!isDepartmentAdmin() && !isSuperAdmin()) {
    return (
      <div className="alert alert-warning border-0 shadow-sm">
        <div className="d-flex align-items-center">
          <div className="me-3" style={{ fontSize: '3rem' }}>🔒</div>
          <div>
            <h5 className="alert-heading mb-2">Access Denied</h5>
            <p className="mb-2">Admin Statistics is only available for Department Admins and Super Administrators.</p>
            <small className="text-muted">Contact your system administrator if you believe this is an error.</small>
          </div>
        </div>
      </div>
    );
  }

  // Render overview tab
  const renderOverview = () => {
    if (!statistics) return <div className="text-center text-muted py-5">No data available</div>;

    return (
      <div>
        {/* Enhanced Department Summary */}
        {departmentSummary && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm" style={cardStyle}>
                <div className="card-header bg-gradient-primary text-white border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="mb-0">
                        📊 {isSuperAdmin() && selectedDepartment ? selectedDepartment : department} Performance Dashboard
                      </h5>
                      <small className="opacity-75">
                        {periodOptions.find(p => p.value === selectedPeriod)?.description}
                      </small>
                    </div>
                    <div className="d-flex align-items-center">
                      {lastRefresh && (
                        <small className="me-3 opacity-75">
                          Last updated: {lastRefresh.toLocaleTimeString()}
                        </small>
                      )}
                      <span className={`badge ${departmentSummary.avg_performance >= 80 ? 'bg-success' : 
                        departmentSummary.avg_performance >= 60 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                        Overall: {departmentSummary.avg_performance}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row text-center">
                    <div className="col-md-2">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_admins}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Total Admins</small>
                      <div className="mt-1">
                        <small className="text-success">
                          {departmentSummary.active_admins} active ({departmentSummary.utilization_rate}%)
                        </small>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="h3 text-info mb-1">{departmentSummary.total_requests}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Total Requests</small>
                      <div className="mt-1">
                        <small className="text-info">
                          {Math.round(departmentSummary.total_requests / Math.max(departmentSummary.active_admins, 1))} avg per admin
                        </small>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="h3 text-success mb-1">{departmentSummary.total_completed}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Completed</small>
                      <div className="mt-1">
                        <small className="text-success">{departmentSummary.completion_rate}% rate</small>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="h3 text-warning mb-1">{departmentSummary.total_pending}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Pending</small>
                      <div className="mt-1">
                        <small className="text-warning">
                          {departmentSummary.total_requests > 0 ? 
                            Math.round((departmentSummary.total_pending / departmentSummary.total_requests) * 100) : 0}%
                        </small>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="h3 text-danger mb-1">{departmentSummary.total_rejected}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Rejected</small>
                      <div className="mt-1">
                        <small className="text-danger">
                          {departmentSummary.total_requests > 0 ? 
                            Math.round((departmentSummary.total_rejected / departmentSummary.total_requests) * 100) : 0}%
                        </small>
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className={`h3 mb-1 ${getPerformanceColor(departmentSummary.avg_response_time <= 4 ? 90 : 
                        departmentSummary.avg_response_time <= 24 ? 70 : 40)}`}>
                        {formatDuration(departmentSummary.avg_response_time)}
                      </div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>Avg Response</small>
                      <div className="mt-1">
                        <small className={departmentSummary.avg_response_time <= 4 ? 'text-success' : 
                          departmentSummary.avg_response_time <= 24 ? 'text-warning' : 'text-danger'}>
                          {departmentSummary.avg_response_time <= 4 ? 'Excellent' : 
                           departmentSummary.avg_response_time <= 24 ? 'Good' : 'Slow'}
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  {/* Performance Progress Bars */}
                  <div className="row mt-4">
                    <div className="col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>Completion Rate</small>
                        <small className="text-success"><strong>{departmentSummary.completion_rate}%</strong></small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-success" style={{ width: `${departmentSummary.completion_rate}%` }}></div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>Team Utilization</small>
                        <small className="text-primary"><strong>{departmentSummary.utilization_rate}%</strong></small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-primary" style={{ width: `${departmentSummary.utilization_rate}%` }}></div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>Performance Score</small>
                        <small className={getPerformanceColor(departmentSummary.avg_performance)}>
                          <strong>{departmentSummary.avg_performance}%</strong>
                        </small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className={`progress-bar ${getPerformanceBadgeClass(departmentSummary.avg_performance)}`} 
                             style={{ width: `${departmentSummary.avg_performance}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Distribution Chart */}
        {statistics.detailed_admins && statistics.detailed_admins.length > 0 && (
          <div className="row mb-4">
            <div className="col-md-8">
              <div className="card border-0 shadow-sm" style={cardStyle}>
                <div className="card-header border-0">
                  <h6 className="mb-0">📈 Performance Distribution</h6>
                </div>
                <div className="card-body">
                  {(() => {
                    const performance = statistics.detailed_admins.map(a => a.performance_score || 0);
                    const excellent = performance.filter(p => p >= 90).length;
                    const good = performance.filter(p => p >= 70 && p < 90).length;
                    const average = performance.filter(p => p >= 50 && p < 70).length;
                    const poor = performance.filter(p => p < 50).length;
                    const total = performance.length;
                    
                    return (
                      <div>
                        <div className="row text-center mb-3">
                          <div className="col-3">
                            <div className="h4 text-success">{excellent}</div>
                            <small className="text-success">Excellent (90%+)</small>
                          </div>
                          <div className="col-3">
                            <div className="h4 text-primary">{good}</div>
                            <small className="text-primary">Good (70-89%)</small>
                          </div>
                          <div className="col-3">
                            <div className="h4 text-warning">{average}</div>
                            <small className="text-warning">Average (50-69%)</small>
                          </div>
                          <div className="col-3">
                            <div className="h4 text-danger">{poor}</div>
                            <small className="text-danger">Needs Work (&lt;50%)</small>
                          </div>
                        </div>
                        <div className="progress" style={{ height: '20px' }}>
                          <div className="progress-bar bg-success" style={{ width: `${(excellent/total)*100}%` }}></div>
                          <div className="progress-bar bg-primary" style={{ width: `${(good/total)*100}%` }}></div>
                          <div className="progress-bar bg-warning" style={{ width: `${(average/total)*100}%` }}></div>
                          <div className="progress-bar bg-danger" style={{ width: `${(poor/total)*100}%` }}></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm" style={cardStyle}>
                <div className="card-header border-0">
                  <h6 className="mb-0">🏆 Top Performers</h6>
                </div>
                <div className="card-body">
                  {statistics.detailed_admins
                    .sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))
                    .slice(0, 5)
                    .map((admin, index) => (
                      <div key={admin.admin_id} className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center">
                          <span className={`badge me-2 ${index === 0 ? 'bg-warning text-dark' : 
                            index === 1 ? 'bg-secondary' : 'bg-light text-dark'}`}>
                            #{index + 1}
                          </span>
                          <div>
                            <small className={isDark ? 'text-light' : 'text-dark'}>
                              <strong>{admin.full_name}</strong>
                            </small>
                            <br />
                            <small className={isDark ? 'text-light' : 'text-muted'}>
                              {admin.total_requests || 0} requests
                            </small>
                          </div>
                        </div>
                        <span className={`badge ${getPerformanceBadgeClass(admin.performance_score || 0)}`}>
                          {admin.performance_score || 0}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Insights */}
        {departmentSummary && (
          <div className="row">
            <div className="col-md-4 mb-3">
              <div className={`alert ${departmentSummary.avg_performance >= 80 ? 'alert-success' : 
                departmentSummary.avg_performance >= 60 ? 'alert-warning' : 'alert-danger'} border-0`}>
                <div className="d-flex align-items-center">
                  <div className="me-3" style={{ fontSize: '2rem' }}>
                    {departmentSummary.avg_performance >= 80 ? '🎉' : 
                     departmentSummary.avg_performance >= 60 ? '⚠️' : '📉'}
                  </div>
                  <div>
                    <h6 className="mb-1">Team Performance</h6>
                    <p className="mb-0">
                      {departmentSummary.avg_performance >= 80 ? 'Excellent team performance!' : 
                       departmentSummary.avg_performance >= 60 ? 'Good performance with room for improvement' : 
                       'Performance needs attention'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className={`alert ${departmentSummary.avg_response_time <= 4 ? 'alert-success' : 
                departmentSummary.avg_response_time <= 24 ? 'alert-warning' : 'alert-danger'} border-0`}>
                <div className="d-flex align-items-center">
                  <div className="me-3" style={{ fontSize: '2rem' }}>
                    {departmentSummary.avg_response_time <= 4 ? '⚡' : 
                     departmentSummary.avg_response_time <= 24 ? '🕐' : '🐌'}
                  </div>
                  <div>
                    <h6 className="mb-1">Response Time</h6>
                    <p className="mb-0">
                      {departmentSummary.avg_response_time <= 4 ? 'Lightning fast responses!' : 
                       departmentSummary.avg_response_time <= 24 ? 'Good response times' : 
                       'Response times need improvement'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className={`alert ${departmentSummary.utilization_rate >= 80 ? 'alert-success' : 
                departmentSummary.utilization_rate >= 60 ? 'alert-warning' : 'alert-info'} border-0`}>
                <div className="d-flex align-items-center">
                  <div className="me-3" style={{ fontSize: '2rem' }}>
                    {departmentSummary.utilization_rate >= 80 ? '💪' : 
                     departmentSummary.utilization_rate >= 60 ? '📊' : '😴'}
                  </div>
                  <div>
                    <h6 className="mb-1">Team Utilization</h6>
                    <p className="mb-0">
                      {departmentSummary.utilization_rate >= 80 ? 'High team engagement!' : 
                       departmentSummary.utilization_rate >= 60 ? 'Good team participation' : 
                       'Low activity period'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render detailed stats with advanced filtering
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

    return (
      <div>
        {/* Enhanced Filtering and Controls */}
        <div className="row mb-4">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm" style={cardStyle}>
              <div className="card-header border-0">
                <h6 className="mb-0">🔍 Filters & Sorting</h6>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3">
                    <label className={`form-label small ${isDark ? 'text-light' : 'text-dark'}`}>
                      Sort by:
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                        borderColor: isDark ? '#444444' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    >
                      <option value="performance_score">Performance Score</option>
                      <option value="total_requests">Total Requests</option>
                      <option value="completed_requests">Completed Requests</option>
                      <option value="avg_response_time">Response Time</option>
                      <option value="total_responses">Total Responses</option>
                      <option value="rejected_requests">Rejected Requests</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className={`form-label small ${isDark ? 'text-light' : 'text-dark'}`}>
                      Order:
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      style={{
                        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                        borderColor: isDark ? '#444444' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    >
                      <option value="desc">High to Low</option>
                      <option value="asc">Low to High</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className={`form-label small ${isDark ? 'text-light' : 'text-dark'}`}>
                      Performance Range:
                    </label>
                    <div className="d-flex gap-1">
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="Min"
                        value={filterConfig.minPerformance}
                        onChange={(e) => setFilterConfig(prev => ({
                          ...prev, 
                          minPerformance: parseInt(e.target.value) || 0
                        }))}
                        style={{
                          backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                          borderColor: isDark ? '#444444' : '#ced4da',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      />
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="Max"
                        value={filterConfig.maxPerformance}
                        onChange={(e) => setFilterConfig(prev => ({
                          ...prev, 
                          maxPerformance: parseInt(e.target.value) || 100
                        }))}
                        style={{
                          backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                          borderColor: isDark ? '#444444' : '#ced4da',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      />
                    </div>
                  </div>
                  <div className="col-md-2">
                    <label className={`form-label small ${isDark ? 'text-light' : 'text-dark'}`}>
                      Min Requests:
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={filterConfig.minRequests}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev, 
                        minRequests: parseInt(e.target.value) || 0
                      }))}
                      style={{
                        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                        borderColor: isDark ? '#444444' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className={`form-label small ${isDark ? 'text-light' : 'text-dark'}`}>
                      Activity:
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={filterConfig.hasActivity === null ? 'all' : filterConfig.hasActivity ? 'active' : 'inactive'}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev,
                        hasActivity: e.target.value === 'all' ? null : e.target.value === 'active'
                      }))}
                      style={{
                        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                        borderColor: isDark ? '#444444' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    >
                      <option value="all">All</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm" style={cardStyle}>
              <div className="card-header border-0">
                <h6 className="mb-0">⚙️ View Options</h6>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-12 mb-2">
                    <label className={`form-label small ${isDark ? 'text-light' : 'text-dark'}`}>
                      View Mode:
                    </label>
                    <div className="btn-group w-100" role="group">
                      <button
                        type="button"
                        className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('cards')}
                      >
                        📋 Cards
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('table')}
                      >
                        📊 Table
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${viewMode === 'compact' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('compact')}
                      >
                        📝 Compact
                      </button>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="d-flex gap-2">
                     
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="row mb-3">
          <div className="col-12">
            <div className={`alert alert-info border-0 ${isDark ? 'bg-dark' : ''}`}>
              <div className="d-flex justify-content-between align-items-center">
                <span>
                  📊 Showing <strong>{filteredAndSortedAdmins.length}</strong> of <strong>{statistics.detailed_admins.length}</strong> admins
                  {filterConfig.minPerformance > 0 || filterConfig.maxPerformance < 100 || 
                   filterConfig.minRequests > 0 || filterConfig.hasActivity !== null ? (
                    <span className="ms-2">
                      <small className="badge bg-secondary">Filtered</small>
                    </span>
                  ) : null}
                </span>
                {filteredAndSortedAdmins.length !== statistics.detailed_admins.length && (
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setFilterConfig({
                      minPerformance: 0,
                      maxPerformance: 100,
                      hasActivity: null,
                      minRequests: 0
                    })}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Render based on view mode */}
        {viewMode === 'cards' && renderAdminCards()}
        {viewMode === 'table' && renderAdminTable()}
        {viewMode === 'compact' && renderAdminCompact()}
      </div>
    );
  };

  // Render admin cards view
  const renderAdminCards = () => (
    <div className="row">
      {filteredAndSortedAdmins.map((admin, index) => (
        <div key={admin.admin_id} className="col-lg-6 col-xl-4 mb-4">
          <div className="card h-100 border-0 shadow-sm" style={cardStyle}>
            <div className="card-header border-0 d-flex justify-content-between align-items-center">
              <div>
                <h6 className={`mb-1 ${isDark ? 'text-light' : 'text-dark'}`}>
                  <span className="badge bg-secondary me-2">#{index + 1}</span>
                  {admin.full_name}
                  {admin.is_super_admin && (
                    <span className="badge bg-danger ms-2">Super</span>
                  )}
                </h6>
                <small className={isDark ? 'text-light' : 'text-muted'}>
                  {admin.department} • {admin.username}
                </small>
              </div>
              <div>
                <span className={`badge ${getPerformanceBadgeClass(admin.performance_score || 0)}`}>
                  {getPerformanceIcon(admin.performance_score || 0)} {admin.performance_score || 0}%
                </span>
              </div>
            </div>
            
            <div className="card-body">
              {/* Key Metrics Row */}
              <div className="row mb-3 text-center">
                <div className="col-4">
                  <div className="h5 text-primary mb-1">{admin.total_requests || 0}</div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>Requests</small>
                </div>
                <div className="col-4">
                  <div className="h5 text-success mb-1">{admin.completed_requests || 0}</div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>Completed</small>
                </div>
                <div className="col-4">
                  <div className="h5 text-info mb-1">{admin.total_responses || 0}</div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>Responses</small>
                </div>
              </div>

              {/* Performance Progress */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className={isDark ? 'text-light' : 'text-muted'}>Performance</small>
                  <small className={getPerformanceColor(admin.performance_score || 0)}>
                    <strong>{admin.performance_score || 0}%</strong>
                  </small>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div 
                    className={`progress-bar ${getPerformanceBadgeClass(admin.performance_score || 0)}`}
                    style={{ width: `${Math.min(admin.performance_score || 0, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Status Breakdown */}
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
                    {formatDuration(admin.avg_response_time || 0)}
                  </div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>Avg Time</small>
                </div>
              </div>

              {/* Activity Status */}
              <div className="border-top pt-2">
                {admin.last_activity ? (
                  <small className={isDark ? 'text-light' : 'text-muted'}>
                    Last activity: {new Date(admin.last_activity).toLocaleDateString()}
                  </small>
                ) : (
                  <small className="text-warning">
                    ⚠️ No activity in selected period
                  </small>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Render admin table view
  const renderAdminTable = () => (
    <div className="card border-0 shadow-sm" style={cardStyle}>
      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead className={isDark ? 'table-dark' : 'table-light'}>
            <tr>
              <th>#</th>
              <th>Admin</th>
              <th>Department</th>
              <th>Requests</th>
              <th>Completed</th>
              <th>Performance</th>
              <th>Avg Response</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedAdmins.map((admin, index) => (
              <tr key={admin.admin_id}>
                <td>
                  <span className="badge bg-secondary">#{index + 1}</span>
                </td>
                <td>
                  <div>
                    <strong>{admin.full_name}</strong>
                    {admin.is_super_admin && (
                      <span className="badge bg-danger ms-2 small">Super</span>
                    )}
                    <br />
                    <small className="text-muted">{admin.username}</small>
                  </div>
                </td>
                <td>{admin.department}</td>
                <td>
                  <span className="badge bg-primary">{admin.total_requests || 0}</span>
                </td>
                <td>
                  <span className="badge bg-success">{admin.completed_requests || 0}</span>
                </td>
                <td>
                  <span className={`badge ${getPerformanceBadgeClass(admin.performance_score || 0)}`}>
                    {admin.performance_score || 0}%
                  </span>
                </td>
                <td>
                  <span className={`badge ${
                    (admin.avg_response_time || 0) <= 4 ? 'bg-success' : 
                    (admin.avg_response_time || 0) <= 24 ? 'bg-warning text-dark' : 'bg-danger'
                  }`}>
                    {formatDuration(admin.avg_response_time || 0)}
                  </span>
                </td>
                <td>
                  {admin.last_activity ? (
                    <small>{new Date(admin.last_activity).toLocaleDateString()}</small>
                  ) : (
                    <small className="text-muted">No activity</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render admin compact view
  const renderAdminCompact = () => (
    <div className="card border-0 shadow-sm" style={cardStyle}>
      <div className="card-body">
        {filteredAndSortedAdmins.map((admin, index) => (
          <div key={admin.admin_id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div className="d-flex align-items-center">
              <span className="badge bg-secondary me-3">#{index + 1}</span>
              <div>
                <strong className={isDark ? 'text-light' : 'text-dark'}>
                  {admin.full_name}
                  {admin.is_super_admin && (
                    <span className="badge bg-danger ms-2 small">Super</span>
                  )}
                </strong>
                <br />
                <small className={isDark ? 'text-light' : 'text-muted'}>
                  {admin.department} • {admin.total_requests || 0} requests
                </small>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-success">{admin.completed_requests || 0}</span>
              <span className={`badge ${getPerformanceBadgeClass(admin.performance_score || 0)}`}>
                {admin.performance_score || 0}%
              </span>
              <span className="badge bg-info">{formatDuration(admin.avg_response_time || 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render trends tab
  const renderTrends = () => {
    if (!statistics?.trends) {
      return (
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>📈</div>
            <h5 className="mt-3">Trend Analysis Coming Soon</h5>
            <p>Historical trend data and predictive analytics will be available in the next update.</p>
            <div className="row mt-4">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm" style={cardStyle}>
                  <div className="card-body text-center">
                    <div style={{ fontSize: '3rem' }}>📊</div>
                    <h6 className="mt-2">Performance Trends</h6>
                    <p className="small text-muted">Track performance changes over time</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm" style={cardStyle}>
                  <div className="card-body text-center">
                    <div style={{ fontSize: '3rem' }}>📈</div>
                    <h6 className="mt-2">Workload Analysis</h6>
                    <p className="small text-muted">Analyze request volume patterns</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm" style={cardStyle}>
                  <div className="card-body text-center">
                    <div style={{ fontSize: '3rem' }}>🔮</div>
                    <h6 className="mt-2">Predictive Insights</h6>
                    <p className="small text-muted">AI-powered performance predictions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <div>Trends data available but not implemented yet</div>;
  };

  return (
    <div>
      {/* Enhanced Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={`${isDark ? 'text-light' : 'text-dark'} d-flex align-items-center`}>
            📊 Admin Performance Analytics
            {refreshing && <span className="spinner-border spinner-border-sm ms-2"></span>}
            {autoRefresh && <span className="badge bg-success ms-2">Auto</span>}
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            {isSuperAdmin() 
              ? (selectedDepartment ? `${selectedDepartment} Department` : 'System-wide') 
              : department
            } performance insights and analytics
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
              backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
              borderColor: isDark ? '#444444' : '#ced4da',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            {periodOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className={isDark ? 'text-light' : 'text-muted'}>
            {periodOptions.find(p => p.value === selectedPeriod)?.description}
          </small>
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
                backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                borderColor: isDark ? '#444444' : '#ced4da',
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
            System Status:
          </label>
          <div className={`form-control d-flex align-items-center ${isDark ? 'bg-dark text-light' : 'bg-light'}`}>
            {statistics ? (
              <span className="text-success">✅ Data loaded</span>
            ) : (
              <span className="text-warning">⚠️ No data</span>
            )}
            {statistics?.meta?.fromCache && (
              <small className="text-info ms-2">(cached)</small>
            )}
            {lastRefresh && (
              <small className="ms-auto text-muted">
                {lastRefresh.toLocaleTimeString()}
              </small>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      <ul className="nav nav-pills mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
            {departmentSummary && (
              <span className="badge bg-light text-dark ms-1">
                {departmentSummary.total_admins}
              </span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'detailed' ? 'active' : ''}`}
            onClick={() => setActiveTab('detailed')}
          >
            👥 Detailed Analysis
            {statistics?.detailed_admins && (
              <span className="badge bg-light text-dark ms-1">
                {filteredAndSortedAdmins.length}
              </span>
            )}
          </button>
        </li>
        <li className="nav-item">
        
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