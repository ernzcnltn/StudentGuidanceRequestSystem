// frontend/src/components/AdvancedSearch.js
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AdvancedSearch = ({ onSearchResults, userType = 'student', department = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestTypes, setRequestTypes] = useState([]);
  
  const [filters, setFilters] = useState({
    keyword: '',
    status: '',
    type_id: '',
    priority: '',
    student_number: '',
    date_from: '',
    date_to: '',
    sort_by: 'submitted_at',
    sort_order: 'desc'
  });

  const [savedSearches, setSavedSearches] = useState([]);

  useEffect(() => {
    fetchRequestTypes();
    loadSavedSearches();
  }, []);

  const fetchRequestTypes = async () => {
    try {
      let response;
      if (userType === 'admin') {
        response = await apiService.getAdminRequestTypes();
      } else {
        response = await apiService.getRequestTypes();
      }
      
      if (response.data.success) {
        setRequestTypes(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching request types:', error);
    }
  };

  const loadSavedSearches = () => {
    const saved = localStorage.getItem(`saved_searches_${userType}`);
    if (saved) {
      setSavedSearches(JSON.parse(saved));
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      let response;
      
      if (userType === 'admin') {
        response = await apiService.searchAdminRequests({
          ...filters,
          department
        });
      } else {
        response = await apiService.searchStudentRequests(filters);
      }
      
      if (response.data.success) {
        onSearchResults(response.data.data);
      }
    } catch (error) {
      console.error('Search error:', error);
      onSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilters({
      keyword: '',
      status: '',
      type_id: '',
      priority: '',
      student_number: '',
      date_from: '',
      date_to: '',
      sort_by: 'submitted_at',
      sort_order: 'desc'
    });
    onSearchResults(null); // Reset to show all
  };

  const saveSearch = () => {
    const searchName = prompt('Enter a name for this search:');
    if (searchName && searchName.trim()) {
      const newSearch = {
        id: Date.now(),
        name: searchName.trim(),
        filters: { ...filters },
        created_at: new Date().toISOString()
      };
      
      const updated = [...savedSearches, newSearch];
      setSavedSearches(updated);
      localStorage.setItem(`saved_searches_${userType}`, JSON.stringify(updated));
    }
  };

  const loadSavedSearch = (search) => {
    setFilters(search.filters);
  };

  const deleteSavedSearch = (searchId) => {
    const updated = savedSearches.filter(s => s.id !== searchId);
    setSavedSearches(updated);
    localStorage.setItem(`saved_searches_${userType}`, JSON.stringify(updated));
  };

  const getQuickFilters = () => {
    const quick = [
      { label: 'Today', filter: { date_from: new Date().toISOString().split('T')[0] } },
      { label: 'This Week', filter: { date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] } },
      { label: 'This Month', filter: { date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] } },
      { label: 'Urgent Only', filter: { priority: 'Urgent' } },
      { label: 'Pending Only', filter: { status: 'Pending' } },
      { label: 'Completed Only', filter: { status: 'Completed' } }
    ];
    return quick;
  };

  const applyQuickFilter = (quickFilter) => {
    setFilters({ ...filters, ...quickFilter.filter });
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== '').length;
  };

  return (
    <div className="card mb-4">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <h6 className="mb-0 me-3">🔍 Advanced Search & Filters</h6>
            {getActiveFilterCount() > 0 && (
              <span className="badge bg-primary">{getActiveFilterCount()} active</span>
            )}
          </div>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? '🔼 Hide' : '🔽 Show'} Filters
          </button>
        </div>
      </div>
      
      {isOpen && (
        <div className="card-body">
          {/* Quick Filters */}
          <div className="mb-3">
            <label className="form-label">Quick Filters:</label>
            <div className="d-flex flex-wrap gap-2">
              {getQuickFilters().map((quick, index) => (
                <button
                  key={index}
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => applyQuickFilter(quick)}
                >
                  {quick.label}
                </button>
              ))}
            </div>
          </div>

          <hr />

          {/* Search Form */}
          <div className="row">
            {/* Keyword Search */}
            <div className="col-md-6 mb-3">
              <label className="form-label">🔍 Keyword Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search in request content, student name..."
                value={filters.keyword}
                onChange={(e) => setFilters({...filters, keyword: e.target.value})}
              />
            </div>

            {/* Status Filter */}
            <div className="col-md-3 mb-3">
              <label className="form-label">📊 Status</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Informed">Informed</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="col-md-3 mb-3">
              <label className="form-label">🚨 Priority</label>
              <select
                className="form-select"
                value={filters.priority}
                onChange={(e) => setFilters({...filters, priority: e.target.value})}
              >
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Request Type Filter */}
            <div className="col-md-6 mb-3">
              <label className="form-label">📝 Request Type</label>
              <select
                className="form-select"
                value={filters.type_id}
                onChange={(e) => setFilters({...filters, type_id: e.target.value})}
              >
                <option value="">All Types</option>
                {userType === 'admin' ? (
                  requestTypes.map(type => (
                    <option key={type.type_id} value={type.type_id}>
                      {type.type_name}
                    </option>
                  ))
                ) : (
                  Object.keys(requestTypes).map(category => (
                    <optgroup key={category} label={category}>
                      {requestTypes[category].map(type => (
                        <option key={type.type_id} value={type.type_id}>
                          {type.type_name}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            </div>

            {/* Student Number (Admin only) */}
            {userType === 'admin' && (
              <div className="col-md-6 mb-3">
                <label className="form-label">👨‍🎓 Student Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="20210001"
                  value={filters.student_number}
                  onChange={(e) => setFilters({...filters, student_number: e.target.value})}
                />
              </div>
            )}

            {/* Date Range */}
            <div className="col-md-3 mb-3">
              <label className="form-label"> From Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.date_from}
                onChange={(e) => setFilters({...filters, date_from: e.target.value})}
              />
            </div>

            <div className="col-md-3 mb-3">
              <label className="form-label"> To Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.date_to}
                onChange={(e) => setFilters({...filters, date_to: e.target.value})}
              />
            </div>

            {/* Sort Options */}
            <div className="col-md-3 mb-3">
              <label className="form-label">🔄 Sort By</label>
              <select
                className="form-select"
                value={filters.sort_by}
                onChange={(e) => setFilters({...filters, sort_by: e.target.value})}
              >
                <option value="submitted_at">Submit Date</option>
                <option value="updated_at">Last Update</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
                <option value="student_name">Student Name</option>
              </select>
            </div>

            <div className="col-md-3 mb-3">
              <label className="form-label"> Sort Order</label>
              <select
                className="form-select"
                value={filters.sort_order}
                onChange={(e) => setFilters({...filters, sort_order: e.target.value})}
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex gap-2">
              <button
                className="btn btn-primary"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Searching...
                  </>
                ) : (
                  '🔍 Search'
                )}
              </button>
              
              <button className="btn btn-outline-secondary" onClick={handleReset}>
                🔄 Reset
              </button>
              
              <button className="btn btn-outline-info" onClick={saveSearch}>
                💾 Save Search
              </button>
            </div>

            {/* Export Options */}
            <div className="dropdown">
              <button
                className="btn btn-outline-success dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
              >
                📊 Export
              </button>
              <ul className="dropdown-menu">
                <li>
                  <button className="dropdown-item" onClick={() => alert('CSV export coming soon!')}>
                    📄 Export as CSV
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => alert('PDF export coming soon!')}>
                    📕 Export as PDF
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => alert('Excel export coming soon!')}>
                    📊 Export as Excel
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <>
              <hr />
              <div>
                <label className="form-label">💾 Saved Searches:</label>
                <div className="d-flex flex-wrap gap-2">
                  {savedSearches.map(search => (
                    <div key={search.id} className="border rounded p-2 d-flex align-items-center gap-2">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => loadSavedSearch(search)}
                      >
                        {search.name}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteSavedSearch(search.id)}
                        title="Delete saved search"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;