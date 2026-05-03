import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const ChangePasswordModal = ({ onClose, onSuccess, required = false }) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  const c = {
    overlay:  'rgba(0,0,0,0.7)',
    card:     isDark ? '#16161C' : '#FFFFFF',
    card2:    isDark ? '#1E1E26' : '#F1F3F5',
    border:   isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    text:     isDark ? '#F2F2F7' : '#1A1A2E',
    muted:    isDark ? 'rgba(242,242,247,0.45)' : 'rgba(26,26,46,0.55)',
    input:    isDark ? '#1E1E26' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    red:      '#C8102E',
    redLight: 'rgba(200,16,46,0.1)',
    redBorder:'rgba(200,16,46,0.3)',
    green:    '#22C55E',
  };

  const inputStyle = {
    width: '100%',
    background: c.input,
    border: `1px solid ${c.inputBorder}`,
    borderRadius: '10px',
    color: c.text,
    padding: '11px 40px 11px 14px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const validate = () => {
    if (!form.currentPassword) return t('currentPasswordRequired', 'Current password is required');
    if (form.newPassword.length < 8) return t('passwordMinLength', 'New password must be at least 8 characters');
    if (form.newPassword !== form.confirmPassword) return t('passwordsDoNotMatch', 'Passwords do not match');
    if (form.currentPassword === form.newPassword) return t('passwordSameAsCurrent', 'New password must be different from current password');
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      const res = await apiService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      if (res.data.success) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err.response?.data?.error || t('failedToUpdateRequestStatus', 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  const EyeToggle = ({ show, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: '12px', top: '50%',
        transform: 'translateY(-50%)',
        background: 'none', border: 'none',
        color: c.muted, cursor: 'pointer', padding: '2px',
      }}
    >
      <i className={`bi bi-eye${show ? '-slash' : ''}`} style={{ fontSize: '15px' }} />
    </button>
  );

  const PasswordStrength = ({ password }) => {
    if (!password) return null;
    const strength = password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)
      ? 3 : password.length >= 8 ? 2 : 1;
    const labels = ['', t('weak','Weak'), t('medium','Medium'), t('strong','Strong')];
    const colors = ['', '#EF4444', '#F59E0B', '#22C55E'];
    return (
      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              height: '3px', flex: 1, borderRadius: '4px',
              background: i <= strength ? colors[strength] : c.inputBorder,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <span style={{ fontSize: '11px', color: colors[strength], fontWeight: 600 }}>
          {labels[strength]}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: c.overlay,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: '18px',
        padding: '32px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        animation: 'fadeUp 0.3s ease',
      }}>
        <style>{`
          @keyframes fadeUp {
            from { opacity:0; transform:translateY(16px); }
            to   { opacity:1; transform:translateY(0); }
          }
          .cp-input:focus {
            border-color: rgba(200,16,46,0.5) !important;
            box-shadow: 0 0 0 3px rgba(200,16,46,0.08) !important;
          }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{
              width: '40px', height: '40px',
              background: c.redLight,
              border: `1px solid ${c.redBorder}`,
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px',
            }}>
              <i className="bi bi-key" style={{ fontSize: '18px', color: c.red }} />
            </div>
            <h3 style={{ color: c.text, fontWeight: 700, fontSize: '17px', margin: '0 0 4px' }}>
              {t('changePassword', 'Change Password')}
            </h3>
            <p style={{ color: c.muted, fontSize: '13px', margin: 0 }}>
              {required
                ? t('mustChangePasswordNote', 'Please set a new password to secure your account.')
                : t('changePasswordNote', 'Update your account password.')}
            </p>
          </div>
          {!required && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none',
              color: c.muted, cursor: 'pointer', padding: '4px',
              fontSize: '20px', lineHeight: 1,
            }}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        {/* Required notice */}
        {required && (
          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '10px',
            padding: '11px 14px',
            marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#F59E0B', fontSize: '13px',
          }}>
            <i className="bi bi-exclamation-triangle" />
            {t('tempPasswordWarning', 'You are using a temporary password. Please change it now.')}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: c.redLight,
            border: `1px solid ${c.redBorder}`,
            borderRadius: '10px',
            padding: '11px 14px',
            marginBottom: '16px',
            color: '#FF8A96', fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <i className="bi bi-exclamation-circle" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Current Password */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: c.muted, marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('currentPassword', 'Current Password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="cp-input"
                style={inputStyle}
                type={showCurrent ? 'text' : 'password'}
                name="currentPassword"
                value={form.currentPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
              <EyeToggle show={showCurrent} onToggle={() => setShowCurrent(p => !p)} />
            </div>
          </div>

          {/* New Password */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: c.muted, marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('newPassword', 'New Password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="cp-input"
                style={inputStyle}
                type={showNew ? 'text' : 'password'}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                placeholder="••••••••"
                minLength={8}
                required
              />
              <EyeToggle show={showNew} onToggle={() => setShowNew(p => !p)} />
            </div>
            <PasswordStrength password={form.newPassword} />
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: c.muted, marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('confirmPassword', 'Confirm Password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="cp-input"
                style={inputStyle}
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
              <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(p => !p)} />
            </div>
            {form.confirmPassword && form.newPassword && (
              <div style={{ marginTop: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px',
                color: form.newPassword === form.confirmPassword ? c.green : '#EF4444' }}>
                <i className={`bi bi-${form.newPassword === form.confirmPassword ? 'check-circle' : 'x-circle'}`} />
                {form.newPassword === form.confirmPassword
                  ? t('passwordsMatch', 'Passwords match')
                  : t('passwordsDoNotMatch', 'Passwords do not match')}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {!required && (
              <button type="button" onClick={onClose} style={{
                flex: 1,
                background: c.card2,
                border: `1px solid ${c.border}`,
                borderRadius: '10px',
                color: c.muted,
                padding: '11px',
                fontSize: '14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                {t('cancel', 'Cancel')}
              </button>
            )}
            <button type="submit" disabled={loading} style={{
              flex: 2,
              background: loading ? 'rgba(200,16,46,0.5)' : c.red,
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              padding: '11px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}>
              {loading
                ? <><i className="bi bi-arrow-clockwise" style={{ animation: 'spin 0.7s linear infinite' }} />{t('sending', 'Saving')}...</>
                : <><i className="bi bi-check2" />{t('savePassword', 'Save Password')}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;