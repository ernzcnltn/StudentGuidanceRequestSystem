-- ===== MIGRATION SCRIPT: FIX ADMIN STATISTICS =====
-- Bu script mevcut veritabanınızı assignment-based tracking'e geçirir

-- ===== PHASE 1: BACKUP & PREPARATION =====
-- Önce mevcut tablolardan backup al
CREATE TABLE guidance_requests_backup AS SELECT * FROM guidance_requests;
CREATE TABLE admin_responses_backup AS SELECT * FROM admin_responses;

SELECT 'BACKUP CREATED - Starting migration...' as status;

-- ===== PHASE 2: ADD MISSING COLUMNS =====
-- guidance_requests tablosuna assignment tracking kolonları ekle
ALTER TABLE guidance_requests 
ADD COLUMN IF NOT EXISTS assigned_admin_id INT NULL AFTER updated_at,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP NULL AFTER assigned_admin_id,
ADD COLUMN IF NOT EXISTS assignment_method ENUM('auto', 'manual') DEFAULT 'manual' AFTER assigned_at,
ADD COLUMN IF NOT EXISTS handled_by INT NULL AFTER assignment_method;

-- Foreign key constraints ekle (eğer yoksa)
ALTER TABLE guidance_requests 
ADD CONSTRAINT IF NOT EXISTS fk_assigned_admin 
  FOREIGN KEY (assigned_admin_id) REFERENCES admin_users(admin_id) ON DELETE SET NULL;

ALTER TABLE guidance_requests 
ADD CONSTRAINT IF NOT EXISTS fk_handled_by 
  FOREIGN KEY (handled_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL;

-- Index'leri ekle
CREATE INDEX IF NOT EXISTS idx_requests_assigned_admin ON guidance_requests(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_at ON guidance_requests(assigned_at);
CREATE INDEX IF NOT EXISTS idx_requests_assignment_method ON guidance_requests(assignment_method);

SELECT 'COLUMNS ADDED - Assignment tracking enabled...' as status;

-- ===== PHASE 3: MIGRATE EXISTING DATA =====
-- Mevcut admin_responses verilerinden assignment'ları türet
UPDATE guidance_requests gr
SET 
  assigned_admin_id = (
    SELECT ar.admin_id 
    FROM admin_responses ar 
    WHERE ar.request_id = gr.request_id 
    ORDER BY ar.created_at ASC 
    LIMIT 1
  ),
  assigned_at = (
    SELECT ar.created_at 
    FROM admin_responses ar 
    WHERE ar.request_id = gr.request_id 
    ORDER BY ar.created_at ASC 
    LIMIT 1
  ),
  assignment_method = 'auto',
  handled_by = (
    SELECT ar.admin_id 
    FROM admin_responses ar 
    WHERE ar.request_id = gr.request_id 
    ORDER BY ar.created_at ASC 
    LIMIT 1
  )
WHERE gr.assigned_admin_id IS NULL 
AND EXISTS (
  SELECT 1 FROM admin_responses ar 
  WHERE ar.request_id = gr.request_id
);

-- Verify migration
SELECT 
  'DATA MIGRATION COMPLETED' as status,
  COUNT(*) as total_requests,
  COUNT(assigned_admin_id) as assigned_requests,
  COUNT(*) - COUNT(assigned_admin_id) as unassigned_requests,
  ROUND((COUNT(assigned_admin_id) * 100.0 / COUNT(*)), 2) as assignment_rate
FROM guidance_requests;

-- ===== PHASE 4: CREATE WORKLOAD TRACKING =====
-- Admin workload stats tablosu oluştur
CREATE TABLE IF NOT EXISTS admin_workload_stats (
  admin_id INT PRIMARY KEY,
  current_pending INT DEFAULT 0,
  current_informed INT DEFAULT 0,
  total_assigned INT DEFAULT 0,
  last_assignment TIMESTAMP NULL,
  workload_score DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE
);

-- Workload stats'ları populate et
INSERT INTO admin_workload_stats (admin_id, current_pending, current_informed, total_assigned, last_assignment)
SELECT 
  au.admin_id,
  COUNT(CASE WHEN gr.status = 'Pending' THEN 1 END) as current_pending,
  COUNT(CASE WHEN gr.status = 'Informed' THEN 1 END) as current_informed,
  COUNT(gr.request_id) as total_assigned,
  MAX(gr.assigned_at) as last_assignment
FROM admin_users au
LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id
WHERE au.is_active = TRUE
GROUP BY au.admin_id
ON DUPLICATE KEY UPDATE
  current_pending = VALUES(current_pending),
  current_informed = VALUES(current_informed),
  total_assigned = VALUES(total_assigned),
  last_assignment = VALUES(last_assignment);

SELECT 'WORKLOAD TRACKING CREATED' as status;

-- ===== PHASE 5: CREATE PERFORMANCE VIEWS =====
-- Admin performance view'i oluştur
CREATE OR REPLACE VIEW admin_performance_view AS
SELECT 
  au.admin_id,
  au.username,
  au.full_name,
  au.name,
  au.email,
  au.department,
  au.is_super_admin,
  au.is_active,
  au.created_at as admin_since,
  
  -- Assignment-based statistics
  COUNT(DISTINCT gr.request_id) as total_assigned_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
  
  -- Response statistics
  COUNT(DISTINCT ar.response_id) as total_responses,
  
  -- Performance metrics
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT gr.request_id) > 0 THEN
        (COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) * 100.0 / 
         COUNT(DISTINCT gr.request_id))
      ELSE 0
    END, 1
  ) as completion_rate,
  
  ROUND(
    AVG(CASE 
      WHEN ar.created_at IS NOT NULL AND gr.submitted_at IS NOT NULL THEN
        TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)
      ELSE NULL
    END), 2
  ) as avg_response_time_hours,
  
  -- Workload metrics
  aws.current_pending,
  aws.current_informed,
  aws.workload_score,
  
  -- Activity timestamps
  MIN(gr.assigned_at) as first_assignment,
  MAX(gr.assigned_at) as last_assignment,
  MIN(ar.created_at) as first_response,
  MAX(ar.created_at) as last_response
  
