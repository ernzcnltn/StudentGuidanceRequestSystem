# Department Request Limits System (24-Hour Cooldown)

## Overview

The Department Request Limits system implements a 24-hour cooldown per department, allowing students to make requests to different departments independently while preventing spam to any single department.

## How It Works

### Key Features
- **Per-Department Cooldown**: Each department (Accounting, Academic, Student Affairs, etc.) has its own 24-hour limit
- **Independent Limits**: A student can make a request to Accounting and still make a request to Academic department
- **Automatic Enforcement**: The system automatically checks and enforces limits before request creation
- **Real-time Tracking**: Tracks the exact time of last request to each department

### Example Scenario
```
Student makes request to Accounting at 10:00 AM
- ✅ Can make request to Academic at 10:30 AM (different department)
- ✅ Can make request to Student Affairs at 11:00 AM (different department)
- ❌ Cannot make another request to Accounting until 10:00 AM next day
```

## Database Schema

### Table: `department_request_limits`
```sql
CREATE TABLE department_request_limits (
    limit_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    department VARCHAR(100) NOT NULL,
    last_request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_department (student_id, department)
);
```

## API Endpoints

### 1. Check Department Availability
```
GET /api/department-limits/availability/:department
```
**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "department": "Accounting",
    "canMakeRequest": false,
    "hoursRemaining": 18,
    "lastRequestTime": "2024-01-15T10:00:00Z",
    "nextAvailableTime": "2024-01-16T10:00:00Z"
  }
}
```

### 2. Check All Departments Availability
```
GET /api/department-limits/availability
```
**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "department": "Accounting",
      "canMakeRequest": false,
      "hoursRemaining": 18,
      "lastRequestTime": "2024-01-15T10:00:00Z",
      "nextAvailableTime": "2024-01-16T10:00:00Z"
    },
    {
      "department": "Academic",
      "canMakeRequest": true,
      "hoursRemaining": 0,
      "lastRequestTime": null,
      "nextAvailableTime": null
    }
  ]
}
```

### 3. Reset Department Cooldown (Testing Only)
```
POST /api/department-limits/reset/:department
```
**Headers**: `Authorization: Bearer <token>`

## Implementation Details

### Middleware Integration
The system uses middleware that runs before request creation:

```javascript
router.post('/', 
  authenticateStudent,
  checkDepartmentCooldown, // ← Department limit check
  validateWorkingHoursAndCalendarWithAdminBypass,
  validateCreateRequest,
  async (req, res) => {
    // Request creation logic
  }
);
```

### Error Response
When a student tries to make a request during cooldown:

```json
{
  "success": false,
  "error": "Department cooldown active. You must wait 18 more hours before making another request to Accounting department.",
  "cooldown": {
    "department": "Accounting",
    "hoursRemaining": 18,
    "lastRequestTime": "2024-01-15T10:00:00Z",
    "nextAvailableTime": "2024-01-16T10:00:00Z"
  }
}
```

## Supported Departments

The system supports the following departments:
- `Accounting`
- `Academic`
- `Student Affairs`
- `Dormitory`
- `Campus Services`

## Files Modified/Added

### New Files
- `/backend/routes/departmentLimits.js` - API endpoints for checking limits
- `/backend/middleware/departmentCooldown.js` - Middleware for enforcing limits
- `/backend/department_request_limits_migration.sql` - Database migration
- `/backend/test_department_limits.js` - Test script

### Modified Files
- `/backend/server.js` - Added new route registration
- `/backend/routes/requests.js` - Integrated cooldown middleware and recording

## Testing

### Manual Testing
1. Run the migration to create the database table
2. Use the test script: `node test_department_limits.js`
3. Test via API endpoints using Postman or similar tools

### API Testing Examples

**Check if you can make a request to Accounting:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/department-limits/availability/Accounting
```

**Make a request (will be blocked if within 24h):**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"type_id": 1, "content": "Test request"}' \
     http://localhost:5000/api/requests
```

## Configuration

### Environment Variables
No additional environment variables are required. The system uses the existing database connection.

### Database Migration
To apply the database changes:
```sql
-- Run this SQL script in your database
SOURCE department_request_limits_migration.sql;
```

## Troubleshooting

### Common Issues

**1. "Table doesn't exist" error**
- Solution: Run the migration script

**2. Cooldown not working**
- Check if middleware is properly integrated
- Verify database records are being created

**3. Wrong department names**
- Ensure department names match exactly: 'Accounting', 'Academic', etc.
- Check request_types table for correct category values

### Debugging
Enable detailed logging by checking console output for:
- `✅ Recorded department request: Student X -> Department`
- Cooldown check results in middleware

## Security Considerations

- Only authenticated students can access the endpoints
- Student can only check/reset their own cooldowns
- Department names are validated against a whitelist
- SQL injection protection through parameterized queries

## Future Enhancements

Possible improvements:
1. Admin override for emergency requests
2. Different cooldown periods per department
3. Cooldown exemptions for certain request types
4. Email notifications when cooldown expires