// ===== ADMIN STATISTICS PAGE WITH TABLE VIEW AND PAGINATION - FIXED =====
// frontend/src/components/AdminStatisticsPage.js

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

  // Load statistics - FIXED: Removed dependencies that cause loops
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

  // FIXED: Only load on mount and when period/department changes
  useEffect(() => {
    loadStatistics();
  }, [selectedPeriod, selectedDepartment]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterConfig, sortBy, sortOrder]);

  // Card style
  const cardStyle = useMemo(() => ({
    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000',
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
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
      
      // Handle string sorting
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
    if (performance >= 90) return 'bg-info';
    if (performance >= 80) return 'bg-info';
    if (performance >= 70) return 'bg-info';
    if (performance >= 50) return 'bg-info';
    return 'bg-info';
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
      style={{ cursor: 'pointer' }}
    >
      <div className="d-flex align-items-center justify-content-between">
        {children}
        {sortBy === field && (
          <span className="ms-1">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  // Pagination Component
  const PaginationComponent = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="d-flex justify-content-between align-items-center mt-4">
        <div className={`text-sm ${isDark ? 'text-light' : 'text-muted'}`}>
          {t('showing')} {startIndex + 1}-{Math.min(endIndex, filteredAndSortedAdmins.length)} {t('of')} {filteredAndSortedAdmins.length} {t('admins')}
        </div>
        
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                {t('first')}
              </button>
            </li>
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                {t('previous')}
              </button>
            </li>
            
            {/* Page numbers */}
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
                {t('next')}
              </button>
            </li>
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                {t('last')}
              </button>
            </li>
          </ul>
        </nav>

        <div className="d-flex align-items-center">
          <small className={`me-2 ${isDark ? 'text-light' : 'text-muted'}`}>{t('itemsPerPage')}</small>
          <select 
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
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
        {/* Department Summary */}
        {departmentSummary && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-3 shadow-sm" style={cardStyle}>
                <div className="card-header border-3 ">
                  <h5 className="mb-0">
                    {isSuperAdmin() && selectedDepartment ? selectedDepartment : department} {t('performanceDashboard')}
                  </h5>
                  <small className="text-muted">
                    {t('assignmentTracking')}
                  </small>
                </div>
                <div className="card-body">
                  {/* Metrics Row */}
                  <div className="row text-center mb-3">
                    <div className="col-md-3">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_admins}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('totalAdmins')}</small>
                    </div>
                    <div className="col-md-3">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_requests}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('totalRequests')}</small>
                    </div>
                    <div className="col-md-3">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_completed}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('completed')}</small>
                    </div>
                    <div className="col-md-3">
                      <div className="h3 text-primary mb-1">{departmentSummary.total_pending}</div>
                      <small className={isDark ? 'text-light' : 'text-muted'}>{t('pending')}</small>
                    </div>
                  </div>
                  
                  {/* Progress Bars */}
                  <div className="row mt-4">
                    <div className="col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>{t('completionRate')}</small>
                        <small className="text-info"><strong>{departmentSummary.completion_rate}%</strong></small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-info" style={{ width: `${departmentSummary.completion_rate}%` }}></div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>{t('teamUtilization')}</small>
                        <small className="text-info"><strong>{departmentSummary.utilization_rate}%</strong></small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-info" style={{ width: `${departmentSummary.utilization_rate}%` }}></div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className={isDark ? 'text-light' : 'text-muted'}>{t('avgPerformance')}</small>
                        <small className="text-info">
                          <strong>{departmentSummary.avg_performance}%</strong>
                        </small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-info" style={{ width: `${departmentSummary.avg_performance}%` }}></div>
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
      <table className={`table table-hover ${isDark ? 'table-dark' : ''}`}>
        <thead className={isDark ? 'table-dark' : 'table-light'}>
          <tr>
            <TableHeader field="full_name">{t('admin')}</TableHeader>
            <TableHeader field="department">{t('department')}</TableHeader>
            <TableHeader field="performance_score">{t('performance')}</TableHeader>
            <TableHeader field="total_requests">{t('assigned')}</TableHeader>
            <TableHeader field="completed_requests">{t('completed')}</TableHeader>
            <TableHeader field="pending_requests">{t('pending')}</TableHeader>
            <TableHeader field="avg_response_time_hours">{t('avgResponse')}</TableHeader>
            <th>{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {currentAdmins.map((admin, index) => (
            <tr key={admin.admin_id}>
              <td>
                <div className="d-flex align-items-center">
                  <span className="badge bg-secondary me-2">#{startIndex + index + 1}</span>
                  <div>
                    <div className={`fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                      {admin.full_name}
                      
                    </div>
                    <small className={isDark ? 'text-light' : 'text-muted'}>@{admin.username}</small>
                  </div>
                </div>
              </td>
              <td>
  <span className="text">{translateDbText(admin.department, 'departments')}</span>
              </td>
              <td>
                <div className="d-flex align-items-center">
                  <span className={`badge ${getPerformanceBadgeClass(admin.performance_score || 0)} me-2`}>
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
              <td>
                <span className="text">{admin.total_requests || 0}</span>
              </td>
              <td>
                <span className=" text">{admin.completed_requests || 0}</span>
              </td>
              <td>
                <span className="text">{admin.pending_requests || 0}</span>
              </td>
              <td>
                <span className="text">
                  {formatDuration(admin.avg_response_time_hours || 0)}
                </span>
              </td>
              <td>
                {admin.has_assignments ? (
                  <span className="badge bg-info">{t('active')}</span>
                ) : (
                  <span className="badge bg-danger">{t('inactive')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {currentAdmins.length === 0 && (
        <div className="text-center py-4">
          <div className={isDark ? 'text-light' : 'text-muted'}>
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
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>📊</div>
            <h5 className="mt-3">{t('noAssignmentData')}</h5>
            <p>{t('noAdminAssignments')}</p>
            <button 
              className="btn btn-outline-primary"
              onClick={() => loadStatistics(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  {t('refreshing')}
                </>
              ) : (
                t('refreshData')
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Filter Controls */}
        <div className="row mb-4">
          <div className="col-md-3">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>{t('sortBy')}</label>
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
              <option value="performance_score">{t('performanceScore')}</option>
              <option value="total_requests">{t('totalRequestsSort')}</option>
              <option value="completed_requests">{t('completedRequests')}</option>
              <option value="avg_response_time_hours">{t('responseTime')}</option>
              <option value="full_name">{t('name')}</option>
            </select>
          </div>
          
          <div className="col-md-2">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>{t('order')}</label>
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
              <option value="desc">{t('highToLow')}</option>
              <option value="asc">{t('lowToHigh')}</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>{t('activityFilter')}</label>
            <select
              className="form-select form-select-sm"
              value={filterConfig.hasActivity === null ? '' : filterConfig.hasActivity.toString()}
              onChange={(e) => setFilterConfig(prev => ({
                ...prev,
                hasActivity: e.target.value === '' ? null : e.target.value === 'true'
              }))}
              style={{
                backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
                borderColor: isDark ? '#444444' : '#ced4da',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <option value="">{t('allAdmins')}</option>
              <option value="true">{t('withAssignments')}</option>
              <option value="false">{t('withoutAssignments')}</option>
            </select>
          </div>

         
        </div>

        {/* Table and Pagination */}
        <div>
          {renderAdminTable()}
          <PaginationComponent />
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={`${isDark ? 'text-light' : 'text-dark'} d-flex align-items-center`}>
            {t('adminPerformanceAnalytics')}
            {refreshing && <span className="spinner-border spinner-border-sm ms-2"></span>}
          </h3>
         <p className={isDark ? 'text-light' : 'text-muted'}>
  {isSuperAdmin() 
    ? (selectedDepartment ? `${translateDbText(selectedDepartment, 'departments')} ${t('department')}` : t('systemWide'))
    : translateDbText(department, 'departments')
  } {t('performanceInsights')}
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
                {t('refreshing')}
              </>
            ) : (
              t('refresh')
            )}
          </button>
        </div>
      </div>

      {/* Period and Department Filters */}
      <div className="row mb-4">
        <div className="col-md-6">
          <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>{t('timePeriod')}</label>
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
            <option value="7">{t('last7Days')}</option>
            <option value="30">{t('last30Days')}</option>
            <option value="90">{t('last3Months')}</option>
            <option value="180">{t('last6Months')}</option>
          </select>
        </div>

        {isSuperAdmin() && (
          <div className="col-md-6">
            <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>{t('department')}</label>
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
<option value="Accounting">{translateDbText('Accounting', 'departments')}</option>
<option value="Academic">{translateDbText('Academic', 'departments')}</option>
<option value="Student Affairs">{translateDbText('Student Affairs', 'departments')}</option>
<option value="Dormitory">{translateDbText('Dormitory', 'departments')}</option>
<option value="Campus Services">{translateDbText('Campus Services', 'departments')}</option>
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
            {t('overview')}
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
            {t('assignmentAnalysis')}
            {statistics?.detailed_admins && (
              <span className="badge bg-light text-dark ms-1">
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
        <div className="text-center py-5">
          <div className="text-muted">
            <div style={{ fontSize: '4rem' }}>⚠️</div>
            <h5 className="mt-3">{t('failedToLoadStatistics')}</h5>
            <p>{t('unableToFetchData')}</p>
            <button 
              className="btn btn-danger"
              onClick={() => loadStatistics()}
            >
              {t('retry')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStatisticsPage;