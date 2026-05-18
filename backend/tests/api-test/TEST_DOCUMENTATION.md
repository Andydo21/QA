# API Test Documentation - Chi Tiết Cơ Chế Hoạt Động

## 📋 Mục lục
1. [Cấu trúc Test](#cấu-trúc-test)
2. [Lifecycle của một Test](#lifecycle-của-một-test)
3. [Các loại Test](#các-loại-test)
4. [Environment Management](#environment-management)
5. [Test Assertions](#test-assertions)
6. [Flow của Authorization](#flow-của-authorization)

---

## 🏗️ Cấu trúc Test

Mỗi request trong collection có cấu trúc:

```json
{
  "name": "Request Name",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          // Validation logic
        ]
      }
    }
  ],
  "request": {
    "method": "GET|POST|PUT|DELETE",
    "header": [],
    "body": { "mode": "raw", "raw": "{...}" },
    "url": { "raw": "{{baseUrl}}/api/v1/...", ... }
  }
}
```

### Các thành phần:
- **name**: Tên request (hiển thị trong UI)
- **event**: Chứa test scripts chạy sau khi nhận response
- **request**: Định nghĩa HTTP request (method, headers, body, URL)

---

## 🔄 Lifecycle của một Test

### Quy trình thực thi:

```
1. Chuẩn bị Request
   └─ Thay thế {{variables}} từ environment
   └─ Thêm headers, body

2. Gửi HTTP Request
   └─ POST /api/v1/auth/login
   └─ Server xử lý
   └─ Trả về response

3. Chạy Test Scripts (event.listen = "test")
   └─ Kiểm tra status code
   └─ Validate response body
   └─ Lưu dữ liệu vào environment (nếu cần)
   └─ Báo cáo pass/fail

4. Lưu kết quả
   └─ Cập nhật test results
   └─ Tiếp tục request tiếp theo
```

---

## 🧪 Các loại Test

### 1. **Happy Path Tests** (✅ Kỳ vọng thành công)

Ví dụ: **Auth / Login**
```javascript
pm.test('status is 200 or 400', function () { 
  pm.expect([200, 400]).to.include(pm.response.code); 
});

if (pm.response.code === 200) {
  const body = pm.response.json();
  pm.environment.set('authToken', body.token || '');  // Lưu token
}
```

**Cơ chế:**
- Gửi email + password hợp lệ
- Kỳ vọng nhận status 200
- Lưu token từ response → dùng cho requests tiếp theo

---

### 2. **Validation Error Tests** (❌ Kiểm tra validation)

Ví dụ: **Income / Add 400 - missing fields**
```javascript
pm.test('status is 400', function () { 
  pm.response.to.have.status(400); 
});
```

**Cơ chế:**
- Gửi request với thiếu required fields
- Kỳ vọng nhận status 400 (Bad Request)
- Server từ chối vì validation fail

---

### 3. **Authorization Error Tests** (❌ Kiểm tra xác thực)

Ví dụ: **Dashboard / Get Summary 401 - no token**
```javascript
pm.test('status is 401', function () { 
  pm.response.to.have.status(401); 
});
```

**Cơ chế:**
- Request KHÔNG có Authorization header
- Kỳ vọng nhận status 401 (Unauthorized)
- Server từ chối vì không có credentials

---

### 4. **Resource Not Found Tests** (❌ Kiểm tra 404)

Ví dụ: **Income / Delete 404 - invalid id**
```javascript
pm.test('status is 404', function () { 
  pm.response.to.have.status(404); 
});
```

**Cơ chế:**
- Gửi DELETE với ID không tồn tại
- Kỳ vọng nhận status 404 (Not Found)
- Server không tìm thấy resource

---

## 🔐 Environment Management

### File: `local.postman_environment.json`

```json
{
  "id": "...",
  "name": "Local Environment",
  "values": [
    { "key": "baseUrl", "value": "http://localhost:8000", "enabled": true },
    { "key": "email", "value": "test@example.com", "enabled": true },
    { "key": "password", "value": "password123", "enabled": true },
    { "key": "fullName", "value": "Test User", "enabled": true },
    { "key": "authToken", "value": "", "enabled": true }  // Được set bởi tests
  ]
}
```

### Cách hoạt động:

1. **Pre-test**: Environment variables được thay thế
   ```
   URL: {{baseUrl}}/api/v1/auth/login
   ↓ (thay thế)
   URL: http://localhost:8000/api/v1/auth/login
   ```

2. **During test**: Có thể đọc environment
   ```javascript
   const email = pm.environment.get('email');
   ```

3. **Post-test**: Có thể ghi environment
   ```javascript
   pm.environment.set('authToken', body.token);
   ```

---

## ✅ Test Assertions (Kiểm tra)

### 1. **Status Code Assertions**
```javascript
// Kiểm tra status chính xác
pm.response.to.have.status(200);

// Kiểm tra một trong các status
pm.expect([200, 201]).to.include(pm.response.code);

// Kiểm tra status range
pm.expect(pm.response.code).to.be.oneOf([200, 201, 404]);
```

### 2. **Body Assertions**
```javascript
// Parse JSON response
const body = pm.response.json();

// Kiểm tra field tồn tại
pm.expect(body).to.have.property('token');

// Kiểm tra giá trị
pm.expect(body.email).to.eql('test@example.com');

// Kiểm tra array không rỗng
pm.expect(body.data).to.be.an('array').that.is.not.empty;
```

### 3. **Header Assertions**
```javascript
pm.response.to.have.header('Content-Type');
pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json');
```

---

## 🔐 Flow của Authorization

### Quy trình Authentication:

```
┌─────────────────────────────────────────────────┐
│ 1. Auth / Register atau Login                   │
│    POST /api/v1/auth/login                      │
│    Body: { email, password }                    │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 2. Server xác thực                              │
│    - Kiểm tra email tồn tại                     │
│    - Kiểm tra password đúng                     │
│    - Tạo JWT token                              │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 3. Response Status 200                          │
│    Body: { token: "eyJhbGc...", user: {...} }  │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 4. Test Script lưu token                        │
│    pm.environment.set('authToken', token)       │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 5. Requests tiếp theo sử dụng token             │
│    GET /api/v1/dashboard                        │
│    Header: Authorization: Bearer {{authToken}}  │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│ 6. Server xác minh token                        │
│    - Decode JWT token                           │
│    - Kiểm tra signature                         │
│    - Kiểm tra expiry                            │
│    - Trả về data của user                       │
└─────────────────────────────────────────────────┘
```

### Ví dụ cộng hưởng:

**Auth / Login:**
```javascript
if (pm.response.code === 200) {
  const body = pm.response.json();
  pm.environment.set('authToken', body.token || '');  // ← Lưu token
}
```

**Dashboard / Get Summary:**
```json
{
  "request": {
    "header": [
      { "key": "Authorization", "value": "Bearer {{authToken}}" }  // ← Sử dụng token
    ]
  }
}
```

---

## 📊 Ví dụ Chi Tiết: Flow Income Management

### Test Sequence:

```
1️⃣  Auth / Login
    ↓ Token được lưu vào environment

2️⃣  Income / Add
    ├─ Header: Authorization: Bearer {{authToken}}
    ├─ Body: { amount, category, date, description }
    └─ Kỳ vọng: 201 Created

3️⃣  Income / Get
    ├─ Header: Authorization: Bearer {{authToken}}
    └─ Kỳ vọng: 200 OK, array income items

4️⃣  Income / Delete
    ├─ Header: Authorization: Bearer {{authToken}}
    ├─ URL: /api/v1/income/{id}
    └─ Kỳ vọng: 200 OK hoặc 404 Not Found

5️⃣  Income / Add 400
    ├─ Body: { amount } // Missing category, date
    └─ Kỳ vọng: 400 Bad Request

6️⃣  Income / Get 401
    ├─ KHÔNG có Authorization header
    └─ Kỳ vọng: 401 Unauthorized
```

---

## 🚀 Chạy Tests

### Command Line:
```bash
# Chạy tất cả tests
npx newman run collections/finance-api.postman_collection.json \
  -e environments/local.postman_environment.json

# Chạy và export JSON report
npx newman run collections/finance-api.postman_collection.json \
  -e environments/local.postman_environment.json \
  -r json \
  --reporter-json-export reports/newman/report.json

# Chạy từ Postman UI
- Mở Postman
- Load collection
- Load environment
- Click "Run"
```

### Kết quả:
```
┌─────────────────────────────────────┐
│ Test Results                        │
├─────────────────────────────────────┤
│ ✓ 28 tests passed                   │
│ ✗ 3 tests failed                    │
│ Execution time: 2.5s                │
│ Response time: avg 150ms            │
└─────────────────────────────────────┘
```

---

## 📝 Tóm tắt

| Thành phần | Chức năng |
|-----------|---------|
| **Event (test)** | Chạy validation sau mỗi request |
| **pm.test()** | Tạo test case |
| **pm.expect()** | Assertion library |
| **pm.environment** | Quản lý variables |
| **Status codes** | Xác định kết quả (200, 400, 401, 404) |
| **Authorization** | Token được lưu & tái sử dụng |

