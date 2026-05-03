import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

 useEffect(() => {
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  if (error) {
    navigate(`/login?error=${error}`);
    return;
  }

if (token) {
  console.log('🔑 Token found:', token.substring(0, 20) + '...');
  loginWithToken(token).then(result => {
    console.log('✅ loginWithToken result:', result);
    if (result?.success) {
      console.log('➡️ Navigating to /');
      window.location.href = '/';
    } else {
      console.log('❌ Login failed, going to login page');
      window.location.href = '/login?error=oauth_failed';
    }
  });
} else {
    navigate('/login');
  }
}, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0A0A0E',
      color: 'white',
      flexDirection: 'column',
      gap: '16px',
      fontFamily: 'DM Sans, sans-serif'
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: '#C8102E',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ opacity: 0.4, fontSize: '13px' }}>Signing you in...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AuthCallback;