FROM admin_users au
LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id
LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id AND ar.admin_id = au.admin_id
LEFT JOIN admin_workload_stats aws ON au.admin_id = aws.admin_id
WHERE au.is_active = TRUE
GROUP BY au.admin_id, au.username, au.full_name, au.name, au.email, au.department, 
         au.is_super_admin, au.is_active, au.created_at, aws.current_pending, 
         aws.current_informed, aws.workload_score;

-- Department statistics view'i oluştur
CREATE OR REPLACE VIEW department_statistics_view AS
SELECT 
  rt.category as department,
  COUNT(DISTINCT au.admin_id) as admin_count,
  COUNT(DISTINCT gr.request_id) as total_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
  COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
  COUNT(DISTINCT ar.response_id) as total_responses,
  COUNT(DISTINCT gr.assigned_admin_id) as admins_with_assignments,
  COUNT(DISTINCT CASE WHEN gr.assigned_admin_id IS NULL THEN gr.request_id END) as unassigned_requests,
  
  ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as avg_response_time,
  
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT gr.request_id) > 0 THEN
        (COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) * 100.0 / 
         COUNT(DISTINCT gr.request_id))
      ELSE 0
    END, 1
  ) as completion_rate,
  
  ROUND(
    COUNT(DISTINCT gr.request_id) * 1.0 / NULLIF(COUNT(DISTINCT au.admin_id), 0), 1
  ) as avg_requests_per_admin
  
FROM request_types rt
LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id
LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
LEFT JOIN admin_users au ON rt.category = au.department AND au.is_active = TRUE
GROUP BY rt.category
ORDER BY completion_rate DESC, total_requests DESC;

SELECT 'PERFORMANCE VIEWS CREATED' as status;

-- ===== PHASE 6: CREATE AUTO-ASSIGNMENT TRIGGER =====
DELIMITER //

DROP TRIGGER IF EXISTS auto_assign_request_trigger//

CREATE TRIGGER auto_assign_request_trigger
AFTER INSERT ON guidance_requests
FOR EACH ROW
BEGIN
    DECLARE target_admin_id INT DEFAULT NULL;
    DECLARE department_category VARCHAR(100);
    
    -- Request'in departmanını al
    SELECT category INTO department_category 
    FROM request_types 
    WHERE type_id = NEW.type_id;
    
    -- En az yüklü admin'i bul
    SELECT au.admin_id INTO target_admin_id
    FROM admin_users au
    LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
        AND gr.status IN ('Pending', 'Informed')
    WHERE au.department = department_category 
        AND au.is_active = TRUE
    GROUP BY au.admin_id
    ORDER BY COUNT(gr.request_id) ASC, RAND()
    LIMIT 1;
    
    -- Eğer admin bulunduysa ata
    IF target_admin_id IS NOT NULL THEN
        UPDATE guidance_requests 
        SET 
            assigned_admin_id = target_admin_id,
            assigned_at = NOW(),
            assignment_method = 'auto'
        WHERE request_id = NEW.request_id;
    END IF;
END//

-- Workload update trigger
DROP TRIGGER IF EXISTS update_workload_stats_trigger//

CREATE TRIGGER update_workload_stats_trigger
AFTER UPDATE ON guidance_requests
FOR EACH ROW
BEGIN
    -- Eski admin'in workload'unu güncelle
    IF OLD.assigned_admin_id IS NOT NULL THEN
        UPDATE admin_workload_stats 
        SET 
            current_pending = (
                SELECT COUNT(*) FROM guidance_requests 
                WHERE assigned_admin_id = OLD.assigned_admin_id AND status = 'Pending'
            ),
            current_informed = (
                SELECT COUNT(*) FROM guidance_requests 
                WHERE assigned_admin_id = OLD.assigned_admin_id AND status = 'Informed'
            ),
            total_assigned = (
                SELECT COUNT(*) FROM guidance_requests 
                WHERE assigned_admin_id = OLD.assigned_admin_id
            )
        WHERE admin_id = OLD.assigned_admin_id;
    END IF;
    
    -- Yeni admin'in workload'unu güncelle
    IF NEW.assigned_admin_id IS NOT NULL THEN
        INSERT INTO admin_workload_stats (admin_id, current_pending, current_informed, total_assigned, last_assignment)
        VALUES (
            NEW.assigned_admin_id,
            (SELECT COUNT(*) FROM guidance_requests WHERE assigned_admin_id = NEW.assigned_admin_id AND status = 'Pending'),
            (SELECT COUNT(*) FROM guidance_requests WHERE assigned_admin_id = NEW.assigned_admin_id AND status = 'Informed'),
            (SELECT COUNT(*) FROM guidance_requests WHERE assigned_admin_id = NEW.assigned_admin_id),
            NEW.assigned_at
        )
        ON DUPLICATE KEY UPDATE
            current_pending = VALUES(current_pending),
            current_informed = VALUES(current_informed),
            total_assigned = VALUES(total_assigned),
            last_assignment = CASE 
                WHEN NEW.assigned_at IS NOT NULL THEN NEW.assigned_at 
                ELSE last_assignment 
            END;
    END IF;
END//

DELIMITER ;

SELECT 'AUTO-ASSIGNMENT TRIGGERS CREATED' as status;

-- ===== PHASE 7: VERIFICATION & TESTING =====
-- Assignment statistics verification
SELECT 
  'FINAL VERIFICATION' as test_name,
  COUNT(*) as total_requests,
  COUNT(assigned_admin_id) as assigned_requests,
  COUNT(*) - COUNT(assigned_admin_id) as unassigned_requests,
  ROUND((COUNT(assigned_admin_id) * 100.0 / COUNT(*)), 2) as assignment_rate_percent
FROM guidance_requests;

-- Admin workload verification
SELECT 
  'WORKLOAD VERIFICATION' as test_name,
  au.department,
  au.full_name,
  COUNT(gr.request_id) as assigned_requests,
  COUNT(CASE WHEN gr.status IN ('Pending', 'Informed') THEN 1 END) as active_requests,
  aws.workload_score
FROM admin_users au
LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id
LEFT JOIN admin_workload_stats aws ON au.admin_id = aws.admin_id
WHERE au.is_active = TRUE
GROUP BY au.admin_id, au.department, au.full_name, aws.workload_score
ORDER BY au.department, assigned_requests DESC
LIMIT 10;

-- Performance view verification
SELECT 
  'PERFORMANCE VIEW TEST' as test_name,
  department,
  full_name,
  total_assigned_requests,
  completion_rate,
  avg_response_time_hours
FROM admin_performance_view 
WHERE total_assigned_requests > 0
ORDER BY completion_rate DESC
LIMIT 5;

-- Department statistics verification
SELECT 
  'DEPARTMENT STATS TEST' as test_name,
  department,
  admin_count,
  total_requests,
  completion_rate,
  admins_with_assignments
FROM department_statistics_view
ORDER BY total_requests DESC;

-- ===== PHASE 8: CLEANUP & OPTIMIZATION =====
-- Gereksiz index'leri temizle
-- ALTER TABLE guidance_requests DROP INDEX IF EXISTS old_index_name;

-- Table statistics güncellemesi
ANALYZE TABLE guidance_requests;
ANALYZE TABLE admin_responses;
ANALYZE TABLE admin_workload_stats;

-- ===== MIGRATION COMPLETE =====
SELECT 
  '✅ MIGRATION COMPLETED SUCCESSFULLY!' as status,
  NOW() as completed_at,
  'Assignment-based tracking is now active' as message;

-- Migration sonrası yapılacaklar:
SELECT 'POST-MIGRATION CHECKLIST:' as todo_title,
'1. Update backend API endpoints to use assignment-based queries' as step_1,
'2. Update frontend to show assignment metrics' as step_2,
'3. Test auto-assignment functionality' as step_3,
'4. Verify statistics accuracy' as step_4,
'5. Monitor performance with new indexes' as step_5;

-- Test data for verification (optional)
-- INSERT INTO guidance_requests (student_id, type_id, content, priority, status, submitted_at)
-- VALUES (1, 1, 'Test assignment tracking', 'Medium', 'Pending', NOW());

-- SELECT 'Test request created - check if auto-assignment worked' as test_result;