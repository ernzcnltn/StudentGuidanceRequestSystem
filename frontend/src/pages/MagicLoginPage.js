import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import FIULogo from '../components/FIULogo';
import { useTranslation } from '../hooks/useTranslation'; // ✅ EKLE

const MagicLoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation(); // ✅ EKLE
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState(t('verifyingLoginLink')); // ✅ DEĞİŞTİR
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (hasVerified) {
        console.log('⚠️ Token already verified, skipping...');
        return;
      }

      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage(t('noTokenProvided')); // ✅ DEĞİŞTİR
        return;
      }

      setHasVerified(true);

      console.log('🔐 Verifying magic link token:', token);

      try {
        const response = await apiService.verifyMagicLink(token);

        console.log('✅ Verification response:', response.data);

        if (response.data.success) {
          setStatus('success');
          setMessage(t('loginSuccessful')); // ✅ DEĞİŞTİR

          const { user_type, data } = response.data;

          console.log('👤 User type:', user_type);
          console.log('🔑 Token received:', data.token);

          if (user_type === 'admin') {
            console.log('🔐 Saving admin token...');
            sessionStorage.setItem('admin_token', data.token);
            sessionStorage.setItem('admin_data', JSON.stringify(data.admin));
            apiService.setAdminAuthToken(data.token);
            
            console.log('✅ Admin token saved');
            console.log('🔄 Redirecting to dashboard...');
            
            setTimeout(() => {
              window.location.href = '/admin/dashboard';
            }, 1500);
            
          } else if (user_type === 'student') {
            console.log('🔐 Saving student token...');
            sessionStorage.setItem('student_token', data.token);
            sessionStorage.setItem('student_data', JSON.stringify(data.user));
            apiService.setAuthToken(data.token);
            
            console.log('✅ Student token saved');
            console.log('🔄 Redirecting to home...');
            
            setTimeout(() => {
              window.location.href = '/';
            }, 1500);
          } else {
            console.error('❌ Unknown user type:', user_type);
            setStatus('error');
            setMessage(t('verificationFailed')); // ✅ DEĞİŞTİR
          }
        } else {
          console.error('❌ Verification failed:', response.data);
          setStatus('error');
          setMessage(response.data.error || t('verificationFailed')); // ✅ DEĞİŞTİR
        }
      } catch (error) {
        console.error('❌ Magic link verification error:', error);
        
        // ✅ Error mesajlarını çevir
        let errorMessage = t('linkExpiredOrUsed');
        
        if (error.response?.data?.error) {
          const apiError = error.response.data.error;
          
          if (apiError.includes('already been used')) {
            errorMessage = t('linkAlreadyUsed');
          } else if (apiError.includes('expired')) {
            errorMessage = t('linkExpired');
          } else if (apiError.includes('Invalid')) {
            errorMessage = t('invalidLoginLink');
          } else {
            errorMessage = apiError;
          }
        }
        
        setStatus('error');
        setMessage(errorMessage);
      }
    };

    verifyToken();
  }, [searchParams, hasVerified, t]); // ✅ t dependency ekle

  return (
    <div className="magic-login-container">
      <style jsx>{`
        .magic-login-container {
          min-height: 100vh;
          background: linear-gradient(135deg, 
            rgba(30, 64, 175, 0.9) 0%, 
            rgba(147, 51, 234, 0.9) 50%, 
            rgba(220, 38, 38, 0.8) 100%
          );
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: 'Inter', sans-serif;
        }

        .magic-card {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          padding: 50px 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
        }

        .logo-section {
          margin-bottom: 30px;
        }

        .logo-section h2 {
          margin-top: 20px;
          color: #333;
          font-size: 24px;
          font-weight: 600;
        }

        .spinner {
          width: 60px;
          height: 60px;
          border: 5px solid #f3f3f3;
          border-top: 5px solid #dc2626;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 30px auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .success-icon {
          font-size: 70px;
          color: #22c55e;
          margin: 30px 0;
          animation: scaleIn 0.5s ease-out;
        }

        @keyframes scaleIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .error-icon {
          font-size: 70px;
          color: #ef4444;
          margin: 30px 0;
          animation: shake 0.5s ease-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .message {
          font-size: 18px;
          color: #333;
          margin: 20px 0;
          line-height: 1.6;
        }

        .sub-message {
          font-size: 14px;
          color: #666;
          margin-top: 10px;
        }

        .back-button {
          margin-top: 30px;
          padding: 14px 35px;
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
        }

        .back-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4);
        }

        .back-button:active {
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .magic-card {
            padding: 40px 30px;
          }

          .success-icon, .error-icon {
            font-size: 60px;
          }

          .message {
            font-size: 16px;
          }
        }
      `}</style>

      <div className="magic-card">
        <div className="logo-section">
          <FIULogo size="xl" />
          <h2>{t('guidanceSystem')}</h2> {/* ✅ DEĞİŞTİR */}
        </div>

        {status === 'verifying' && (
          <>
            <div className="spinner"></div>
            <p className="message">{message}</p>
            <p className="sub-message">{t('pleaseWait')}</p> {/* ✅ DEĞİŞTİR */}
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <p className="message">{message}</p>
            <p className="sub-message">{t('autoRedirect')}</p> {/* ✅ DEĞİŞTİR */}
          </>
        )}

        {status === 'error' && (
          <>
            <div className="error-icon">✗</div>
            <p className="message">{message}</p>
            <button 
              className="back-button"
              onClick={() => navigate('/login', { replace: true })}
            >
              {t('backToLogin')} {/* ✅ DEĞİŞTİR */}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MagicLoginPage;