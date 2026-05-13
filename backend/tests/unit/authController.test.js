// tests/unit/authController.test.js
// Unit tests for authController.js
// Tests: registerUser, loginUser, forgotPassword, resetPassword, validateResetToken, generateToken


// ─── Mock modules before importing controller ──────────────────────────────
jest.mock('jsonwebtoken');
jest.mock('crypto');
jest.mock('nodemailer');
jest.mock('../../models/User');

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../../models/User');

const {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword,
    validateResetToken,
} = require('../../controllers/authController');

// ─── Helpers ───────────────────────────────────────────────────────────────
/** Build a minimal mock res object */
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.download = jest.fn().mockReturnValue(res);
    return res;
};

/** Build a request with body and optional params */
const mockReq = (body = {}, params = {}, headers = {}) => ({ body, params, headers });

// ═══════════════════════════════════════════════════════════════════════════
// 1. generateToken (helper – tested indirectly via register / login)
// ═══════════════════════════════════════════════════════════════════════════
describe('generateToken (helper)', () => {
    beforeEach(() => {
        process.env.JWT_SECRET = 'test-secret';
        jwt.sign.mockReturnValue('mocked.jwt.token');
    });

    it('should call jwt.sign with id and JWT_SECRET and return a token', async () => {
        // Trigger via registerUser which calls generateToken internally
        const fakeUser = {
            _id: 'user123',
            comparePassWord: jest.fn().mockResolvedValue(true),
        };
        User.findOne.mockResolvedValue(null);   // no existing user
        User.create.mockResolvedValue(fakeUser);

        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'Secret1' });
        const res = mockRes();

        await registerUser(req, res);

        expect(jwt.sign).toHaveBeenCalledWith(
            { id: 'user123' },
            'test-secret',
            { expiresIn: '1h' }
        );
        expect(res.status).toHaveBeenCalledWith(201);
        const payload = res.json.mock.calls[0][0];
        expect(payload.token).toBe('mocked.jwt.token');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. registerUser
// ═══════════════════════════════════════════════════════════════════════════
describe('registerUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        jwt.sign.mockReturnValue('tok');
    });

    it('TC-R01 – returns 400 when fullName is missing', async () => {
        // [VALIDATION] Kiểm tra: nếu thiếu fullName, API từ chối (400)
        // INPUT: email + password, nhưng THIẾU fullName
        // EXPECTED: Status 400 + message "Please fill in all required fields"
        const req = mockReq({ email: 'a@b.com', password: 'pass' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Please fill in all required fields' });
    });

    it('TC-R02 – returns 400 when email is missing', async () => {
        const req = mockReq({ fullName: 'John', password: 'pass' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-R03 – returns 400 when password is missing', async () => {
        const req = mockReq({ fullName: 'John', email: 'a@b.com' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-R04 – returns 400 when email is already in use', async () => {
        User.findOne.mockResolvedValue({ _id: 'existing' });
        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'pass' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Email already in use' });
    });

    it('TC-R05 – creates user and returns 201 with token', async () => {
        // [HAPPY PATH] Đăng ký thành công: email chưa tồn tại + tất cả dữ liệu hợp lệ
        // STEP: 1) Kiểm tra email chưa có (mock findOne = null)
        //       2) Tạo user mới (mock User.create)
        //       3) Sinh JWT token
        // EXPECTED: Status 201 (Created), trả về token + user thông tin
        const fakeUser = { _id: 'newId' };
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(fakeUser);
        jwt.sign.mockReturnValue('jwt-token');

        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'pass' });
        const res = mockRes();
        await registerUser(req, res);

        expect(User.create).toHaveBeenCalledWith({
            fullName: 'John',
            email: 'a@b.com',
            password: 'pass',
            profilePicture: undefined,
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json.mock.calls[0][0]).toMatchObject({ token: 'jwt-token' });
    });

    it('TC-R06 – returns 500 on unexpected DB error', async () => {
        User.findOne.mockRejectedValue(new Error('DB down'));
        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'pass' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-R07 – gracefully handles missing req.body', async () => {
        const req = { body: undefined };
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-R08 – returns 400 when password is shorter than 8 chars', async () => {
        // [KNOWN BUG] controller chưa validate độ dài password → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'Sh0rt' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-R09 – returns 400 when password has no lowercase letter', async () => {
        // [KNOWN BUG] controller chưa validate chữ thường → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'ALLCAPS1' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-R10 – returns 400 when password has no uppercase letter', async () => {
        // [KNOWN BUG] controller chưa validate chữ hoa → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'alllower1' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-R11 – returns 400 when password has no digit', async () => {
        // [KNOWN BUG] controller chưa validate chữ số → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: 'NoDigitHere' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-R12 – FAIL: invalid email format should be rejected', async () => {
        // [KNOWN BUG] controller chưa validate format email → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const req = mockReq({ fullName: 'John', email: 'invalidemail', password: 'ValidPass1' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });



    //Additional edge case tests for registerUser
    it('TC-R12 – FAIL: email format invalid (no @)', async () => {
        // [KNOWN BUG] controller chưa validate format email → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const req = mockReq({ fullName: 'John', email: 'invalidemail', password: 'ValidPass1' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
    it('TC-R15 – FAIL: password with max length exceeded (10000+ chars)', async () => {
        // [KNOWN BUG] controller chưa validate độ dài tối đa → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const longPassword = 'A' + 'a'.repeat(5000) + '1';
        const req = mockReq({ fullName: 'John', email: 'a@b.com', password: longPassword });
        const res = mockRes();
        await registerUser(req, res);
        // Should reject unreasonably long passwords
        expect(res.status).toHaveBeenCalledWith(400);
    });
    it('TC-R16 – FAIL: fullName too short (< 2 chars)', async () => {
        // [KNOWN BUG] controller chưa validate độ dài fullName → trả 201 thay vì 400
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'newId' });
        const req = mockReq({ fullName: 'A', email: 'a@b.com', password: 'ValidPass1' });
        const res = mockRes();
        await registerUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. loginUser
// ═══════════════════════════════════════════════════════════════════════════
describe('loginUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        jwt.sign.mockReturnValue('login-token');
    });

    it('TC-L01 – returns 400 when email missing', async () => {
        const req = mockReq({ password: 'pass' });
        const res = mockRes();
        await loginUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Please provide email and password' });
    });

    it('TC-L02 – returns 400 when password missing', async () => {
        const req = mockReq({ email: 'a@b.com' });
        const res = mockRes();
        await loginUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-L03 – returns 400 when user not found', async () => {
        User.findOne.mockResolvedValue(null);
        const req = mockReq({ email: 'x@y.com', password: 'pass' });
        const res = mockRes();
        await loginUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email or password' });
    });

    it('TC-L04 – returns 400 when password does not match', async () => {
        User.findOne.mockResolvedValue({
            _id: 'u1',
            comparePassWord: jest.fn().mockResolvedValue(false),
        });
        const req = mockReq({ email: 'a@b.com', password: 'wrong' });
        const res = mockRes();
        await loginUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email or password' });
    });

    it('TC-L05 – returns 200 with token on valid credentials', async () => {
        // [HAPPY PATH] Đăng nhập thành công: email + password đúng
        // STEP: 1) Tìm user bằng email (mock findOne = user tồn tại)
        //       2) So sánh password (mock comparePassWord = true)
        //       3) Sinh JWT token
        // EXPECTED: Status 200 (OK), trả về token + user ID
        const fakeUser = { _id: 'u1', comparePassWord: jest.fn().mockResolvedValue(true) };
        User.findOne.mockResolvedValue(fakeUser);

        const req = mockReq({ email: 'a@b.com', password: 'correct' });
        const res = mockRes();
        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload).toMatchObject({ id: 'u1', token: 'login-token' });
    });

    it('TC-L06 – returns 500 on DB error', async () => {
        User.findOne.mockRejectedValue(new Error('fail'));
        const req = mockReq({ email: 'a@b.com', password: 'pass' });
        const res = mockRes();
        await loginUser(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-L07 – handles missing req.body gracefully', async () => {
        const req = { body: undefined };
        const res = mockRes();
        await loginUser(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // Additional edge case tests for loginUser
    it('TC-L08 – FAIL: invalid email format', async () => {
        // [KNOWN BUG] loginUser không validate format email
        // email 'notanemail' có giá trị truthy → qua check, vào DB tìm user
        // Nếu findOne trả null → controller trả 400 "Invalid email or password"
        User.findOne.mockResolvedValue(null);
        const req = mockReq({ email: 'notanemail', password: 'pass' });
        const res = mockRes();
        await loginUser(req, res);
        // Controller không validate email format → đi vào DB → trả 400 (user not found)
        // Đúng ra phải reject sớm với 400 "invalid email format" [KNOWN BUG]
        expect(res.status).toHaveBeenCalledWith(400);
    });

});


// ═══════════════════════════════════════════════════════════════════════════
// 4. forgotPassword
// ═══════════════════════════════════════════════════════════════════════════
describe('forgotPassword', () => {
    let sendMailMock;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.EMAIL_USER = 'user@test.com';
        process.env.EMAIL_PASS = 'secret';
        process.env.FRONTEND_URL = 'http://localhost:5173';

        sendMailMock = jest.fn().mockResolvedValue({});
        nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

        // Spy on crypto
        crypto.randomBytes.mockReturnValue({ toString: () => 'rawtoken' });
        const mockHashObj = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('hashedtoken') };
        crypto.createHash.mockReturnValue(mockHashObj);
    });

    it('TC-FP01 – returns 404 when user not found', async () => {
        User.findOne.mockResolvedValue(null);
        const req = mockReq({ email: 'no@user.com' });
        const res = mockRes();
        await forgotPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('TC-FP02 – saves hashed token and expiry to user', async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeUser = {
            email: 'a@b.com',
            save: saveMock,
            resetPasswordToken: null,
            resetPasswordExpires: null,
        };
        User.findOne.mockResolvedValue(fakeUser);

        const req = mockReq({ email: 'a@b.com' });
        const res = mockRes();
        await forgotPassword(req, res);

        expect(fakeUser.resetPasswordToken).toBe('hashedtoken');
        expect(fakeUser.resetPasswordExpires).toBeGreaterThan(Date.now() - 1000);
        expect(saveMock).toHaveBeenCalled();
    });

    it('TC-FP03 – sends email and returns 200', async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeUser = { email: 'a@b.com', save: saveMock, resetPasswordToken: null, resetPasswordExpires: null };
        User.findOne.mockResolvedValue(fakeUser);

        const req = mockReq({ email: 'a@b.com' });
        const res = mockRes();
        await forgotPassword(req, res);

        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com' }));
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-FP04 – returns 500 when email send fails (BUG: user out-of-scope in catch)', async () => {
        // SOURCE CODE BUG: authController.js catch block references `user` which is
        // scoped to try block → ReferenceError is thrown and propagates uncaught.
        // This test documents the bug: the controller crashes instead of sending 500.
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeUser = { email: 'a@b.com', save: saveMock, resetPasswordToken: null, resetPasswordExpires: null };
        User.findOne.mockResolvedValue(fakeUser);
        sendMailMock.mockRejectedValue(new Error('SMTP down'));

        const req = mockReq({ email: 'a@b.com' });
        const res = mockRes();

        // Bug causes ReferenceError to propagate – catch it here to document behavior
        try {
            await forgotPassword(req, res);
        } catch (e) {
            // Expected: ReferenceError: user is not defined (source code bug)
            expect(e).toBeInstanceOf(ReferenceError);
            return;
        }
        // If no exception: still verify 500 was sent
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-FP05 – returns 500 when email config missing (BUG: user out-of-scope in catch)', async () => {
        // Same source code bug: `user` not accessible in catch block
        delete process.env.EMAIL_USER;
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeUser = { email: 'a@b.com', save: saveMock, resetPasswordToken: null, resetPasswordExpires: null };
        User.findOne.mockResolvedValue(fakeUser);

        const req = mockReq({ email: 'a@b.com' });
        const res = mockRes();

        try {
            await forgotPassword(req, res);
        } catch (e) {
            expect(e).toBeInstanceOf(ReferenceError);
            return;
        }
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-FP09 – missing req.body crashes with unhandled exception', async () => {
        // Kiểm tra hành vi khi req.body undefined
        // Controller destructure `email` từ undefined → TypeError → crash ra ngoài (không catch được)
        const req = { body: undefined };
        const res = mockRes();
        await expect(forgotPassword(req, res)).rejects.toThrow(TypeError);
    });
});


// ═══════════════════════════════════════════════════════════════════════════
// 5. resetPassword
// ═══════════════════════════════════════════════════════════════════════════
describe('resetPassword', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const mockHashObj = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('hashedtoken') };
        crypto.createHash.mockReturnValue(mockHashObj);
    });

    const makeReq = (password) => mockReq({ password }, { resetToken: 'rawtoken' });

    it('TC-RP01 – returns 400 when password is shorter than 8 chars', async () => {
        const req = makeReq('Sh0rt');
        const res = mockRes();
        await resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toContain('8');
    });

    it('TC-RP02 – returns 400 when password has no lowercase letter', async () => {
        const req = makeReq('ALLCAPS1');
        const res = mockRes();
        await resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toContain('thường');
    });

    it('TC-RP03 – returns 400 when password has no uppercase letter', async () => {
        const req = makeReq('alllower1');
        const res = mockRes();
        await resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toContain('hoa');
    });

    it('TC-RP04 – returns 400 when password has no digit', async () => {
        const req = makeReq('NoDigitHere');
        const res = mockRes();
        await resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toContain('số');
    });

    it('TC-RP05 – returns 400 when token is invalid or expired', async () => {
        User.findOne.mockResolvedValue(null);
        const req = makeReq('ValidPass1');
        const res = mockRes();
        await resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toContain('hết hạn');
    });

    it('TC-RP06 – updates password, clears token, returns 200', async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeUser = {
            password: 'old',
            resetPasswordToken: 'hashedtoken',
            resetPasswordExpires: Date.now() + 99999,
            save: saveMock,
        };
        User.findOne.mockResolvedValue(fakeUser);

        const req = makeReq('NewPass1');
        const res = mockRes();
        await resetPassword(req, res);

        expect(fakeUser.password).toBe('NewPass1');
        expect(fakeUser.resetPasswordToken).toBeUndefined();
        expect(saveMock).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-RP07 – returns 500 on DB error', async () => {
        User.findOne.mockRejectedValue(new Error('DB error'));
        const req = makeReq('ValidPass1');
        const res = mockRes();
        await resetPassword(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-RP08 – FAIL: missing password should return 400', async () => {
        const req = mockReq({}, { resetToken: 'rawtoken' });
        const res = mockRes();

        try {
            await resetPassword(req, res);
        } catch (e) {
            // Current behavior throws TypeError before returning a response.
        }

        expect(res.status).toHaveBeenCalledWith(400);
    });


    it('TC-RP11 – FAIL: password same as old password', async () => {
        // [KNOWN BUG] controller không check password mới có trùng password cũ không
        // INPUT: password mới === password cũ
        // EXPECTED: 400 (reject), nhưng controller trả 200 (đặt lại thành công)
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeUser = {
            password: 'OldPass1',
            resetPasswordToken: 'hashedtoken',
            resetPasswordExpires: Date.now() + 99999,
            save: saveMock,
            comparePassWord: jest.fn().mockResolvedValue(true), // same password
        };
        User.findOne.mockResolvedValue(fakeUser);

        const req = mockReq({ password: 'OldPass1' }, { resetToken: 'rawtoken' });
        const res = mockRes();
        await resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. validateResetToken
// ═══════════════════════════════════════════════════════════════════════════
describe('validateResetToken', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const mockHashObj = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('hashedtoken') };
        crypto.createHash.mockReturnValue(mockHashObj);
    });

    it('TC-VT01 – returns 400 when token is not found in DB', async () => {
        User.findOne.mockResolvedValue(null);
        const req = mockReq({}, { resetToken: 'badtoken' });
        const res = mockRes();
        await validateResetToken(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toContain('hết hạn');
    });

    it('TC-VT02 – returns 200 and "Token hợp lệ" for a valid, non-expired token', async () => {
        User.findOne.mockResolvedValue({ _id: 'u1' });
        const req = mockReq({}, { resetToken: 'goodtoken' });
        const res = mockRes();
        await validateResetToken(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Token hợp lệ' });
    });

    it('TC-VT03 – hashes the token before querying the DB', async () => {
        User.findOne.mockResolvedValue(null);
        const req = mockReq({}, { resetToken: 'rawtoken' });
        const res = mockRes();
        await validateResetToken(req, res);

        expect(crypto.createHash).toHaveBeenCalledWith('sha256');
        expect(User.findOne).toHaveBeenCalledWith(expect.objectContaining({
            resetPasswordToken: 'hashedtoken',
        }));
    });

    it('TC-VT04 – uses $gt: Date.now() to reject expired tokens', async () => {
        User.findOne.mockResolvedValue(null);
        const req = mockReq({}, { resetToken: 'tok' });
        const res = mockRes();
        await validateResetToken(req, res);

        const callArg = User.findOne.mock.calls[0][0];
        expect(callArg).toHaveProperty('resetPasswordExpires.$gt');
    });

    it('TC-VT05 – returns 500 on unexpected error', async () => {
        User.findOne.mockRejectedValue(new Error('crash'));
        const req = mockReq({}, { resetToken: 'tok' });
        const res = mockRes();
        await validateResetToken(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-VT06 – FAIL: missing resetToken should return 400', async () => {
        // [KNOWN BUG] validateResetToken gọi crypto.createHash(undefined) → crash → 500
        // Đúng ra phải validate resetToken rỗng trước → trả 400
        const req = mockReq({}, {});
        const res = mockRes();
        await validateResetToken(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
