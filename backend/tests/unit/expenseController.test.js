// tests/unit/expenseController.test.js

jest.mock('xlsx');
jest.mock('../../models/Expense');

const xlsx    = require('xlsx');
const Expense = require('../../models/Expense');

const {
    addExpense,
    getAllExpense,
    deleteExpense,
    updateExpense,
    downloadExpenseExcel,
    getUniqueCategories,
} = require('../../controllers/expenseController');

const mockRes = () => {
    const res = {};
    res.status   = jest.fn().mockReturnValue(res);
    res.json     = jest.fn().mockReturnValue(res);
    res.download = jest.fn().mockReturnValue(res);
    return res;
};
const baseReq = (body = {}, params = {}) => ({ user: { id: 'user1' }, body, params });

// ─── addExpense ───────────────────────────────────────────────────────────
describe('addExpense', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-AE01 – 400 when category missing', async () => {
        // [VALIDATION] Kiểm tra: thiếu category → từ chối (400)
        // INPUT: amount + date, nhưng THIẾU category
        // EXPECTED: Status 400 (Bad Request)
        const res = mockRes();
        await addExpense(baseReq({ amount: 50, date: '2024-01-01' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-AE02 – 400 when amount missing', async () => {
        const res = mockRes();
        await addExpense(baseReq({ category: 'Food', date: '2024-01-01' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-AE03 – 400 when date missing', async () => {
        const res = mockRes();
        await addExpense(baseReq({ category: 'Food', amount: 50 }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-AE04 – saves and returns 200', async () => {
        // [HAPPY PATH] Thêm chi phí thành công: tất cả dữ liệu hợp lệ
        // INPUT: icon, category, amount, date (đầy đủ)
        // STEP: 1) Tạo Expense instance mới (mock Expense)
        //       2) Gọi save() để lưu vào DB
        //       3) Trả về dữ liệu đã lưu
        // EXPECTED: Status 200 (OK), trả về expense info
        const saveMock = jest.fn().mockResolvedValue(true);
        const newDoc = { _id: 'exp1', category: 'Food', amount: 50, date: new Date('2024-01-01'), save: saveMock };
        Expense.mockImplementation(() => newDoc);
        const res = mockRes();
        await addExpense(baseReq({ icon: '🍔', category: 'Food', amount: 50, date: '2024-01-01' }), res);
        expect(saveMock).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(newDoc);
    });

    it('TC-AE05 – 500 on save error', async () => {
        Expense.mockImplementation(() => ({ save: jest.fn().mockRejectedValue(new Error('fail')) }));
        const res = mockRes();
        await addExpense(baseReq({ category: 'Food', amount: 50, date: '2024-01-01' }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-AE06 – FAIL: missing category should stay as 400 and not be overwritten', async () => {
        // [BLACK BOX] Chỉ nhìn vào response: thiếu category phải dừng ở 400
        // EXPECTED: status cuối cùng vẫn là 400
        const res = mockRes();
        await addExpense(baseReq({ amount: 50, date: '2024-01-01' }), res);
        expect(res.status).toHaveBeenLastCalledWith(400);
    });

    it('TC-AE07 – FAIL: invalid date should be rejected', async () => {
        // [BLACK BOX] date không hợp lệ phải bị từ chối
        // INPUT: date = "not-a-date"
        // EXPECTED: status 400
        const res = mockRes();
        await addExpense(baseReq({ category: 'Food', amount: 50, date: 'not-a-date' }), res);
        expect(res.status).toHaveBeenLastCalledWith(400);
    });
});

// ─── getAllExpense ─────────────────────────────────────────────────────────
describe('getAllExpense', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GAE01 – returns sorted expenses with 200', async () => {
        const expenses = [{ _id: 'x' }];
        Expense.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(expenses) });
        const res = mockRes();
        await getAllExpense(baseReq(), res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expenses);
    });

    it('TC-GAE02 – sorted with { date: -1 }', async () => {
        const sortMock = jest.fn().mockResolvedValue([]);
        Expense.find.mockReturnValue({ sort: sortMock });
        await getAllExpense(baseReq(), mockRes());
        expect(sortMock).toHaveBeenCalledWith({ date: -1 });
    });

    it('TC-GAE03 – 500 on DB error', async () => {
        Expense.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('fail')) });
        const res = mockRes();
        await getAllExpense(baseReq(), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ─── deleteExpense ────────────────────────────────────────────────────────
describe('deleteExpense', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-DEL01 – deletes by id and returns 200', async () => {
        Expense.findByIdAndDelete.mockResolvedValue(true);
        const req = { ...baseReq(), params: { id: 'exp1' } };
        const res = mockRes();
        await deleteExpense(req, res);
        expect(Expense.findByIdAndDelete).toHaveBeenCalledWith('exp1');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-DEL02 – 500 on error', async () => {
        Expense.findByIdAndDelete.mockRejectedValue(new Error('fail'));
        const res = mockRes();
        await deleteExpense({ ...baseReq(), params: { id: 'e1' } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-DEL03 – FAIL: deleting unknown expense should return 404', async () => {
        // [BLACK BOX] Xóa id không tồn tại phải trả 404
        // EXPECTED: không trả 200 cho id không có trong hệ thống
        Expense.findByIdAndDelete.mockResolvedValue(null);
        const res = mockRes();
        await deleteExpense({ ...baseReq(), params: { id: 'missing-id' } }, res);
        expect(res.status).toHaveBeenLastCalledWith(404);
    });
});

// ─── updateExpense ────────────────────────────────────────────────────────
describe('updateExpense', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-UE01 – 400 when required fields missing', async () => {
        const res = mockRes();
        await updateExpense({ user: { id: 'u1' }, params: { id: 'e1' }, body: { category: 'Food' } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-UE02 – 404 when expense not found', async () => {
        Expense.findById.mockResolvedValue(null);
        const res = mockRes();
        await updateExpense({ user: { id: 'u1' }, params: { id: 'e1' }, body: { category: 'Food', amount: 50, date: '2024-01-01' } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('TC-UE03 – 403 when user is not the owner', async () => {
        Expense.findById.mockResolvedValue({ userId: { toString: () => 'other' }, save: jest.fn() });
        const res = mockRes();
        await updateExpense({ user: { id: 'u1' }, params: { id: 'e1' }, body: { category: 'Food', amount: 50, date: '2024-01-01' } }, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('TC-UE04 – updates fields and returns 200 for owner', async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeExpense = { userId: { toString: () => 'u1' }, icon: '', category: '', amount: 0, date: null, save: saveMock };
        Expense.findById.mockResolvedValue(fakeExpense);
        const res = mockRes();
        await updateExpense({ user: { id: 'u1' }, params: { id: 'e1' }, body: { icon: '🛒', category: 'Shopping', amount: 200, date: '2024-03-15' } }, res);
        expect(fakeExpense.category).toBe('Shopping');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-UE05 – 500 on DB error', async () => {
        Expense.findById.mockRejectedValue(new Error('fail'));
        const res = mockRes();
        await updateExpense({ user: { id: 'u1' }, params: { id: 'e1' }, body: { category: 'Food', amount: 50, date: '2024-01-01' } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('TC-UE06 – FAIL: invalid date should be rejected with 400', async () => {
        // [BLACK BOX] date sai định dạng phải bị từ chối
        // EXPECTED: 400 thay vì cập nhật thành công
        Expense.findById.mockResolvedValue({ userId: { toString: () => 'u1' }, save: jest.fn() });
        const res = mockRes();
        await updateExpense({ user: { id: 'u1' }, params: { id: 'e1' }, body: { icon: '🛒', category: 'Shopping', amount: 200, date: 'invalid-date' } }, res);
        expect(res.status).toHaveBeenLastCalledWith(400);
    });
});

// ─── downloadExpenseExcel ─────────────────────────────────────────────────
describe('downloadExpenseExcel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        xlsx.utils = { book_new: jest.fn().mockReturnValue({}), json_to_sheet: jest.fn().mockReturnValue({}), book_append_sheet: jest.fn() };
        xlsx.writeFile = jest.fn();
    });

    it('TC-DEE01 – builds workbook and calls res.download', async () => {
        const fakeExpenses = [{ category: 'Food', amount: 50, date: new Date('2024-01-01') }];
        Expense.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(fakeExpenses) });
        const res = mockRes();
        await downloadExpenseExcel(baseReq(), res);
        expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith([{ Category: 'Food', Amount: 50, Date: fakeExpenses[0].date }]);
        expect(res.download).toHaveBeenCalled();
    });

    it('TC-DEE02 – 500 on error', async () => {
        Expense.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('fail')) });
        const res = mockRes();
        await downloadExpenseExcel(baseReq(), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ─── getUniqueCategories ──────────────────────────────────────────────────
describe('getUniqueCategories', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GUC01 – returns sorted unique categories', async () => {
        Expense.distinct.mockResolvedValue(['Shopping', 'Food', 'Bills']);
        const res = mockRes();
        await getUniqueCategories(baseReq(), res);
        expect(res.json.mock.calls[0][0]).toEqual(['Bills', 'Food', 'Shopping']);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-GUC02 – filters out falsy values', async () => {
        Expense.distinct.mockResolvedValue(['Food', '', null]);
        const res = mockRes();
        await getUniqueCategories(baseReq(), res);
        const result = res.json.mock.calls[0][0];
        expect(result).not.toContain('');
        expect(result).not.toContain(null);
    });

    it('TC-GUC03 – queries with userId', async () => {
        Expense.distinct.mockResolvedValue([]);
        await getUniqueCategories(baseReq(), mockRes());
        expect(Expense.distinct).toHaveBeenCalledWith('category', expect.objectContaining({ userId: 'user1' }));
    });

    it('TC-GUC04 – 500 on error', async () => {
        Expense.distinct.mockRejectedValue(new Error('fail'));
        const res = mockRes();
        await getUniqueCategories(baseReq(), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
