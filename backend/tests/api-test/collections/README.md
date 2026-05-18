# API Collection Coverage & Test Mechanisms

## Tổng quan
Collection này chứa 31 API tests cho Personal Financial Management API. Mỗi test có validation logic để kiểm tra response status và dữ liệu trả về.

## Cách hoạt động của Tests

### 1. **Environment Variables (Biến môi trường)**
- `{{baseUrl}}` - Base URL của API server (ví dụ: http://localhost:8000)
- `{{authToken}}` - JWT token lưu từ login/register thành công
- `{{email}}` - Email đăng nhập (được set trong environment)
- `{{fullName}}` - Tên người dùng
- `{{password}}` - Mật khẩu

### 2. **Test Scripts (Kiểm tra Response)**
Mỗi request có event "test" để validate:

```javascript
// Kiểm tra status code
pm.test('status is 200', function () { pm.response.to.have.status(200); });

// Kiểm tra response body
pm.test('email matches', function () { 
  pm.expect(pm.response.json().email).to.eql(pm.environment.get('email')); 
});

// Lưu token từ response
if (pm.response.code === 201) {
  const body = pm.response.json();
  pm.environment.set('authToken', body.token || '');
}
```

### 3. **Các Module API & Test Cases**

#### **Auth Module** (6 tests)
- ✅ Register: Tạo user mới → lưu authToken
- ✅ Login: Đăng nhập → lưu authToken
- ❌ Login 400 (missing email): Kiểm tra validation
- ❌ Login 400 (wrong password): Kiểm tra xác thực
- ✅ Get User: Lấy thông tin user (cần authToken)
- ❌ Get User 401 (no token): Kiểm tra authorization

#### **News Module** (1 test)
- ✅ Get News: Lấy danh sách tin tức → kiểm tra array không rỗng

#### **Ticker Module** (1 test)
- ✅ Get Bar: Lấy dữ liệu ticker (có thể 200 hoặc 500)

#### **Dashboard Module** (2 tests)
- ✅ Get Summary: Lấy tóm tắt dashboard (cần authToken)
- ❌ Get Summary 401: Kiểm tra xác thực

#### **Income Module** (5 tests)
- ✅ Add Income: Tạo thu nhập mới
- ❌ Add 400 (missing fields): Kiểm tra validation
- ✅ Get Income: Lấy danh sách thu nhập
- ❌ Get 401 (no token): Kiểm tra authorization
- ❌ Delete 404 (invalid id): Kiểm tra xử lý ID không tồn tại

#### **Expense Module** (5 tests)
- ✅ Add Expense: Tạo chi phí mới
- ❌ Add 400 (missing fields): Kiểm tra validation
- ✅ Get Expense: Lấy danh sách chi phí
- ❌ Get 401 (no token): Kiểm tra authorization
- ❌ Delete 404 (invalid id): Kiểm tra xử lý ID không tồn tại

#### **Watchlist Module** (4 tests)
- ✅ Add Watchlist: Thêm symbol vào watchlist
- ❌ Add 400 (missing symbol): Kiểm tra validation
- ✅ Get Watchlist: Lấy watchlist
- ❌ Get 401 (no token): Kiểm tra authorization
- ❌ Remove 404: Kiểm tra xử lý symbol không tồn tại

#### **Assets Module** (1 test)
- ✅ Search Assets: Tìm kiếm assets/symbols

#### **Price Module** (2 tests)
- ✅ Latest Price: Lấy giá mới nhất của symbol
- ❌ Latest 400 (missing symbol): Kiểm tra validation

#### **Market Module** (1 test)
- ✅ Get Market Tickers: Lấy danh sách tickers thị trường

#### **Prediction Module** (2 tests)
- ✅ Health Check: Kiểm tra prediction service
- ❌ Get 401 (no token): Kiểm tra authorization

#### **Health Module** (1 test)
- ✅ Health Report: Kiểm tra trạng thái server

## Quy ước Naming
- ✅ Test thành công (2xx status)
- ❌ Test lỗi/validation (4xx-5xx status)

## Cách chạy Tests
```bash
# Chạy tất cả tests
npx newman run finance-api.postman_collection.json -e local.postman_environment.json

# Chạy và export kết quả
npx newman run finance-api.postman_collection.json -e local.postman_environment.json -r json --reporter-json-export report.json
```

## Các API còn thiếu
- Conversation API
- Message API
- Finance API (tính toán tài chính)
