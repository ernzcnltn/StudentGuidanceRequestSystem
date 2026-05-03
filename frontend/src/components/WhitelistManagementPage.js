import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from './ConfirmationModal';
import { apiService } from '../services/api';

const WhitelistManagementPage = () => {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const { confirmationState, showConfirmation } = useConfirmation();

  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ total: 0, used: 0, available: 0 });
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [uploadMode, setUploadMode] = useState('append');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ student_number: '', name: '', program: '', faculty: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const searchRef = useRef(search);
  searchRef.current = search;

  const fetchStats = async () => {
    try {
      const res = await apiService.getWhitelistStats();
      if (res.data.success) setStats(res.data.data);
    } catch (e) {
      console.error('Stats fetch error:', e);
    }
  };

  const fetchEntries = async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiService.getWhitelist({ page, limit: 20, search: searchRef.current });
      if (res.data.success) {
        setEntries(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (e) {
      showError(t('failedToLoadInstituteRequests'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchEntries(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
      showError(t('onlyExcelCsvAllowed'));
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', uploadMode);
      const res = await apiService.uploadWhitelist(formData);
      if (res.data.success) {
        const { inserted, skipped, errors, total } = res.data.data;
        showSuccess(
          `${t('importDone')}: ${inserted} ${t('rowsAdded')}, ${skipped} ${t('rowsSkipped')}, ${errors} ${t('rowsErrors')} / ${total} ${t('rowsOutOf')}`
        );
        fetchStats();
        fetchEntries(1);
      }
    } catch (e) {
      showError(e.response?.data?.error || t('failedToUploadCourses'));
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await apiService.downloadWhitelistTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'whitelist_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showError(t('failedToDownloadTemplate'));
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newEntry.student_number.trim()) {
      showError(t('studentNumberRequired'));
      return;
    }
    setAddLoading(true);
    try {
      await apiService.addToWhitelist(newEntry);
      showSuccess(t('studentAdded'));
      setNewEntry({ student_number: '', name: '', program: '', faculty: '' });
      setShowAddForm(false);
      fetchStats();
      fetchEntries(1);
    } catch (e) {
      showError(e.response?.data?.error || t('failedToAddRequestType'));
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id, studentNumber) => {
    const confirmed = await showConfirmation({
      title: t('delete', 'Delete Entry'),
      message: `${studentNumber} — ${t('deleteEntryConfirm', 'Are you sure you want to remove this entry?')}`,
      type: 'danger',
      confirmText: t('delete', 'Delete'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) return;
    try {
      await apiService.deleteWhitelistEntry(id);
      showSuccess(t('entryDeleted'));
      fetchStats();
      fetchEntries(pagination.page);
    } catch (e) {
      showError(e.response?.data?.error || t('failedToDeletePermission'));
    }
  };

  const handleDeleteUnused = async () => {
    const confirmed = await showConfirmation({
      title: t('clearUnused', 'Clear Unused'),
      message: `${stats.available} ${t('clearUnusedConfirm', 'unused entries will be permanently deleted. Continue?')}`,
      type: 'danger',
      confirmText: t('clearUnused', 'Clear'),
      cancelText: t('cancel', 'Cancel'),
    });
    if (!confirmed) return;
    try {
      const res = await apiService.deleteUnusedWhitelist();
      showSuccess(res.data.message);
      fetchStats();
      fetchEntries(1);
    } catch (e) {
      showError(t('failedToDeletePermission'));
    }
  };

  const c = {
    bg: isDark ? '#0A0A0E' : '#F8F9FA',
    card: isDark ? '#16161C' : '#FFFFFF',
    card2: isDark ? '#1E1E26' : '#F1F3F5',
    border: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#F2F2F7' : '#1A1A2E',
    muted: isDark ? 'rgba(242,242,247,0.45)' : 'rgba(26,26,46,0.55)',
    input: isDark ? '#1E1E26' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    red: '#C8102E',
    redLight: 'rgba(200,16,46,0.1)',
    redBorder: 'rgba(200,16,46,0.3)',
    green: '#22C55E',
    greenLight: 'rgba(34,197,94,0.1)',
    greenBorder: 'rgba(34,197,94,0.3)',
    yellow: '#F59E0B',
    yellowLight: 'rgba(245,158,11,0.1)',
    yellowBorder: 'rgba(245,158,11,0.3)',
  };

  const inputStyle = {
    background: c.input,
    border: `1px solid ${c.inputBorder}`,
    borderRadius: '10px',
    color: c.text,
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ background: c.bg, minHeight: '100%', padding: '24px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .wl-input:focus { border-color: rgba(200,16,46,0.5) !important; box-shadow: 0 0 0 3px rgba(200,16,46,0.08) !important; }
        .wl-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important; }
        .wl-btn { transition: all 0.2s ease; }
        .wl-btn:hover { transform: translateY(-1px); }
        .wl-del:hover { color: #C8102E !important; }
        @keyframes wl-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ color: c.text, fontWeight: 700, fontSize: '22px', margin: '0 0 4px' }}>
          {t('studentWhitelist')}
        </h2>
        <p style={{ color: c.muted, fontSize: '14px', margin: 0 }}>
          {t('whitelistSubtitle')}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: t('totalEntries'), value: stats.total, color: c.red, bg: c.redLight, border: c.redBorder },
          { label: t('availableEntries'), value: stats.available, color: c.green, bg: c.greenLight, border: c.greenBorder },
          { label: t('usedRegistered'), value: stats.used, color: c.yellow, bg: c.yellowLight, border: c.yellowBorder },
        ].map(s => (
          <div key={s.label} style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: '14px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: c.muted, marginTop: '4px' }}>{s.label}</div>
            <div style={{ height: '3px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '4px', marginTop: '12px' }}>
              <div style={{ height: '100%', width: stats.total > 0 ? `${(s.value / stats.total) * 100}%` : '0%', background: s.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Actions Row */}
      <div style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* Upload Section */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: c.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('excelCsvImport')}
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              style={{
                border: `2px dashed ${dragOver ? c.red : c.inputBorder}`,
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                background: dragOver ? c.redLight : c.input,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => document.getElementById('wl-file-input').click()}
            >
              <input
                id="wl-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files[0])}
              />
              {uploadLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: c.muted }}>
                  <div style={{ width: '16px', height: '16px', border: `2px solid ${c.inputBorder}`, borderTopColor: c.red, borderRadius: '50%', animation: 'wl-spin 0.7s linear infinite' }} />
                  {t('uploading')}...
                </div>
              ) : (
                <div>
                  <i className="bi bi-folder2-open" style={{ fontSize: '24px', color: c.muted }} />
                  <div style={{ fontSize: '13px', color: c.muted }}>{t('dropFileHereOrClick')}</div>
                  <div style={{ fontSize: '11px', color: c.muted, marginTop: '2px' }}>{t('xlsxXlsCsvOnly')}</div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Mode */}
          <div style={{ minWidth: '160px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: c.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('importMode')}
            </div>
            <select
              className="wl-input"
              value={uploadMode}
              onChange={(e) => setUploadMode(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="append">{t('appendKeepExisting')}</option>
              <option value="replace">{t('replaceUnusedEntries')}</option>
            </select>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="wl-btn"
              onClick={handleDownloadTemplate}
              style={{
                background: c.card2,
                border: `1px solid ${c.border}`,
                borderRadius: '10px',
                color: c.text,
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <><i className="bi bi-download" style={{ marginRight: '6px' }} />{t('downloadTemplate')}</>
            </button>
            <button
              className="wl-btn"
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                background: c.red,
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('addSingleEntry')}
            </button>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAdd} style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: `1px solid ${c.border}`,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}>
            {[
              { key: 'student_number', label: `${t('studentNumber')} *`, placeholder: '20200001' },
              { key: 'name', label: t('fullName'), placeholder: 'John Doe' },
              { key: 'program', label: t('program'), placeholder: 'Computer Engineering' },
              { key: 'faculty', label: t('faculty'), placeholder: 'Engineering' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: '12px', color: c.muted, display: 'block', marginBottom: '5px', fontWeight: 500 }}>
                  {field.label}
                </label>
                <input
                  className="wl-input"
                  style={inputStyle}
                  placeholder={field.placeholder}
                  value={newEntry[field.key]}
                  onChange={(e) => setNewEntry({ ...newEntry, [field.key]: e.target.value })}
                  required={field.key === 'student_number'}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={addLoading}
                style={{
                  background: c.red,
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: addLoading ? 'not-allowed' : 'pointer',
                  opacity: addLoading ? 0.6 : 1,
                  flex: 1,
                }}
              >
                {addLoading ? `${t('sending')}...` : t('addRequestType')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  background: c.card2,
                  border: `1px solid ${c.border}`,
                  borderRadius: '10px',
                  color: c.muted,
                  padding: '10px 16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Search + Table */}
      <div style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: '14px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${c.border}`,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <input
            className="wl-input"
            style={{ ...inputStyle, maxWidth: '280px' }}
            placeholder={`${t('search')}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchEntries(1)}
          />
          <button
            className="wl-btn"
            onClick={() => fetchEntries(1)}
            style={{
              background: c.red,
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('search')}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: c.muted }}>
              {pagination.total} {t('entries')}
            </span>
            {stats.available > 0 && (
              <button
                className="wl-btn"
                onClick={handleDeleteUnused}
                style={{
                  background: 'transparent',
                  border: `1px solid ${c.redBorder}`,
                  borderRadius: '8px',
                  color: c.red,
                  padding: '7px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('clearUnused')} ({stats.available})
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: c.card2 }}>
                {[
                  t('studentNumber'),
                  t('name'),
                  t('program'),
                  t('faculty'),
                  t('status'),
                  t('uploaded'), // "Added" date column — reuses existing key
                  '',
                ].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 16px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: c.muted,
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: c.muted }}>
                      <div style={{ width: '18px', height: '18px', border: `2px solid ${c.inputBorder}`, borderTopColor: c.red, borderRadius: '50%', animation: 'wl-spin 0.7s linear infinite' }} />
                      {t('loading')}
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ color: c.muted, fontSize: '14px' }}>
                      <i className="bi bi-card-list" style={{ fontSize: '32px', display: 'block', marginBottom: '8px', color: c.muted }} />
                      {t('noEntriesFound')}
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="wl-row"
                    style={{ borderBottom: `1px solid ${c.border}` }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: c.text }}>
                      {entry.student_number}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: c.text }}>
                      {entry.name || <span style={{ color: c.muted }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: c.muted }}>
                      {entry.program || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: c.muted }}>
                      {entry.faculty || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: entry.is_used ? c.yellowLight : c.greenLight,
                        color: entry.is_used ? c.yellow : c.green,
                        border: `1px solid ${entry.is_used ? c.yellowBorder : c.greenBorder}`,
                      }}>
                        {entry.is_used ? t('registered') : t('available')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: c.muted }}>
                      {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {!entry.is_used && (
                        <button
                          className="wl-del wl-btn"
                          onClick={() => handleDelete(entry.id, entry.student_number)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: c.muted,
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '16px',
                            borderRadius: '6px',
                          }}
                          title={t('delete')}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{
            padding: '14px 20px',
            borderTop: `1px solid ${c.border}`,
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
          }}>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => fetchEntries(p)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: `1px solid ${p === pagination.page ? c.red : c.border}`,
                  background: p === pagination.page ? c.red : 'transparent',
                  color: p === pagination.page ? 'white' : c.muted,
                  fontSize: '13px',
                  fontWeight: p === pagination.page ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Column Guide */}
      <div style={{
        marginTop: '16px',
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: '12px',
        padding: '16px 20px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: c.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('excelColumnGuide')}
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { col: 'student_number', req: true,  desc: t('columnRequired') },
            { col: 'name',           req: false, desc: t('columnOptionalName') },
            { col: 'program',        req: false, desc: t('columnOptionalProgram') },
            { col: 'faculty',        req: false, desc: t('columnOptionalFaculty') },
          ].map(item => (
            <div key={item.col} style={{ fontSize: '12px' }}>
              <code style={{
                background: c.card2,
                border: `1px solid ${c.border}`,
                borderRadius: '4px',
                padding: '2px 6px',
                color: item.req ? c.red : c.text,
                fontFamily: 'monospace',
              }}>
                {item.col}
              </code>
              <span style={{ color: c.muted, marginLeft: '6px' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal {...confirmationState} />
    </div>
  );
};

export default WhitelistManagementPage;