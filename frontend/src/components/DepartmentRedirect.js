import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const DepartmentRedirect = () => {
  const { admin } = useAdminAuth();
  
  if (!admin) {
    return <Navigate to="/login" replace />;
  }
  
  // Department belirleme
  let targetDepartment;
  
  if (admin.is_super_admin && !admin.department) {
    // Pure Super Admin -> 'all' department
    targetDepartment = 'all';
  } else {
    // Normal admin -> kendi departmanı (lowercase)
    targetDepartment = admin.department?.toLowerCase() || 'academic';
  }
  
  console.log('🔀 Redirecting admin to department:', {
    adminId: admin.admin_id,
    username: admin.username,
    department: admin.department,
    isSuperAdmin: admin.is_super_admin,
    targetDepartment
  });
  
  return <Navigate to={`/admin/dashboard/${targetDepartment}`} replace />;
};

export default DepartmentRedirect;