import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const StudentManagementPage = () => {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();

  const [students, setStudents]     = useState([]);
  const [stats, setStats]           = useState({ total: 0, active: 0, inactive: 0, google_auth: 0, local_auth: 0 });
  const [loading, setLoading]       = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null); // student obj

  const searchRef = useRef(search);
  searchRef.current = search;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchStats = async () => {
    try {
      const res = await apiService.getStudentManagementStats();
      if (res.data.success) setStats(res.data.data);
    } catch (e) { console.error(e); }
  };

  const fetchStudents = async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiService.getStudents({
        page, limit: 20,
        search: searchRef.current,
        filter: filterRef.current,
      });
      if (res.data.success) {
        setStudents(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (e) {
      showError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchStudents(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (val) => {
    setFilter(val);
    filterRef.current = val;
    fetchStudents(1);
  };

  const handleSearch = () => fetchStudents(1);

  const handleToggleActive = async (student) => {
    try {
      const res = await apiService.toggleStudentActive(student.student_id);
      if (res.data.success) {
        showSuccess(res.data.message);
        fetchStudents(pagination.page);
        fetchStats();
      }
    } catch (e) {
      showError(e.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    try {
      const res = await apiService.deleteStudent(confirmDelete.student_id);
      if (res.data.success) {
        showSuccess(res.data.message);
        setConfirmDelete(null);
        fetchStudents(1);
        fetchStats();
      }
    } catch (e) {
      showError(e.response?.data?.error || 'Failed to delete student');
      setConfirmDelete(null);
    }
  };

  const c = {
    bg:          isDark ? '#0A0A0E' : '#F8F9FA',
    card:        isDark ? '#16161C' : '#FFFFFF',
    card2:       isDark ? '#1E1E26' : '#F1F3F5',
    border:      isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    text:        isDark ? '#F2F2F7' : '#1A1A2E',
    muted:       isDark ? 'rgba(242,242,247,0.45)' : 'rgba(26,26,46,0.55)',
    input:       isDark ? '#1E1E26' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    red:         '#C8102E',
    redLight:    'rgba(200,16,46,0.1)',
    redBorder:   'rgba(200,16,46,0.3)',
    green:       '#22C55E',
    greenLight:  'rgba(34,197,94,0.1)',
    greenBorder: 'rgba(34,197,94,0.3)',
    yellow:      '#F59E0B',
    yellowLight: 'rgba(245,158,11,0.1)',
    yellowBorder:'rgba(245,158,11,0.3)',
    blue:        '#3B82F6',
    blueLight:   'rgba(59,130,246,0.1)',
    blueBorder:  'rgba(59,130,246,0.3)',
  };

  const inputStyle = {
    background: c.input,
    border: `1px solid ${c.inputBorder}`,
    borderRadius: '10px',
    color: c.text,
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  const statCards = [
    { label: t('totalStudents', 'Total Students'), value: stats.total,    color: c.red,    bg: c.redLight,    border: c.redBorder },
    { label: t('active', 'Active'),                value: stats.active,   color: c.green,  bg: c.greenLight,  border: c.greenBorder },
    { label: t('inactive', 'Inactive'),            value: stats.inactive, color: c.yellow, bg: c.yellowLight, border: c.yellowBorder },
    { label: 'Google Auth',                        value: stats.google_auth, color: c.blue, bg: c.blueLight, border: c.blueBorder },
  ];

  const filters = [
    { value: 'all',      label: t('allRequests', 'All') },
    { value: 'active',   label: t('active', 'Active') },
    { value: 'inactive', label: t('inactive', 'Inactive') },
    { value: 'google',   label: 'Google' },
    { value: 'local',    label: 'Local' },
  ];

  return (
    <div style={{ background: c.bg, minHeight: '100%', padding: '24px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .sm-input:focus { border-color: rgba(200,16,46,0.5) !important; box-shadow: 0 0 0 3px rgba(200,16,46,0.08) !important; }
        .sm-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important; }
        .sm-btn { transition: all 0.2s ease; cursor: pointer; }
        .sm-btn:hover { transform: translateY(-1px); }
        .filter-btn { transition: all 0.15s ease; cursor: pointer; }
        @keyframes sm-spin { to { transform: rotate(360deg); } }
        @keyframes sm-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .sm-card { animation: sm-fade 0.3s ease; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ color: c.text, fontWeight: 700, fontSize: '22px', margin: '0 0 4px' }}>
          {t('userManagement', 'Student Management')}
        </h2>
        <p style={{ color: c.muted, fontSize: '14px', margin: 0 }}>
          {t('manageUserAccountsAndRoles', 'View, manage and remove registered students')}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {statCards.map(s => (
          <div key={s.label} className="sm-card" style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: '14px',
            padding: '18px 20px',
          }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: c.muted, marginTop: '3px' }}>{s.label}</div>
            <div style={{ height: '2px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '4px', marginTop: '10px' }}>
              <div style={{ height: '100%', width: stats.total > 0 ? `${(s.value / stats.total) * 100}%` : '0%', background: s.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Table */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '14px', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            className="sm-input"
            style={{ ...inputStyle, minWidth: '220px', flex: 1, maxWidth: '300px' }}
            placeholder={`${t('search', 'Search')}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="sm-btn" onClick={handleSearch} style={{
            background: c.red, border: 'none', borderRadius: '10px',
            color: 'white', padding: '10px 18px', fontSize: '13px', fontWeight: 600,
          }}>
            {t('search', 'Search')}
          </button>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '6px', marginLeft: '4px' }}>
            {filters.map(f => (
              <button key={f.value} className="filter-btn" onClick={() => handleFilterChange(f.value)} style={{
                background: filter === f.value ? c.red : c.card2,
                border: `1px solid ${filter === f.value ? c.red : c.border}`,
                borderRadius: '8px',
                color: filter === f.value ? 'white' : c.muted,
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: filter === f.value ? 600 : 400,
                fontFamily: 'inherit',
              }}>
                {f.label}
              </button>
            ))}
          </div>

          <span style={{ marginLeft: 'auto', fontSize: '13px', color: c.muted }}>
            {pagination.total} {t('student', 'student')}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: c.card2 }}>
                {['', t('studentNumber', 'Student No'), t('name', 'Name'), t('email', 'Email'), t('program', 'Program'), t('faculty', 'Faculty'), 'Auth', t('status', 'Status'), t('created', 'Registered'), t('actions', 'Actions')].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 14px', fontSize: '11px', fontWeight: 600,
                    color: c.muted, textAlign: 'left', textTransform: 'uppercase',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: c.muted }}>
                      <div style={{ width: '18px', height: '18px', border: `2px solid ${c.inputBorder}`, borderTopColor: c.red, borderRadius: '50%', animation: 'sm-spin 0.7s linear infinite' }} />
                      {t('loading', 'Loading')}...
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ color: c.muted, fontSize: '14px' }}>
                      <i className="bi bi-people" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />
                      {t('noUsersFound', 'No students found')}
                    </div>
                  </td>
                </tr>
              ) : students.map(student => (
                <tr key={student.student_id} className="sm-row" style={{ borderBottom: `1px solid ${c.border}` }}>
                  {/* Avatar */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: c.redLight, border: `1px solid ${c.redBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: c.red, fontSize: '13px', fontWeight: 700, flexShrink: 0,
                    }}>
                      {student.name ? student.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  </td>
                  {/* Student No */}
                  <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>
                    {student.student_number}
                  </td>
                  {/* Name */}
                  <td style={{ padding: '10px 14px', fontSize: '13px', color: c.text, whiteSpace: 'nowrap' }}>
                    {student.name || <span style={{ color: c.muted }}>—</span>}
                  </td>
                  {/* Email */}
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: c.muted }}>
                    {student.email}
                  </td>
                  {/* Program */}
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: c.muted, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {student.program || '—'}
                  </td>
                  {/* Faculty */}
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: c.muted, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {student.faculty || '—'}
                  </td>
                  {/* Auth provider */}
                  <td style={{ padding: '10px 14px' }}>
                    {student.auth_provider === 'google' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: c.blue, background: c.blueLight, border: `1px solid ${c.blueBorder}`, borderRadius: '20px', padding: '2px 8px' }}>
                        <i className="bi bi-google" />Google
                      </span>
                    ) : student.auth_provider === 'both' ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: c.green, background: c.greenLight, border: `1px solid ${c.greenBorder}`, borderRadius: '20px', padding: '2px 8px' }}>
                        Both
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: c.muted, background: c.card2, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '2px 8px' }}>
                        Local
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
                      background: student.is_active ? c.greenLight : c.yellowLight,
                      color:      student.is_active ? c.green      : c.yellow,
                      border:    `1px solid ${student.is_active ? c.greenBorder : c.yellowBorder}`,
                    }}>
                      {student.is_active ? t('active', 'Active') : t('inactive', 'Inactive')}
                    </span>
                  </td>
                  {/* Registered date */}
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: c.muted, whiteSpace: 'nowrap' }}>
                    {student.created_at ? new Date(student.created_at).toLocaleDateString() : '—'}
                  </td>
                  {/* Actions */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {/* Toggle active */}
                      <button
                        className="sm-btn"
                        onClick={() => handleToggleActive(student)}
                        title={student.is_active ? t('disable', 'Deactivate') : t('enable', 'Activate')}
                        style={{
                          background: 'none',
                          border: `1px solid ${student.is_active ? c.yellowBorder : c.greenBorder}`,
                          borderRadius: '7px',
                          color: student.is_active ? c.yellow : c.green,
                          padding: '5px 8px',
                          fontSize: '13px',
                        }}
                      >
                        <i className={`bi bi-${student.is_active ? 'pause-circle' : 'play-circle'}`} />
                      </button>
                      {/* Delete */}
                      <button
                        className="sm-btn"
                        onClick={() => setConfirmDelete(student)}
                        title={t('delete', 'Delete')}
                        style={{
                          background: 'none',
                          border: `1px solid ${c.redBorder}`,
                          borderRadius: '7px',
                          color: c.red,
                          padding: '5px 8px',
                          fontSize: '13px',
                        }}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'center', gap: '6px' }}>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => fetchStudents(p)} style={{
                width: '34px', height: '34px', borderRadius: '8px',
                border: `1px solid ${p === pagination.page ? c.red : c.border}`,
                background: p === pagination.page ? c.red : 'transparent',
                color: p === pagination.page ? 'white' : c.muted,
                fontSize: '13px', fontWeight: p === pagination.page ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }}>
          <div className="sm-card" style={{
            background: c.card, border: `1px solid ${c.border}`,
            borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: c.redLight, border: `1px solid ${c.redBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <i className="bi bi-exclamation-triangle" style={{ fontSize: '20px', color: c.red }} />
            </div>
            <h3 style={{ color: c.text, fontWeight: 700, fontSize: '17px', margin: '0 0 8px' }}>
              {t('deleteUser', 'Delete Student')}
            </h3>
            <p style={{ color: c.muted, fontSize: '14px', margin: '0 0 6px', lineHeight: 1.6 }}>
              <strong style={{ color: c.text }}>{confirmDelete.name}</strong> ({confirmDelete.student_number}) {t('deleteEntryConfirm', 'will be permanently deleted.')}
            </p>
            <p style={{ color: c.muted, fontSize: '13px', margin: '0 0 24px', lineHeight: 1.6 }}>
              <i className="bi bi-info-circle" style={{ marginRight: '5px' }} />
              Whitelist entry will be reset so they can re-register.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, background: c.card2, border: `1px solid ${c.border}`,
                borderRadius: '10px', color: c.muted, padding: '11px',
                fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {t('cancel', 'Cancel')}
              </button>
              <button onClick={handleDeleteConfirm} style={{
                flex: 1, background: c.red, border: 'none',
                borderRadius: '10px', color: 'white', padding: '11px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                <i className="bi bi-trash3" />
                {t('delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagementPage;