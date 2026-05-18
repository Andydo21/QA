# Postman API Tests - Quick Start Guide

## 🚀 Chạy Tests Ngay

### 1. Terminal Commands

```bash
# Chạy tất cả tests & hiển thị kết quả
cd backend
npx newman run tests/api-test/collections/finance-api.postman_collection.json \
  -e tests/api-test/environments/local.postman_environment.json

# Chạy & export report
npx newman run tests/api-test/collections/finance-api.postman_collection.json \
  -e tests/api-test/environments/local.postman_environment.json \
  -r json \
  --reporter-json-export tests/api-test/reports/newman/report.json
```

### 2. Postman Desktop App

1. File → Import → Select: `collections/finance-api.postman_collection.json`
2. File → Import → Select: `environments/local.postman_environment.json`
3. Click "Runner" button (top left)
4. Select collection & environment
5. Click "Start Test"

---

## 📝 Cách hoạt động của Tests

### Environment Setup
Trước khi chạy, cần set environment variables ở `environments/local.postman_environment.json`:

```json
{
  "key": "baseUrl",
  "value": "http://localhost:8000"  // Server URL
}
```

### Test Flow
```
1. Login → lưu token
2. Dùng token cho requests khác
3. Mỗi request có test script để validate response
4. Status code xác định kết quả:
   ✅ 200 = Success
   ❌ 400 = Validation error
   ❌ 401 = Authorization error
   ❌ 404 = Not found
```

### Ví dụ: Income Management Flow

```
[Auth / Login] (status 200)
    ↓ save token to {{authToken}}
    
[Income / Add] (status 200)
    ↓ save ID to {{incomeId}}
    
[Income / Get] (status 200)
    ↓ verify is array
    
[Income / Get 401] (status 401, no token)
    ↓ verify authorization check
    
[Income / Delete 404] (status 404, invalid id)
    ↓ verify error handling
```

---

## 📚 Documentation Files

| File | Mục đích |
|------|---------|
| **README.md** | Tóm tắt nhanh các modules |
| **POSTMAN_EXAMPLES.md** | Chi tiết các test patterns |
| **TEST_DOCUMENTATION.md** | Hướng dẫn toàn diện |
| **finance-api.postman_collection.json** | Collection chính (có comments) |
| **local.postman_environment.json** | Environment variables |

---

## 🔍 Đọc Comments trong Tests

Mỗi request đều có comments giải thích:

### Ví dụ 1: Auth/Login
```javascript
// Bước 1: Kiểm tra status code (200 = success, 400 = error)
pm.test('status is 200 or 400', function () { ... });

// Bước 2: Nếu login thành công, lưu token
if (pm.response.code === 200) {
  pm.environment.set('authToken', body.token);
}
```

### Ví dụ 2: Income/Get 401
```javascript
// Kiểm tra 401 (Unauthorized)
pm.test('status is 401', function () { 
  pm.response.to.have.status(401); 
});

// 401 vì request KHÔNG có Authorization header
```

---

## 🛠️ Thêm Request Mới

Template cho request mới:

```json
{
  "name": "Module / Action",
  "description": "Chi tiết mục đích",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "// === COMMENTS ===",
          "pm.test('description', function () {",
          "  // logic",
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
    "body": { "mode": "raw", "raw": "{...}" },
    "url": { "raw": "{{baseUrl}}/api/v1/...", "host": [...], "path": [...] }
  }
}
```

---

## 📊 Test Coverage

**31 requests** trong 12 modules:

- ✅ Auth (6) - Login, Register, Get User
- ✅ News (1) - Get news list
- ✅ Ticker (1) - Get bar data
- ✅ Dashboard (2) - Get summary
- ✅ Income (5) - Add, Get, Delete, Errors
- ✅ Expense (5) - Add, Get, Delete, Errors
- ✅ Watchlist (4) - Add, Get, Remove
- ✅ Assets (1) - Search
- ✅ Price (2) - Latest price
- ✅ Market (1) - Market tickers
- ✅ Prediction (2) - Health check
- ✅ Health (1) - Server health

---

## ❌ Troubleshooting

### Tests Fail: "401 Unauthorized"
**Nguyên nhân:** Token không được lưu từ Auth/Login

**Giải pháp:**
1. Kiểm tra email/password trong environment đúng
2. Login request có status 200 không?
3. Response có field `token` không?

### Tests Fail: "Cannot read property..."
**Nguyên nhân:** Response không có expected field

**Giải pháp:**
1. Kiểm tra request body (có missing fields không?)
2. Kiểm tra server response (curl test trước)
3. Kiểm tra API version có thay đổi không?

### Tests Pass Nhưng Data Sai
**Nguyên nhân:** API response không match expectation

**Giải pháp:**
1. Check API documentation
2. Verify request parameters
3. Check server logs

---

## 💡 Tips & Tricks

### Sử dụng Pre-request Script
```javascript
// Tạo timestamps tự động
pm.environment.set('currentDate', new Date().toISOString());
```

### Debug Response
```javascript
// Log response để xem
console.log(JSON.stringify(pm.response.json(), null, 2));
```

### Conditional Requests
```javascript
// Chạy request này nếu condition true
if (pm.environment.get('authToken')) {
  // request will run
}
```

---

## 🎯 Next Steps

1. **Chạy collection:** `npx newman run ...`
2. **Kiểm tra reports:** `tests/api-test/reports/newman/report.json`
3. **Thêm test mới:** Edit collection, add request
4. **CI/CD:** Integrate với GitHub Actions
5. **Monitor:** Set up scheduled test runs

