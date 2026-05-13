// tests/unit/authMiddleware.test.js
// Unit tests for authMiddleware.js
// Tests: protect()


jest.mock('jsonwebtoken');
jest.mock('../../models/User');

const jwt  = require('jsonwebtoken');
const User = require('../../models/User');
const { protect } = require('../../middleware/authMiddleware');

// ─── Helper ───────────────────────────────────────────────────────────────
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
};

// ═══════════════════════════════════════════════════════════════════════════
// protect()
// ═══════════════════════════════════════════════════════════════════════════
describe('protect (authMiddleware)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });

    it('TC-M01 – returns 401 when Authorization header is absent', async () => {        // [SECURITY] Từ chối request không có token
        // INPUT: Request headers TRỐNG (không có Authorization)
        // EXPECTED: Status 401 (Unauthorized), không gọi next() → BLOCK request        const req  = { headers: {} };
        const res  = mockRes();
        const next = jest.fn();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('TC-M03 – returns 401 when token is invalid', async () => {
        jwt.verify.mockImplementation(() => { throw new Error('invalid signature'); });
        const req  = { headers: { authorization: 'Bearer badtoken' } };
        const res  = mockRes();
        const next = jest.fn();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, token failed' });
        expect(next).not.toHaveBeenCalled();
    });

    it('TC-M04 – returns 401 when token is expired', async () => {
        jwt.verify.mockImplementation(() => { throw Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' }); });
        const req  = { headers: { authorization: 'Bearer expiredtoken' } };
        const res  = mockRes();
        const next = jest.fn();
        await protect(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('TC-M05 – attaches user to req and calls next() on valid token', async () => {
        // [HAPPY PATH] Xác thực token hợp lệ → cho phép request tiếp tục
        // INPUT: Authorization header chứa token hợp lệ
        // STEP: 1) Verify token (jwt.verify trả về { id: 'user123' })
        //       2) Lấy user từ DB (mock User.findById)
        //       3) Attach user vào req.user
        //       4) Gọi next() → middleware pass
        // EXPECTED: req.user có user info, next() được gọi → request tiếp tục
        jwt.verify.mockReturnValue({ id: 'user123' });
        const fakeUser = { _id: 'user123', fullName: 'John' };
        User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });

        const req  = { headers: { authorization: 'Bearer validtoken' } };
        const res  = mockRes();
        const next = jest.fn();
        await protect(req, res, next);

        expect(jwt.verify).toHaveBeenCalledWith('validtoken', 'test-secret');
        expect(req.user).toEqual(fakeUser);
        expect(next).toHaveBeenCalled();
    });

    it('TC-M06 – select("-password") is called to exclude password from user', async () => {
        jwt.verify.mockReturnValue({ id: 'u1' });
        const selectMock = jest.fn().mockResolvedValue({ _id: 'u1' });
        User.findById.mockReturnValue({ select: selectMock });

        const req  = { headers: { authorization: 'Bearer tok' } };
        const res  = mockRes();
        const next = jest.fn();
        await protect(req, res, next);

        expect(selectMock).toHaveBeenCalledWith('-password');
    });
});
