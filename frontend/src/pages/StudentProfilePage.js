// frontend/src/pages/StudentProfilePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';

const StudentProfilePage = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    program: user?.program || '',
    phone: '',
    address: '',
    emergency_contact: '',
    bio: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [requestStats, setRequestStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchStudentStats();
    fetchStudentProfile();
  }, []);

  const fetchStudentProfile = async () => {
    try {
      const response = await apiService.getStudentProfile();
      if (response.data.success) {
        setProfileData({...profileData, ...response.data.data});
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchStudentStats = async () => {
    try {
      const response = await apiService.getStudentStats(user?.student_id);
      if (response.data.success) {
        setRequestStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await apiService.updateStudentProfile(profileData);
      if (response.data.success) {
        showSuccess('Profile updated successfully!');
      }
    } catch (error) {
      showError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      showError('Password must be at least 6 characters long');
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      const response = await apiService.changeStudentPassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (response.data.success) {
        showSuccess('Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getJoinDate = () => {
    if (user?.created_at) {
      return new Date(user.created_at).toLocaleDateString();
    }
    return 'N/A';
  };

  const renderProfileTab = () => (
    <div className="row">
      <div className="col-md-8">
        <div className="card">
          <div className="card-header">
            <h5>👤 Personal Information</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleProfileUpdate}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="col-md-6 mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Program</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profileData.program}
                    onChange={(e) => setProfileData({...profileData, program: e.target.value})}
                  />
                </div>
                
                <div className="col-md-6 mb-3">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    placeholder="+90 555 123 45 67"
                  />
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Address</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={profileData.address}
                  onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                  placeholder="Your current address..."
                />
              </div>
              
              <div className="mb-3">
                <label className="form-label">Emergency Contact</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileData.emergency_contact}
                  onChange={(e) => setProfileData({...profileData, emergency_contact: e.target.value})}
                  placeholder="Emergency contact name and phone"
                />
              </div>
              
              <div className="mb-3">
                <label className="form-label">Bio</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  placeholder="Tell us about yourself..."
                  maxLength="500"
                />
                <div className="form-text">{profileData.bio.length}/500 characters</div>
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Updating...
                  </>
                ) : (
                  '💾 Update Profile'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <div className="col-md-4">
        <div className="card">
          <div className="card-header">
            <h5>📊 Account Overview</h5>
          </div>
          <div className="card-body">
            <div className="text-center mb-3">
              <div 
                className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{ width: '80px', height: '80px', fontSize: '2rem' }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || '👤'}
              </div>
              <h5>{user?.name}</h5>
              <p className="text-muted">{user?.student_number}</p>
            </div>
            
            <hr />
            
            <div className="mb-2">
              <strong>Program:</strong><br/>
              <span className="text-muted">{user?.program || 'Not specified'}</span>
            </div>
            
            <div className="mb-2">
              <strong>Join Date:</strong><br/>
              <span className="text-muted">{getJoinDate()}</span>
            </div>
            
            <div className="mb-2">
              <strong>Account Status:</strong><br/>
              <span className="badge bg-success">Active</span>
            </div>
            
            {requestStats && (
              <>
                <hr />
                <div className="mb-2">
                  <strong>Total Requests:</strong><br/>
                  <span className="text-primary fw-bold">{requestStats.total_requests}</span>
                </div>
                
                <div className="mb-2">
                  <strong>Completed:</strong><br/>
                  <span className="text-success fw-bold">{requestStats.completed_requests}</span>
                </div>
                
                <div className="mb-2">
                  <strong>Average Response Time:</strong><br/>
                  <span className="text-info fw-bold">{requestStats.avg_response_time || 'N/A'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="row">
      <div className="col-md-8">
        <div className="card">
          <div className="card-header">
            <h5>🔒 Change Password</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handlePasswordChange}>
              <div className="mb-3">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  required
                />
              </div>
              
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  minLength="6"
                  required
                />
                <div className="form-text">Password must be at least 6 characters long</div>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="btn btn-warning"
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Changing...
                  </>
                ) : (
                  '🔑 Change Password'
                )}
              </button>
            </form>
          </div>
        </div>
        
        <div className="card mt-4">
          <div className="card-header">
            <h5>⚠️ Account Actions</h5>
          </div>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6>Logout from all devices</h6>
                <p className="text-muted mb-0">This will log you out from all devices and invalidate all active sessions.</p>
              </div>
              <button className="btn btn-outline-warning" onClick={logout}>
                 Logout All
              </button>
            </div>
            
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h6>Download My Data</h6>
                <p className="text-muted mb-0">Download a copy of all your data including requests and responses.</p>
              </div>
              <button className="btn btn-outline-info" onClick={() => showSuccess('Feature coming soon!')}>
                📥 Download
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-4">
        <div className="card">
          <div className="card-header">
            <h5>🛡️ Security Tips</h5>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <h6>Strong Password Guidelines:</h6>
              <ul className="small">
                <li>Use at least 8 characters</li>
                <li>Include uppercase and lowercase letters</li>
                <li>Add numbers and special characters</li>
                <li>Avoid personal information</li>
                <li>Don't reuse passwords</li>
              </ul>
            </div>
            
            <div className="alert alert-info">
              <small>
                <strong>💡 Tip:</strong> Change your password regularly and never share it with others.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="row">
      <div className="col-md-8">
        <div className="card">
          <div className="card-header">
            <h5>⚙️ Application Preferences</h5>
          </div>
          <div className="card-body">
            <div className="mb-4">
              <h6>🔔 Notification Preferences</h6>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="emailNotifications" defaultChecked />
                <label className="form-check-label" htmlFor="emailNotifications">
                  Email notifications for request updates
                </label>
              </div>
              
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="browserNotifications" defaultChecked />
                <label className="form-check-label" htmlFor="browserNotifications">
                  Browser notifications
                </label>
              </div>
              
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="weeklyDigest" />
                <label className="form-check-label" htmlFor="weeklyDigest">
                  Weekly request summary
                </label>
              </div>
            </div>
            
            <div className="mb-4">
              <h6>🎨 Display Preferences</h6>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="darkMode" />
                <label className="form-check-label" htmlFor="darkMode">
                  Dark mode
                </label>
              </div>
              
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="compactView" />
                <label className="form-check-label" htmlFor="compactView">
                  Compact view for requests
                </label>
              </div>
            </div>
            
            <div className="mb-4">
              <h6>📱 Contact Preferences</h6>
              <div className="mb-3">
                <label className="form-label">Preferred contact method</label>
                <select className="form-select">
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="both">Both Email and SMS</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Emergency contact priority</label>
                <select className="form-select">
                  <option value="normal">Normal priority</option>
                  <option value="urgent">Urgent requests only</option>
                  <option value="always">All requests</option>
                </select>
              </div>
            </div>
            
            <button className="btn btn-primary">
              💾 Save Preferences
            </button>
          </div>
        </div>
      </div>
      
      <div className="col-md-4">
        <div className="card">
          <div className="card-header">
            <h5>📊 My Statistics</h5>
          </div>
          <div className="card-body">
            {requestStats ? (
              <div>
                <div className="text-center mb-3">
                  <div className="h2 text-primary">{requestStats.total_requests}</div>
                  <p className="text-muted">Total Requests Submitted</p>
                </div>
                
                <div className="row text-center">
                  <div className="col-4">
                    <div className="h4 text-warning">{requestStats.pending_requests || 0}</div>
                    <small className="text-muted">Pending</small>
                  </div>
                  <div className="col-4">
                    <div className="h4 text-info">{requestStats.informed_requests || 0}</div>
                    <small className="text-muted">Informed</small>
                  </div>
                  <div className="col-4">
                    <div className="h4 text-success">{requestStats.completed_requests || 0}</div>
                    <small className="text-muted">Completed</small>
                  </div>
                </div>
                
                <hr />
                
                <div className="mb-2">
                  <strong>Most Used Category:</strong><br/>
                  <span className="text-muted">{requestStats.favorite_category || 'N/A'}</span>
                </div>
                
                <div className="mb-2">
                  <strong>Success Rate:</strong><br/>
                  <span className="text-success fw-bold">
                    {requestStats.total_requests > 0 
                      ? Math.round((requestStats.completed_requests / requestStats.total_requests) * 100)
                      : 0
                    }%
                  </span>
                </div>
                
                <div className="mb-2">
                  <strong>Member Since:</strong><br/>
                  <span className="text-muted">{getJoinDate()}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted">
                <div className="spinner-border spinner-border-sm mb-2"></div>
                <p>Loading statistics...</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="card mt-3">
          <div className="card-header">
            <h5>🏆 Achievements</h5>
          </div>
          <div className="card-body">
            <div className="mb-2">
              <span className="badge bg-primary me-2">🎯</span>
              <strong>First Request</strong>
              <br/>
              <small className="text-muted">Submitted your first request</small>
            </div>
            
            {requestStats?.total_requests >= 5 && (
              <div className="mb-2">
                <span className="badge bg-success me-2">📈</span>
                <strong>Active User</strong>
                <br/>
                <small className="text-muted">Submitted 5+ requests</small>
              </div>
            )}
            
            {requestStats?.completed_requests >= 3 && (
              <div className="mb-2">
                <span className="badge bg-warning me-2">⭐</span>
                <strong>Problem Solver</strong>
                <br/>
                <small className="text-muted">Resolved 3+ requests</small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <h2>👤 My Profile & Settings</h2>
          <p className="text-muted">Manage your account information and preferences</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            🔒 Security
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            ⚙️ Preferences
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'security' && renderSecurityTab()}
      {activeTab === 'preferences' && renderPreferencesTab()}
    </div>
  );
};

export default StudentProfilePage;