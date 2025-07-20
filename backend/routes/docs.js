const express = require('express');
const router = express.Router();

// GET /api/docs - API documentation
router.get('/', (req, res) => {
  const apiDocs = {
    title: "FIU Student Guidance Request System API",
    version: "1.0.0",
    description: "RESTful API for managing student guidance requests",
    base_url: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      "Authentication": {
        "POST /api/auth/login": {
          description: "Student login",
          body: {
            student_number: "string",
            password: "string"
          }
        }
      },
      "Request Types": {
        "GET /api/request-types": {
          description: "Get all request types grouped by category",
          response: "Object with categories as keys"
        },
        "GET /api/request-types/:id": {
          description: "Get specific request type",
          params: { id: "number" }
        }
      },
      "Students": {
        "GET /api/students": {
          description: "Get all students (admin only)"
        },
        "GET /api/students/:id": {
          description: "Get specific student",
          params: { id: "number" }
        }
      },
      "Requests": {
        "GET /api/requests": {
          description: "Get all requests"
        },
        "GET /api/requests/student/:studentId": {
          description: "Get requests for specific student",
          params: { studentId: "number" }
        },
        "POST /api/requests": {
          description: "Create new request",
          body: {
            student_id: "number",
            type_id: "number",
            content: "string (max 300 chars)"
          },
          notes: "One request per 24 hours per student"
        },
        "PUT /api/requests/:id/status": {
          description: "Update request status (admin only)",
          params: { id: "number" },
          body: {
            status: "Pending|Informed|Completed",
            response_content: "string (optional)"
          }
        },
        "POST /api/requests/:id/upload": {
          description: "Upload files to request",
          params: { id: "number" },
          body: "multipart/form-data with 'files' field",
          notes: "Max 3 files, 2MB each, types: jpeg,jpg,png,pdf,doc,docx,odt,csv"
        },
        "GET /api/requests/:id/attachments": {
          description: "Get request attachments",
          params: { id: "number" }
        },
        "GET /api/requests/attachments/:filename": {
          description: "Download attachment file",
          params: { filename: "string" }
        }
      },
      "Admin": {
        "GET /api/admin/dashboard": {
          description: "Get dashboard statistics"
        },
        "GET /api/admin/requests": {
          description: "Get all requests with filtering",
          query_params: {
            status: "Pending|Informed|Completed",
            category: "string",
            student_id: "number",
            page: "number (default: 1)",
            limit: "number (default: 20)"
          }
        },
        "GET /api/admin/requests/:id": {
          description: "Get detailed request information",
          params: { id: "number" }
        }
      }
    },
    models: {
      Student: {
        student_id: "number",
        student_number: "string",
        name: "string",
        email: "string",
        program: "string",
        created_at: "datetime"
      },
      RequestType: {
        type_id: "number",
        category: "string",
        type_name: "string",
        description_en: "string",
        is_document_required: "boolean",
        is_disabled: "boolean"
      },
      GuidanceRequest: {
        request_id: "number",
        student_id: "number",
        type_id: "number",
        content: "string",
        status: "Pending|Informed|Completed",
        submitted_at: "datetime",
        updated_at: "datetime",
        resolved_at: "datetime"
      },
      Attachment: {
        attachment_id: "number",
        request_id: "number",
        file_name: "string",
        file_path: "string",
        file_type: "string",
        file_size: "number",
        uploaded_at: "datetime"
      }
    },
    response_format: {
      success_response: {
        success: true,
        data: "object|array",
        message: "string (optional)"
      },
      error_response: {
        success: false,
        error: "string"
      }
    }
  };
  
  res.json(apiDocs);
});

module.exports = router;