// ===== FIXED FRONTEND STATISTICS COMPONENT =====
// frontend/src/components/AdminStatisticsPage.js - Updated with assignment-based tracking

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const AdminStatisticsPage = () => {
  const { admin, isSuperAdmin, isDepartmentAdmin, department } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  
  const [unassignedRequests, setUnassignedRequests] = useState([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);

  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [sortBy, setSortBy] = useState('performance_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [filterConfig, setFilterConfig] = useState({
    minPerformance: 0,
    maxPerformance: 100,
    hasActivity: null,
    minRequests: 0
  });

  // FIXED: Load statistics with assignment-based tracking
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

      console.log(' Loading assignment-based statistics with params:', params);

      const response = await apiService.getAdminStatistics(params);
      
      if (response.data.success) {
        setStatistics(response.data.data);
        setLastRefresh(new Date());
        
        // Check if data is assignment-based
       
        
        console.log(' Assignment-based statistics loaded:', {
          version: response.data.version || '2.0_assignment_based',
          adminCount: response.data.data.detailed_admins?.length,
          assignmentRate: response.data.data.overview?.assignment_rate,
          dataSource: response.data.data.meta?.data_source
        });
      } else {
        throw new Error(response.data.error || 'Failed to load statistics');
      }
    } catch (error) {
      console.error(' Error loading assignment-based admin statistics:', error);
      
      let errorMessage = t('failed_to_load_admin_statistics', 'Failed to load admin statistics');
      if (error.response?.status === 403) {
        errorMessage = t('access_denied_insufficient_permissions', 'Access denied: Insufficient permissions to view statistics');
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

  // Load unassigned requests
// MEVCUT loadUnassignedRequests fonksiyonunu bununla değiştir:
const loadUnassignedRequests = useCallback(async () => {
  try {
    setLoadingUnassigned(true);
    
    // Direct database query ile unassigned'ları al
    const response = await apiService.getAdminRequests({ 
      department: isSuperAdmin() ? selectedDepartment : department,
      include_unassigned: true // Yeni parametre ekle
    });
    
    if (response.data.success) {
      // Sadece gerçekten unassigned olanları filtrele
      const unassigned = response.data.data.filter(request => 
        !request.assigned_admin_id || request.assigned_admin_id === null
      );
      
      console.log(' Unassigned requests loaded:', {
        total_requests: response.data.data.length,
        unassigned_count: unassigned.length,
        unassigned_ids: unassigned.map(r => r.request_id)
      });
      
      setUnassignedRequests(unassigned);
    }
  } catch (error) {
    console.error('Error loading unassigned requests:', error);
    showError(t('failed_to_load_unassigned_requests', 'Failed to load unassigned requests'));
    setUnassignedRequests([]); // Clear on error
  } finally {
    setLoadingUnassigned(false);
  }
}, [selectedDepartment, isSuperAdmin, department, showError]);
  // Auto-assign all function
 const handleAutoAssignAll = async () => {
  try {
    showInfo(t('starting_auto_assignment', 'Starting auto-assignment...'));
    
    const response = await apiService.autoAssignAllRequests({
      department_filter: isSuperAdmin() ? selectedDepartment : department
    });
    
    if (response.data.success) {
      const successCount = response.data.data.successful_assignments || 0;
      const totalProcessed = response.data.data.total_processed || 0;
      
      if (successCount > 0) {
        showSuccess(t('requests_auto_assigned_successfully', '{count} requests auto-assigned successfully!', { count: successCount }));
      } else if (totalProcessed === 0) {
        showInfo(t('no_unassigned_requests_found', 'No unassigned requests found'));
      } else {
        showInfo(t('all_requests_already_assigned', 'All {count} requests were already assigned', { count: totalProcessed }));
      }
      
      // ZORUNLU REFRESH'LER:
      // 1. Ana statistics'leri yenile
      await loadStatistics(true);
      
      // 2. Eğer unassigned sekmesindeyse, o listeyi de yenile
      if (activeTab === 'unassigned') {
        await loadUnassignedRequests();
      }
      
      // 3. Sekme badge'lerini güncellemek için state'i force update et
      setRefreshing(false); // Force re-render
      
    } else {
      showError(t('failed_to_auto_assign_requests', 'Failed to auto-assign requests: {error}', { error: response.data.error || t('unknown_error', 'Unknown error') }));
    }
  } catch (error) {
    console.error('Auto-assign error:', error);
    showError(t('failed_to_auto_assign_requests', 'Failed to auto-assign requests: {error}', { error: error.response?.data?.error || error.message }));
  }
};



  // Load unassigned requests when tab changes
  useEffect(() => {
    if (activeTab === 'unassigned') {
      loadUnassignedRequests();
    }
  }, [activeTab, loadUnassignedRequests]);

  // Load statistics on parameter change
  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // ENHANCED: Card style with data version indicator
  const cardStyle = useMemo(() => ({
    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000',
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
    borderLeft: statistics?.meta?.data_version === '2.0_assignment_based' ? 
      '4px solid #28a745' : '4px solid #ffc107'
  }), [isDark, statistics]);

  // ENHANCED: Calculate department summary with assignment metrics
  const departmentSummary = useMemo(() => {
    if (!statistics?.detailed_admins) return null;
    
    const admins = statistics.detailed_admins;
    const overview = statistics.overview;
    const assignmentAnalytics = statistics.assignment_analytics;
    
    // FIXED: Use assignment-based calculations
    const totalRequests = overview?.total_requests || 0;
    const totalCompleted = overview?.total_completed || 0;
    const totalPending = overview?.total_pending || 0;
    const totalRejected = overview?.total_rejected || 0;
    const assignedRequests = assignmentAnalytics?.assigned_requests || 0;
    const unassignedRequests = assignmentAnalytics?.unassigned_requests || 0;
    
    const avgPerformance = admins.length > 0 ? 
      Math.round(admins.reduce((sum, admin) => sum + (admin.performance_score || 0), 0) / admins.length) : 0;
    
    const avgResponseTime = overview?.avg_response_time_hours || 0;
    const activeAdmins = admins.filter(admin => admin.has_assignments).length;
    
    return {
      total_admins: admins.length,
      active_admins: activeAdmins,
      total_requests: totalRequests,
      assigned_requests: assignedRequests,
      unassigned_requests: unassignedRequests,
      total_completed: totalCompleted,
      total_pending: totalPending,
      total_rejected: totalRejected,
      completion_rate: overview?.completion_rate || 0,
      assignment_rate: assignmentAnalytics?.assignment_rate || 0,
      avg_performance: avgPerformance,
      avg_response_time: avgResponseTime,
      utilization_rate: overview?.utilization_rate || 0,
      
      // ENHANCED: Assignment-specific metrics
      auto_assignment_rate: assignmentAnalytics?.auto_assignment_rate || 0,
      avg_assignment_delay: assignmentAnalytics?.avg_assignment_delay_hours || 0
    };
  }, [statistics]);

  // ENHANCED: Filtered and sorted admins with assignment awareness
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
        const hasActivity = admin.has_assignments;
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

  // Performance helpers
  const getPerformanceColor = useCallback((performance) => {
    if (performance >= 90) return 'text-danger';
    if (performance >= 80) return 'text-danger';
    if (performance >= 70) return 'text-danger';
    if (performance >= 50) return 'text-danger';
    return 'text-danger';
  }, []);

  const getPerformanceBadgeClass = useCallback((performance) => {
    if (performance >= 90) return 'bg-danger';
    if (performance >= 80) return 'bg-danger';
    if (performance >= 70) return 'bg-danger';
    if (performance >= 50) return 'bg-danger';
    return 'bg-danger';
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">{t('loading', 'Loading')}...</span>
        </div>
        <h5 className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          
        </h5>
        <p className={isDark ? 'text-light' : 'text-muted'}>
          {t('analyzing_admin_assignments_performance', 'Analyzing admin assignments and performance data')}...
        </p>
        <div className="progress mt-3" style={{ width: '300px', margin: '0 auto' }}>
          <div className="progress-bar progress-bar-striped progress-bar-animated bg-success" style={{ width: '100%' }}></div>
        </div>
      </div>
    );
  }

  // ENHANCED: Overview with assignment analytics
  const renderOverview = () => {
    if (!statistics) return <div className="text-center text-muted py-5">{t('no_data_available', 'No data available')}</div>;

    return (
      <div>
        {/* ENHANCED: Department Summary with Assignment Metrics */}
        {departmentSummary && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm" style={cardStyle}>
                <div className="card-header bg-gradient-primary text-secondary border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="mb-0">
                         {isSuperAdmin() && selectedDepartment ? selectedDepartment : department} {t('performance_dashboard', 'Performance Dashboard')}
                        {statistics?.meta?.data_version === '2.0_assignment_based' && (
                          <span className="badge bg-success ms-2">{t('assignment_based', 'Assignment-Based')} ✓</span>
                        )}
                      </h5>
                      <small className="opacity-75">
                        {t('assignment_tracking_workload_analysis', 'Assignment tracking with workload distribution analysis')}
                      </small>
                    </div>
                    <div className="d-flex align-items-center">
                      {lastRefresh && (
                        <small className="me-3 opacity-75">
                          {t('last_updated', 'Last updated')}: {lastRefresh.toLocaleTimeString()}
                        </small>
                      )}
                      
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {/* ENHANCED: Assignment-Based Metrics Row */}
                  <div className="row text-center mb-3">
                    <div className="col-md-2">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_admins}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('total_admins', 'Total Admins')}</small>
                      <div className="mt-1">
                        
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_requests}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('total_requests', 'Total Requests')}</small>
                      <div className="mt-1">
                        
                      </div>
                    </div>
                    <div className="col-md-2">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_completed}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('completed', 'Completed')}</small>
                      
                    </div>
                    <div className="col-md-2">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_pending}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('pending', 'Pending')}</small>
                      <div className="mt-1">
                        
                      </div>
                    </div>
                    
                    
                    
                  </div>
                  
                  
                  
                  {/* ENHANCED: Performance Progress Bars with Assignment Metrics */}
                  <div className="row mt-4">
                    
                    <div className="col-md-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>{t('completion_rate', 'Completion Rate')}</small>
                        <small className="text-danger"><strong>{departmentSummary.completion_rate}%</strong></small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-danger" style={{ width: `${departmentSummary.completion_rate}%` }}></div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>{t('team_utilization', 'Team Utilization')}</small>
                        <small className="text-danger"><strong>{departmentSummary.utilization_rate}%</strong></small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-danger" style={{ width: `${departmentSummary.utilization_rate}%` }}></div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>{t('performance_score', 'Performance Score')}</small>
                        <small className="text-danger">
                          <strong>{departmentSummary.avg_performance}%</strong>
                        </small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-danger"   style={{ width: `${departmentSummary.avg_performance}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ENHANCED: Workload Distribution Chart */}
        {statistics.workload_distribution && statistics.workload_distribution.length > 0 && (
          <div className="row mb-4">
            <div className="col-md-8">
              <div className="card border-0 shadow-sm" style={cardStyle}>
                <div className="card-header border-0">
                
                  <h6 className="mb-0">{t('top_performers', 'Top Performers')}</h6>
                </div>
                <div className="card-body">
                  {statistics.detailed_admins
                    .filter(admin => admin.has_assignments)
                    .sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))
                    .slice(0, 5)
                    .map((admin, index) => (
                      <div key={admin.admin_id} className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center">
                          <span className={`badge me-2 ${index === 0 ? 'bg-danger text-light' : 
                            index === 1 ? 'bg-danger' : 'bg-light text-dark'}`}>
                            #{index + 1}
                          </span>
                          <div>
                            <small className={isDark ? 'text-light' : 'text-dark'}>
                              <strong>{admin.full_name}</strong>
                            </small>
                            <br />
                            
                          </div>
                        </div>
                        <div>
                          <span className={`badge  ${getPerformanceBadgeClass(admin.performance_score || 0)}`}>
                            {admin.performance_score || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        
      </div>
    );
  };


   const renderUnassignedRequests = () => {
    if (loadingUnassigned) {
      return (
        <div className="text-center py-5">
          <div className="spinner-border text-warning" role="status">
            <span className="visually-hidden">{t('loading_unassigned_requests', 'Loading unassigned requests')}...</span>
          </div>
          <p className="mt-2">{t('loading_unassigned_requests', 'Loading unassigned requests')}...</p>
        </div>
      );
    }

    if (unassignedRequests.length === 0) {
      return (
        <div className="text-center py-5">
          <div style={{ fontSize: '4rem' }}>✅</div>
          <h5 className="mt-3">{t('all_requests_assigned', 'All Requests Assigned')}!</h5>
          <p>{t('no_unassigned_requests_in_system', 'There are no unassigned requests in the system')}.</p>
        </div>
      );
    }

    return (
      <div>
        <div className="row mb-4">
          <div className="col-12">
            <div className="alert alert-warning border-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-1">⚠️ {t('unassigned_requests', 'Unassigned Requests')} ({unassignedRequests.length})</h6>
                  <p className="mb-0">{t('requests_need_assignment', 'These requests need to be assigned to admins for processing')}.</p>
                </div>
                <button 
                  className="btn btn-warning"
                  onClick={handleAutoAssignAll}
                >
                   {t('auto_assign_all', 'Auto-Assign All')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          {unassignedRequests.map(request => (
            <div key={request.request_id} className="col-md-6 col-lg-4 mb-3">
              <div className="card border-warning">
                <div className="card-header bg-warning text-dark">
                  <div className="d-flex justify-content-between align-items-center">
                    <strong>{t('request', 'Request')} #{request.request_id}</strong>
                    <span className={`badge bg-secondary`}>
                      {request.status}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <h6 className="card-title">{request.type_name}</h6>
                  <p className="card-text">
                    <small><strong>{t('student', 'Student')}:</strong> {request.student_name}</small><br />
                    <small><strong>{t('department', 'Department')}:</strong> {request.category}</small><br />
                    <small><strong>{t('submitted', 'Submitted')}:</strong> {new Date(request.submitted_at).toLocaleDateString()}</small>
                  </p>
                  <p className="card-text">
                    {request.content.length > 100 ? 
                      request.content.substring(0, 100) + '...' : 
                      request.content
                    }
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ENHANCED: Admin cards with assignment tracking
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
                    <span className="badge bg-danger ms-2">{t('super', 'Super')}</span>
                  )}
                </h6>
                <small className={isDark ? 'text-light' : 'text-muted'}>
                  {admin.department} • {admin.username}
                </small>
              </div>
              <div>
                <span className={`badge ${getPerformanceBadgeClass(admin.performance_score || 0)}`}>
                  {admin.performance_score || 0}%
                </span>
              </div>
            </div>
            
            <div className="card-body">
              {/* ENHANCED: Key Metrics with Assignment Focus */}
              <div className="row mb-3 text-center">
                <div className="col-4">
                  <div className="h5 text-primary mb-1">{admin.total_requests || 0}</div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>{t('assigned', 'Assigned')}</small>
                </div>
                <div className="col-4">
                  <div className="h5 text-primary mb-1">{admin.completed_requests || 0}</div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>{t('completed', 'Completed')}</small>
                </div>
                <div className="col-4">
                  <div className="h5 text-primary mb-1">{admin.total_responses || 0}</div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>{t('responses', 'Responses')}</small>
                </div>
              </div>

              {/* Assignment Analytics */}
              {admin.has_assignments && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className={isDark ? 'text-light' : 'text-muted'}>{t('assignment_efficiency', 'Assignment Efficiency')}</small>
                    <small className={getPerformanceColor(admin.efficiency_score || 0)}>
                      <strong>{admin.efficiency_score || 0}%</strong>
                    </small>
                  </div>
                  <div className="progress" style={{ height: '6px' }}>
                    <div 
                      className={`progress-bar  ${getPerformanceBadgeClass(admin.efficiency_score || 0)}`}
                      style={{ width: `${Math.min(admin.efficiency_score || 0, 100)}%` }}
                      
                    ></div>
                  </div>
                </div>
              )}

              {/* Status Breakdown */}
              <div className="row mb-3">
                <div className="col-3 text-center">
                  <div className="badge bg-danger text-light mb-1 d-block">
                    {admin.pending_requests || 0}
                  </div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>{t('pending', 'Pending')}</small>
                </div>
                <div className="col-3 text-center">
                  <div className="badge bg-danger mb-1 d-block">
                    {admin.informed_requests || 0}
                  </div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>{t('informed', 'Informed')}</small>
                </div>
                <div className="col-3 text-center">
                  <div className="badge bg-danger mb-1 d-block">
                    {admin.rejected_requests || 0}
                  </div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>{t('rejected', 'Rejected')}</small>
                </div>
                <div className="col-3 text-center">
                  <div className="badge bg-danger mb-1 d-block">
                    {formatDuration(admin.avg_response_time_hours || 0)}
                  </div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>{t('avg_time', 'Avg Time')}</small>
                </div>
              </div>

              
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // ENHANCED: Detailed stats tab
  const renderDetailedStats = () => {
    if (!statistics?.detailed_admins || statistics.detailed_admins.length === 0) {
      return (
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}></div>
            <h5 className="mt-3">{t('no_assignment_data_available', 'No Assignment Data Available')}</h5>
            <p>{t('no_admin_assignments_found', 'No admin assignments found for the selected period and department')}.</p>
            <button 
              className="btn btn-outline-primary"
              onClick={() => loadStatistics(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  {t('refreshing', 'Refreshing')}...
                </>
              ) : (
                t('refresh_data', 'Refresh Data')
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Results Summary with Assignment Info */}
        <div className="row mb-3">
          <div className="col-12">
            
              <div className="d-flex justify-content-between align-items-center">
                
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
                    {t('clear_filters', 'Clear Filters')}
                  </button>
                )}
              </div>
            
          </div>
        </div>

        {/* Render based on view mode */}
        {viewMode === 'cards' && renderAdminCards()}
        {/* Add table and compact views here if needed */}
      </div>
    );
  };

  return (
    <div>
      {/* ENHANCED: Header with Assignment Tracking Indicator */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={`${isDark ? 'text-light' : 'text-dark'} d-flex align-items-center`}>
             {t('admin_performance_analytics', 'Admin Performance Analytics')}
            {refreshing && <span className="spinner-border spinner-border-sm ms-2"></span>}
            {statistics?.meta?.data_version === '' && (
              <span className="badge bg-success ms-2"></span>
            )}
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            {isSuperAdmin() 
              ? (selectedDepartment ? `${selectedDepartment} ${t('department', 'Department')}` : t('system_wide', 'System-wide'))
              : department
            } {t('performance_insights_assignment_tracking', 'performance insights with assignment tracking')}
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
                
              </>
            ) : (
              t('refresh', 'Refresh')
            )}
          </button>
        </div>
      </div>

      {/* Period and Department Filters */}
      <div className="row mb-4">
        <div className="col-md-6">
          <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
            {t('time_period', 'Time Period')}:
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
            <option value="7">{t('last_7_days', 'Last 7 days')}</option>
            <option value="30">{t('last_30_days', 'Last 30 days')}</option>
            <option value="90">{t('last_3_months', 'Last 3 months')}</option>
            <option value="180">{t('last_6_months', 'Last 6 months')}</option>
          </select>
        </div>

        {isSuperAdmin() && (
          <div className="col-md-6">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
              {t('department', 'Department')}:
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
              <option value="">{t('all_departments', 'All Departments')}</option>
              <option value="Accounting">{t('accounting', 'Accounting')}</option>
              <option value="Academic">{t('academic', 'Academic')}</option>
              <option value="Student Affairs">{t('student_affairs', 'Student Affairs')}</option>
              <option value="Dormitory">{t('dormitory', 'Dormitory')}</option>
              <option value="Campus Services">{t('campus_services', 'Campus Services')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
       <ul className="nav nav-pills mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
             {t('overview', 'Overview')}
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
             {t('assignment_analysis', 'Assignment Analysis')}
            {statistics?.detailed_admins && (
              <span className="badge bg-light text-dark ms-1">
                {filteredAndSortedAdmins.filter(a => a.has_assignments).length}
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
        {activeTab === 'unassigned' && renderUnassignedRequests()}
      </div>

      

      {/* Error State */}
      {!loading && !statistics && (
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>⚠️</div>
            <h5 className="mt-3">{t('failed_to_load_statistics', 'Failed to Load Statistics')}</h5>
            <p>{t('unable_to_fetch_admin_performance_data', 'Unable to fetch admin performance data. Please try again')}.</p>
            <button 
              className="btn btn-danger"
              onClick={() => loadStatistics()}
            >
               {t('retry', 'Retry')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStatisticsPage;