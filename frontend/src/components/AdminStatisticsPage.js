// ===== ADMIN STATISTICS PAGE - TAB ACTIVE STATE FIX =====
// frontend/src/components/AdminStatisticsPage.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const AdminStatisticsPage = () => {
  const { admin, isSuperAdmin, isDepartmentAdmin, department } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t, translateDbText } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [sortBy, setSortBy] = useState('performance_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [filterConfig, setFilterConfig] = useState({
    minPerformance: 0,
    maxPerformance: 100,
    hasActivity: null,
    minRequests: 0
  });

  // Load statistics
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

      const response = await apiService.getAdminStatistics(params);
      
      if (response.data.success) {
        setStatistics(response.data.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(response.data.error || 'Failed to load statistics');
      }
    } catch (error) {
      console.error('Error loading admin statistics:', error);
      
      let errorMessage = 'Failed to load admin statistics';
      if (error.response?.status === 403) {
        errorMessage = 'Access denied: Insufficient permissions to view statistics';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      showError(errorMessage);
      setStatistics(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, selectedDepartment, isSuperAdmin, department, showError]);

  useEffect(() => {
    loadStatistics();
  }, [selectedPeriod, selectedDepartment]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterConfig, sortBy, sortOrder]);

  // Card style with subtle elegance
  const cardStyle = useMemo(() => ({
    backgroundColor: isDark ? '#1e1e2e' : '#ffffff',
    borderColor: isDark ? '#2a2a3e' : '#e5e7eb',
    color: isDark ? '#ffffff' : '#000000',
    boxShadow: isDark 
      ? '0 1px 3px rgba(0,0,0,0.3)' 
      : '0 1px 3px rgba(0,0,0,0.1)',
    borderRadius: '8px',
    border: `1px solid ${isDark ? '#2a2a3e' : '#e5e7eb'}`,
  }), [isDark]);

  // Calculate department summary
  const departmentSummary = useMemo(() => {
    if (!statistics?.detailed_admins) return null;
    
    const admins = statistics.detailed_admins;
    const overview = statistics.overview || {};
    
    const totalRequests = overview.total_requests || 0;
    const totalCompleted = overview.total_completed || 0;
    const totalPending = overview.total_pending || 0;
    
    const avgPerformance = admins.length > 0 ? 
      Math.round(admins.reduce((sum, admin) => sum + (admin.performance_score || 0), 0) / admins.length) : 0;
    
    const activeAdmins = admins.filter(admin => admin.has_assignments).length;
    
    return {
      total_admins: admins.length,
      active_admins: activeAdmins,
      total_requests: totalRequests,
      total_completed: totalCompleted,
      total_pending: totalPending,
      completion_rate: overview.completion_rate || 0,
      avg_performance: avgPerformance,
      utilization_rate: overview.utilization_rate || 0,
    };
  }, [statistics]);

  // Filtered and sorted admins
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

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'full_name' || sortBy === 'department') {
        aValue = (aValue || '').toString().toLowerCase();
        bValue = (bValue || '').toString().toLowerCase();
      } else {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    return filtered;
  }, [statistics, filterConfig, sortBy, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedAdmins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAdmins = filteredAndSortedAdmins.slice(startIndex, endIndex);

  // Format duration helper
  const formatDuration = useCallback((hours) => {
    if (!hours || hours === 0) return `0${t('hours')}`;
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}${t('minutes')}`;
    }
    if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}${t('hours')} ${m}${t('minutes')}` : `${h}${t('hours')}`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}${t('days')} ${remainingHours}${t('hours')}`;
  }, [t]);

  // Performance helpers
  const getPerformanceBadgeClass = useCallback((performance) => {
    if (performance >= 90) return 'bg-success';
    if (performance >= 80) return 'bg-info';
    if (performance >= 70) return 'bg-primary';
    if (performance >= 50) return 'bg-warning';
    return 'bg-danger';
  }, []);

  const getPerformanceColor = useCallback((performance) => {
    if (performance >= 90) return '#198754';
    if (performance >= 80) return '#0dcaf0';
    if (performance >= 70) return '#0d6efd';
    if (performance >= 50) return '#ffc107';
    return '#dc3545';
  }, []);

  // Table sort handler
  const handleTableSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }, [sortBy, sortOrder]);

  // Table Header Component
  const TableHeader = ({ field, children }) => (
    <th 
      scope="col" 
      className="user-select-none"
      onClick={() => handleTableSort(field)}
      style={{ 
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '0.813rem',
        padding: '1rem 0.75rem',
        borderBottom: isDark ? '1px solid #2a2a3e' : '1px solid #dee2e6',
        backgroundColor: isDark ? '#252538' : '#f8f9fa',
      }}
    >
      <div className="d-flex align-items-center justify-content-between">
        <span>{children}</span>
        {sortBy === field && (
          <i className={`bi bi-arrow-${sortOrder === 'asc' ? 'up' : 'down'} ms-1`}></i>
        )}
      </div>
    </th>
  );

  // Pagination Component
  const PaginationComponent = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mt-3 gap-3">
        <div className={`small ${isDark ? 'text-light' : 'text-muted'}`}>
          {t('showing')} <strong>{startIndex + 1}-{Math.min(endIndex, filteredAndSortedAdmins.length)}</strong> {t('of')} <strong>{filteredAndSortedAdmins.length}</strong> {t('admins')}
        </div>
        
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <i className="bi bi-chevron-bar-left"></i>
              </button>
            </li>
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <i className="bi bi-chevron-left"></i>
              </button>
            </li>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = currentPage - 2 + i;
              if (pageNum < 1) pageNum = i + 1;
              if (pageNum > totalPages) pageNum = totalPages - 4 + i;
              
              return (
                <li key={i} className={`page-item ${pageNum === currentPage ? 'active' : ''}`}>
                  <button 
                    className="page-link"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                </li>
              );
            })}
            
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </li>
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <i className="bi bi-chevron-bar-right"></i>
              </button>
            </li>
          </ul>
        </nav>

        <div className="d-flex align-items-center gap-2">
          <small className={`${isDark ? 'text-light' : 'text-muted'}`}>{t('itemsPerPage')}</small>
          <select 
            className="form-select form-select-sm"
            style={{ width: '70px' }}
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(parseInt(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <h5 className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          {t('loadingStatistics')}
        </h5>
        <p className={isDark ? 'text-light' : 'text-muted'}>
          {t('analyzingPerformance')}
        </p>
      </div>
    );
  }

  // Overview tab
  const renderOverview = () => {
    if (!statistics) return <div className="text-center text-muted py-5">{t('noDataAvailable')}</div>;

    return (
      <div>
        {departmentSummary && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border" style={cardStyle}>
                <div className="card-header border-bottom" style={{
                  backgroundColor: isDark ? '#252538' : '#f8f9fa',
                  borderBottom: `1px solid ${isDark ? '#2a2a3e' : '#dee2e6'}`
                }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <h5 className="mb-1 fw-semibold">
                        <i className="bi bi-bar-chart-line me-2"></i>
                        {isSuperAdmin() && selectedDepartment ? selectedDepartment : department} {t('performanceDashboard')}
                      </h5>
                      <small className={isDark ? 'text-light' : 'text-muted'} style={{ opacity: 0.8 }}>
                        {t('assignmentTracking')}
                      </small>
                    </div>
                    {lastRefresh && (
                      <small className={isDark ? 'text-light' : 'text-muted'}>
                        <i className="bi bi-clock me-1"></i>
                        {lastRefresh.toLocaleTimeString()}
                      </small>
                    )}
                  </div>
                </div>
                <div className="card-body p-4">
                  {/* Metrics Row */}
                  <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-3 h-100" style={{
                        backgroundColor: isDark ? '#252538' : '#f8f9fa',
                        borderColor: isDark ? '#2a2a3e' : '#e5e7eb'
                      }}>
                        <div className="d-flex align-items-center mb-2">
                          <i className="bi bi-people-fill text-primary me-2"></i>
                          <small className={`text-uppercase ${isDark ? 'text-light' : 'text-muted'}`} style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                            {t('totalAdmins')}
                          </small>
                        </div>
                        <div className={`h3 mb-0 fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                          {departmentSummary.total_admins}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-3 h-100" style={{
                        backgroundColor: isDark ? '#252538' : '#f8f9fa',
                        borderColor: isDark ? '#2a2a3e' : '#e5e7eb'
                      }}>
                        <div className="d-flex align-items-center mb-2">
                          <i className="bi bi-folder-fill text-info me-2"></i>
                          <small className={`text-uppercase ${isDark ? 'text-light' : 'text-muted'}`} style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                            {t('totalRequests')}
                          </small>
                        </div>
                        <div className={`h3 mb-0 fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                          {departmentSummary.total_requests}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-3 h-100" style={{
                        backgroundColor: isDark ? '#252538' : '#f8f9fa',
                        borderColor: isDark ? '#2a2a3e' : '#e5e7eb'
                      }}>
                        <div className="d-flex align-items-center mb-2">
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          <small className={`text-uppercase ${isDark ? 'text-light' : 'text-muted'}`} style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                            {t('completed')}
                          </small>
                        </div>
                        <div className={`h3 mb-0 fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                          {departmentSummary.total_completed}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-3 h-100" style={{
                        backgroundColor: isDark ? '#252538' : '#f8f9fa',
                        borderColor: isDark ? '#2a2a3e' : '#e5e7eb'
                      }}>
                        <div className="d-flex align-items-center mb-2">
                          <i className="bi bi-hourglass-split text-warning me-2"></i>
                          <small className={`text-uppercase ${isDark ? 'text-light' : 'text-muted'}`} style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                            {t('pending')}
                          </small>
                        </div>
                        <div className={`h3 mb-0 fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                          {departmentSummary.total_pending}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Circular Progress Bars */}
                  <div className="row g-4 mt-2">
                    <div className="col-md-4">
                      <div className="text-center p-3 border rounded" style={{
                        backgroundColor: isDark ? '#252538' : '#f8f9fa',
                        borderColor: isDark ? '#2a2a3e' : '#e5e7eb'
                      }}>
                        <div style={{ width: 120, height: 120, margin: '0 auto 1rem' }}>
                          <CircularProgressbar
                            value={departmentSummary.completion_rate}
                            text={`${departmentSummary.completion_rate}%`}
                            styles={buildStyles({
                              pathColor: getPerformanceColor(departmentSummary.completion_rate),
                              textColor: isDark ? '#fff' : '#000',
                              trailColor: isDark ? '#2a2a3e' : '#e9ecef',
                              textSize: '1.25rem',
                              pathTransitionDuration: 0.5,
                            })}
                            strokeWidth={10}
                          />
                        </div>
                        <div className={`fw-semibold mb-1 ${isDark ? 'text-light' : 'text-dark'}`}>
                          <i className="bi bi-check-circle me-1"></i>
                          {t('completionRate')}
                        </div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          {departmentSummary.total_completed} / {departmentSummary.total_requests}
                        </small>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="text-center p-3 border rounded" style={{
                        backgroundColor: isDark ? '#252538' : '#f8f9fa',
                        borderColor: isDark ? '#2a2a3e' : '#e5e7eb'
                      }}>
                        <div style={{ width: 120, height: 120, margin: '0 auto 1rem' }}>
                          <CircularProgressbar
                            value={departmentSummary.utilization_rate}
                            text={`${departmentSummary.utilization_rate}%`}
                            styles={buildStyles({
                              pathColor: getPerformanceColor(departmentSummary.utilization_rate),
                              textColor: isDark ? '#fff' : '#000',
                              trailColor: isDark ? '#2a2a3e' : '#e9ecef',
                              textSize: '1.25rem',
                              pathTransitionDuration: 0.5,
                            })}
                            strokeWidth={10}
                          />
                        </div>
                        <div className={`fw-semibold mb-1 ${isDark ? 'text-light' : 'text-dark'}`}>
                          <i className="bi bi-graph-up me-1"></i>
                          {t('teamUtilization')}
                        </div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          {departmentSummary.active_admins} / {departmentSummary.total_admins} {t('active')}
                        </small>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="text-center p-3 border rounded" style={{
                        backgroundColor: isDark ? '#252538' : '#f8f9fa',
                        borderColor: isDark ? '#2a2a3e' : '#e5e7eb'
                      }}>
                        <div style={{ width: 120, height: 120, margin: '0 auto 1rem' }}>
                          <CircularProgressbar
                            value={departmentSummary.avg_performance}
                            text={`${departmentSummary.avg_performance}%`}
                            styles={buildStyles({
                              pathColor: getPerformanceColor(departmentSummary.avg_performance),
                              textColor: isDark ? '#fff' : '#000',
                              trailColor: isDark ? '#2a2a3e' : '#e9ecef',
                              textSize: '1.25rem',
                              pathTransitionDuration: 0.5,
                            })}
                            strokeWidth={10}
                          />
                        </div>
                        <div className={`fw-semibold mb-1 ${isDark ? 'text-light' : 'text-dark'}`}>
                          <i className="bi bi-award me-1"></i>
                          {t('avgPerformance')}
                        </div>
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          {t('teamAverage')}
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Admin table
  const renderAdminTable = () => (
    <div className="table-responsive">
      <table className={`table table-hover mb-0 ${isDark ? 'table-dark' : ''}`}>
        <thead>
          <tr>
            <TableHeader field="full_name">{t('admin')}</TableHeader>
            <TableHeader field="department">{t('department')}</TableHeader>
            <TableHeader field="performance_score">{t('performance')}</TableHeader>
            <TableHeader field="total_requests">{t('assigned')}</TableHeader>
            <TableHeader field="completed_requests">{t('completed')}</TableHeader>
            <TableHeader field="pending_requests">{t('pending')}</TableHeader>
            <TableHeader field="avg_response_time_hours">{t('avgResponse')}</TableHeader>
            <th style={{ 
              fontWeight: '600',
              fontSize: '0.813rem',
              padding: '1rem 0.75rem',
              borderBottom: isDark ? '1px solid #2a2a3e' : '1px solid #dee2e6',
              backgroundColor: isDark ? '#252538' : '#f8f9fa',
            }}>{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {currentAdmins.map((admin, index) => (
            <tr key={admin.admin_id} style={{
              borderLeft: `3px solid ${getPerformanceColor(admin.performance_score || 0)}`,
            }}>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${isDark ? 'bg-secondary' : 'bg-light text-dark'}`} style={{ fontSize: '0.75rem' }}>
                    #{startIndex + index + 1}
                  </span>
                  <div>
                    <div className={`fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                      {admin.full_name}
                    </div>
                    <small className={isDark ? 'text-light' : 'text-muted'} style={{ opacity: 0.7 }}>
                      @{admin.username}
                    </small>
                  </div>
                </div>
              </td>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                <span className={isDark ? 'text-light' : 'text-dark'}>
                  {translateDbText(admin.department, 'departments')}
                </span>
              </td>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${getPerformanceBadgeClass(admin.performance_score || 0)}`}>
                    {admin.performance_score || 0}%
                  </span>
                  <div className="progress" style={{ width: '60px', height: '6px' }}>
                    <div 
                      className={`progress-bar ${getPerformanceBadgeClass(admin.performance_score || 0)}`}
                      style={{ width: `${Math.min(admin.performance_score || 0, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </td>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                <span className={`fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                  {admin.total_requests || 0}
                </span>
              </td>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                <span className={`fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                  {admin.completed_requests || 0}
                </span>
              </td>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                <span className={`fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                  {admin.pending_requests || 0}
                </span>
              </td>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                <span className={isDark ? 'text-light' : 'text-muted'}>
                  {formatDuration(admin.avg_response_time_hours || 0)}
                </span>
              </td>
              <td style={{ padding: '0.875rem 0.75rem' }}>
                {admin.has_assignments ? (
                  <span className="badge bg-success">
                    <i className="bi bi-check-circle me-1"></i>
                    {t('active')}
                  </span>
                ) : (
                  <span className="badge bg-secondary">
                    <i className="bi bi-dash-circle me-1"></i>
                    {t('inactive')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {currentAdmins.length === 0 && (
        <div className="text-center py-5" style={{
          backgroundColor: isDark ? '#1e1e2e' : '#f8f9fa'
        }}>
          <i className="bi bi-search" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
          <div className={`mt-3 ${isDark ? 'text-light' : 'text-muted'}`}>
            {t('noAdminsMatch')}
          </div>
        </div>
      )}
    </div>
  );

  // Detailed stats tab
  const renderDetailedStats = () => {
    if (!statistics?.detailed_admins || statistics.detailed_admins.length === 0) {
      return (
        <div className="text-center py-5">
          <i className="bi bi-bar-chart" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          <h5 className="mt-3">{t('noAssignmentData')}</h5>
          <p className="text-muted">{t('noAdminAssignments')}</p>
          <button 
            className="btn btn-primary"
            onClick={() => loadStatistics(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                {t('refreshing')}
              </>
            ) : (
              <>
                <i className="bi bi-arrow-clockwise me-2"></i>
                {t('refreshData')}
              </>
            )}
          </button>
        </div>
      );
    }

    return (
      <div>
        {/* Filter Controls */}
        <div className="card border mb-4" style={cardStyle}>
          <div className="card-body p-3">
            <div className="row g-3">
              <div className="col-md-3">
                <label className={`form-label small fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                  <i className="bi bi-sort-down me-1"></i>
                  {t('sortBy')}
                </label>
                <select
                  className="form-select form-select-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="performance_score">{t('performanceScore')}</option>
                  <option value="total_requests">{t('totalRequestsSort')}</option>
                  <option value="completed_requests">{t('completedRequests')}</option>
                  <option value="avg_response_time_hours">{t('responseTime')}</option>
                  <option value="full_name">{t('name')}</option>
                </select>
              </div>
              
              <div className="col-md-2">
                <label className={`form-label small fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                  <i className="bi bi-arrow-down-up me-1"></i>
                  {t('order')}
                </label>
                <select
                  className="form-select form-select-sm"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="desc">{t('highToLow')}</option>
                  <option value="asc">{t('lowToHigh')}</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className={`form-label small fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                  <i className="bi bi-funnel me-1"></i>
                  {t('activityFilter')}
                </label>
                <select
                  className="form-select form-select-sm"
                  value={filterConfig.hasActivity === null ? '' : filterConfig.hasActivity.toString()}
                  onChange={(e) => setFilterConfig(prev => ({
                    ...prev,
                    hasActivity: e.target.value === '' ? null : e.target.value === 'true'
                  }))}
                >
                  <option value="">{t('allAdmins')}</option>
                  <option value="true">{t('withAssignments')}</option>
                  <option value="false">{t('withoutAssignments')}</option>
                </select>
              </div>

              <div className="col-md-4 d-flex align-items-end">
                <div className={`small ${isDark ? 'text-light' : 'text-muted'}`}>
                  <i className="bi bi-funnel-fill me-1"></i>
                  <strong>{filteredAndSortedAdmins.length}</strong> {t('admins')} {t('found')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card border" style={cardStyle}>
          <div className="card-body p-0">
            {renderAdminTable()}
          </div>
          <div className="card-footer border-top" style={{
            backgroundColor: isDark ? '#252538' : '#f8f9fa',
            borderTop: `1px solid ${isDark ? '#2a2a3e' : '#dee2e6'}`
          }}>
            <PaginationComponent />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid px-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={`mb-1 ${isDark ? 'text-light' : 'text-dark'} fw-semibold`}>
            <i className="bi bi-graph-up me-2"></i>
            {t('adminPerformanceAnalytics')}
            {refreshing && <span className="spinner-border spinner-border-sm ms-2"></span>}
          </h3>
          <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>
            {isSuperAdmin() 
              ? (selectedDepartment ? `${translateDbText(selectedDepartment, 'departments')} ${t('department')}` : t('systemWide'))
              : translateDbText(department, 'departments')
            } • {t('performanceInsights')}
          </p>
        </div>

        <button 
          className="btn btn-primary btn-sm"
          onClick={() => loadStatistics(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <span className="spinner-border spinner-border-sm me-1"></span>
              {t('refreshing')}
            </>
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-1"></i>
              {t('refresh')}
            </>
          )}
        </button>
      </div>

      {/* Period and Department Filters */}
      <div className="row mb-4">
        <div className="col-md-6">
          <label className={`form-label fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
            <i className="bi bi-calendar-range me-1"></i>
            {t('timePeriod')}
          </label>
          <select
            className="form-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="7">{t('last7Days')}</option>
            <option value="30">{t('last30Days')}</option>
            <option value="90">{t('last3Months')}</option>
            <option value="180">{t('last6Months')}</option>
          </select>
        </div>

           {isSuperAdmin() && (
          <div className="col-md-6">
            <label className={`form-label fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
              <i className="bi bi-building me-1"></i>
              {t('department')}
            </label>
            <select
              className="form-select"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                borderColor: isDark ? '#4a5568' : '#cbd5e0',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <option value="">{t('allDepartments')}</option>
              <option value="Accounting">{translateDbText('Accounting', 'departments')}</option>
              <option value="Academic">{translateDbText('Academic', 'departments')}</option>
              <option value="Student Affairs">{translateDbText('Student Affairs', 'departments')}</option>
              <option value="Dormitory">{translateDbText('Dormitory', 'departments')}</option>
              <option value="Campus Services">{translateDbText('Campus Services', 'departments')}</option>
              <option value="Engineering">{translateDbText('Engineering', 'departments')}</option>
              <option value="Architecture">{translateDbText('Architecture', 'departments')}</option>
              <option value="Arts and Sciences">{translateDbText('Arts and Sciences', 'departments')}</option>
              <option value="Business">{translateDbText('Business', 'departments')}</option>
              <option value="Law">{translateDbText('Law', 'departments')}</option>
              <option value="Medicine">{translateDbText('Medicine', 'departments')}</option>
              <option value="Education">{translateDbText('Education', 'departments')}</option>
              <option value="Dentistry">{translateDbText('Dentistry', 'departments')}</option>
              <option value="Pharmacy">{translateDbText('Pharmacy', 'departments')}</option>
              <option value="Dean">{translateDbText('Dean', 'departments')}</option>
              <option value="Institute">{translateDbText('Institute', 'departments')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Enhanced Navigation Tabs */}
      <ul className="nav nav-pills mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            style={{
              backgroundColor: activeTab === 'overview' 
                ? (isDark ? '#0d6efd' : '#0d6efd')
                : 'transparent',
              color: activeTab === 'overview' 
                ? '#ffffff' 
                : (isDark ? '#adb5bd' : '#6c757d'),
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="bi bi-pie-chart me-1"></i>
            {t('overview')}
            {departmentSummary && (
              <span 
                className="badge ms-2" 
                style={{
                  backgroundColor: activeTab === 'overview' 
                    ? 'rgba(255, 255, 255, 0.2)' 
                    : (isDark ? '#495057' : '#e9ecef'),
                  color: activeTab === 'overview' 
                    ? '#ffffff' 
                    : (isDark ? '#adb5bd' : '#6c757d')
                }}
              >
                {departmentSummary.total_admins}
              </span>
            )}
          </button>
        </li>
        <li className="nav-item ms-2" role="presentation">
          <button
            className={`nav-link ${activeTab === 'detailed' ? 'active' : ''}`}
            onClick={() => setActiveTab('detailed')}
            type="button"
            role="tab"
            aria-selected={activeTab === 'detailed'}
            style={{
              backgroundColor: activeTab === 'detailed' 
                ? (isDark ? '#0d6efd' : '#0d6efd')
                : 'transparent',
              color: activeTab === 'detailed' 
                ? '#ffffff' 
                : (isDark ? '#adb5bd' : '#6c757d'),
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="bi bi-table me-1"></i>
            {t('assignmentAnalysis')}
            {statistics?.detailed_admins && (
              <span 
                className="badge ms-2" 
                style={{
                  backgroundColor: activeTab === 'detailed' 
                    ? 'rgba(255, 255, 255, 0.2)' 
                    : (isDark ? '#495057' : '#e9ecef'),
                  color: activeTab === 'detailed' 
                    ? '#ffffff' 
                    : (isDark ? '#adb5bd' : '#6c757d')
                }}
              >
                {filteredAndSortedAdmins.length}
              </span>
            )}
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'detailed' && renderDetailedStats()}
      </div>

      {/* Error State */}
      {!loading && !statistics && (
        <div className="card border" style={cardStyle}>
          <div className="card-body text-center py-5">
            <i className="bi bi-exclamation-triangle" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
            <h5 className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>{t('failedToLoadStatistics')}</h5>
            <p className={isDark ? 'text-light' : 'text-muted'}>{t('unableToFetchData')}</p>
            <button 
              className="btn btn-danger"
              onClick={() => loadStatistics()}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              {t('retry')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStatisticsPage;