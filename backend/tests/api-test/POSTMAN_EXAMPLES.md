# Postman Collection - Chi Tiết Test Scripts

Các comments trong collection JSON giải thích cơ chế hoạt động. File này cung cấp ví dụ chi tiết hơn.

## 📋 Các Test Pattern chính

### Pattern 1: Authorization Token Management
**File:** Auth / Login

```javascript
// Kiểm tra status
pm.test('status is 200 or 400', function () { 
  pm.expect([200, 400]).to.include(pm.response.code); 
});

// Nếu thành công, lưu token
if (pm.response.code === 200) {
  const body = pm.response.json();
  // Token này được dùng bởi các requests khác
  pm.environment.set('authToken', body.token || '');
}
```

**Cơ chế:**
- Login thành công → nhận token từ server
- Lưu token vào environment (`authToken`)
- Token được thay thế vào `{{authToken}}` ở các requests khác
- Header: `Authorization: Bearer {{authToken}}`

---

### Pattern 2: Create & Save ID
**File:** Income / Add

```javascript
// Kiểm tra created successfully
pm.test('status is 200', function () { 
  pm.response.to.have.status(200); 
});

// Lưu ID từ response
if (pm.response.code === 200) {
  pm.environment.set('incomeId', pm.response.json()._id || '');
  // Dùng cho: Income / Delete
}
```

**Cơ chế:**
- POST request tạo income mới
- Server trả về income object có `_id`
- Lưu `_id` vào environment (`incomeId`)
- Delete request sẽ dùng: `/api/v1/income/{{{incomeId}}}`

---

### Pattern 3: Validation Error Test
**File:** Income / Add 400 - missing fields

```javascript
// Kiểm tra validation error
pm.test('status is 400', function () { 
  pm.response.to.have.status(400); 
});

// Body request:
// {
//   "source": "",
//   "amount": 0
// }
// Missing: icon, date
```

**Cơ chế:**
- Request có body không hợp lệ (thiếu fields)
- Server validate → từ chối
- Response status: 400 Bad Request
- Test kiểm tra 400 là kết quả dự kiến

---

### Pattern 4: Array Response Validation
**File:** Income / Get

```javascript
// Kiểm tra status
pm.test('status is 200', function () { 
  pm.response.to.have.status(200); 
});

// Kiểm tra response là array
pm.test('response is array', function () { 
  pm.expect(pm.response.json()).to.be.an('array'); 
});
```

**Cơ chế:**
- GET request lấy danh sách income
- Server trả về array of income objects
- Test verify array tồn tại & không null

---

### Pattern 5: Authorization Error (401)
**File:** Income / Get 401 - no token

```javascript
// Kiểm tra unauthorized error
pm.test('status is 401', function () { 
  pm.response.to.have.status(401); 
});

// Request này KHÔNG có Authorization header
// Khác biệt với Income / Get:
// - Income / Get: Header: Authorization: Bearer {{authToken}} ✓
// - Income / Get 401: KHÔNG có header ✗
```

**Cơ chế:**
- Request không có Authorization header
- Server từ chối vì không có credentials
- Response status: 401 Unauthorized
- Test kiểm tra 401 là kết quả dự kiến

---

### Pattern 6: Resource Not Found (404)
**File:** Income / Delete 404 - invalid id

```javascript
// Kiểm tra not found error
pm.test('status is 404', function () { 
  pm.response.to.have.status(404); 
});

// DELETE /api/v1/income/INVALID_ID
// Server không tìm thấy income → 404
```

**Cơ chế:**
- DELETE request với ID không tồn tại
- Server không tìm thấy resource
- Response status: 404 Not Found
- Test kiểm tra 404 là kết quả dự kiến

---

## 🔄 End-to-End Flow Example

### Tình huống: Tạo & Xóa Income

```
1. Auth / Login
   POST /api/v1/auth/login
   Body: { email, password }
   ↓ (Status 200)
   → Environment: authToken = "eyJhbGc..."

2. Income / Add
   POST /api/v1/income/add
   Header: Authorization: Bearer {{authToken}}
   Body: { source, amount, date, icon }
   ↓ (Status 200)
   → Environment: incomeId = "6789abcd"

3. Income / Get
   GET /api/v1/income/get
   Header: Authorization: Bearer {{authToken}}
   ↓ (Status 200)
   → Response: [income_object_1, income_object_2, ...]

4. Income / Delete
   DELETE /api/v1/income/{{incomeId}}
   Header: Authorization: Bearer {{authToken}}
   ↓ (Status 200 or 404)
   → Income được xóa

5. Income / Get 401 - no token
   GET /api/v1/income/get
   (NO Authorization header)
   ↓ (Status 401)
   → Kiểm tra authorization requirements
```

---

## 📊 HTTP Status Codes trong Collection

| Code | Ý nghĩa | Ví dụ Test |
|------|---------|-----------|
| **200** | OK - Success | Auth/Login, Income/Get |
| **201** | Created | (rare - we use 200) |
| **400** | Bad Request - Validation error | Income/Add 400 |
| **401** | Unauthorized - Missing/invalid token | Income/Get 401 |
| **404** | Not Found - Resource not found | Income/Delete 404 |
| **500** | Server Error | Ticker/Get Bar |

---

## 🔐 Environment Variables

### Cách sử dụng:

**File: local.postman_environment.json**
```json
{
  "key": "authToken",
  "value": "",  // Được set bởi tests
  "enabled": true
}
```

**Trong requests:**
```javascript
// Before: {{authToken}}
// After: eyJhbGc...

// Before: {{baseUrl}}/api/v1/income/{{incomeId}}
// After: http://localhost:8000/api/v1/income/6789abcd
```

---

## 🚀 Chạy Tests

### Command Line:
```bash
cd backend
npx newman run tests/api-test/collections/finance-api.postman_collection.json \
  -e tests/api-test/environments/local.postman_environment.json \
  --reporters cli,json \
  --reporter-json-export tests/api-test/reports/newman/report.json
```

### Postman UI:
1. Import collection & environment
2. Click Runner button
3. Select collection & environment
4. Click "Start Test"

---

## 📝 Thêm Test Mới

Khi thêm request mới, cần có:

```json
{
  "name": "API / Action",
  "description": "Chi tiết cái request này làm gì",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "// === CHI TIẾT COMMENTS ===",
          "pm.test('kiểm tra gì đó', function () {",
          "  // logic ở đây",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "GET|POST|DELETE",
    "header": [
      { "key": "Authorization", "value": "Bearer {{authToken}}" }
    ],
    "body": { ... },
    "url": { ... }
  }
}
```

---

## ✅ Best Practices

1. **Luôn có description** - Giải thích mục đích
2. **Luôn có test script** - Validate response
3. **Lưu dữ liệu cần thiết** - Dùng cho requests tiếp theo
4. **Organize bằng folders** - Auth, Income, Expense, etc.
5. **Test error cases** - 400, 401, 404
6. **Thêm comments** - Giải thích logic phức tạp

