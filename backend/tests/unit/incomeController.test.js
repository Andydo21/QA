// tests/unit/incomeController.test.js
// Unit tests for incomeController.js
// Tests: addIncome, getAllIncome, deleteIncome, updateIncome, downloadIncomeExcel, getUniqueSources


jest.mock('xlsx');
jest.mock('../../models/Income');

const xlsx   = require('xlsx');
const Income = require('../../models/Income');

const {
    addIncome,
    getAllIncome,
    deleteIncome,
    updateIncome,
    downloadIncomeExcel,
    getUniqueSources,
} = require('../../controllers/incomeController');

// ─── Helpers ───────────────────────────────────────────────────────────────
const mockRes = () => {
    const res = {};
    res.status   = jest.fn().mockReturnValue(res);
    res.json     = jest.fn().mockReturnValue(res);
    res.download = jest.fn().mockReturnValue(res);
    return res;
};

const baseReq = (body = {}, params = {}) => ({
    user: { id: 'user1' },
    body,
    params,
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. addIncome
// ═══════════════════════════════════════════════════════════════════════════
describe('addIncome', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-AI01 – returns 400 when source is missing', async () => {
        // [VALIDATION] Kiểm tra: thiếu source → từ chối (400)
        // INPUT: amount + date, nhưng THIẾU source (nguồn thu)
        // EXPECTED: Status 400, message 'All fields are required'
        const req = baseReq({ amount: 100, date: '2024-01-01' });
        const res = mockRes();
        await addIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'All fields are required' });
    });

    it('TC-AI02 – returns 400 when amount is missing', async () => {
        const req = baseReq({ source: 'Salary', date: '2024-01-01' });
        const res = mockRes();
        await addIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-AI03 – returns 400 when date is missing', async () => {
        const req = baseReq({ source: 'Salary', amount: 100 });
        const res = mockRes();
        await addIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-AI04 – saves income and returns 200 with the new document', async () => {
        // [HAPPY PATH] Thêm thu nhập thành công: tất cả dữ liệu hợp lệ
        // INPUT: icon, source, amount, date (đầy đủ)
        // STEP: 1) Tạo Income instance mới (mock Income)
        //       2) Gọi save() để lưu vào DB
        //       3) Trả về dữ liệu đã lưu
        // EXPECTED: Status 200 (OK), trả về income info
        const saveMock = jest.fn().mockResolvedValue(true);
        const newDoc = { _id: 'inc1', source: 'Salary', amount: 1000, date: new Date('2024-01-01'), save: saveMock };
        Income.mockImplementation(() => newDoc);

        const req = baseReq({ icon: '💰', source: 'Salary', amount: 1000, date: '2024-01-01' });
        const res = mockRes();
        await addIncome(req, res);

        expect(saveMock).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(newDoc);
    });

    it('TC-AI05 – returns 500 on save error', async () => {
        Income.mockImplementation(() => ({ save: jest.fn().mockRejectedValue(new Error('fail')) }));
        const req = baseReq({ source: 'Salary', amount: 100, date: '2024-01-01' });
        const res = mockRes();
        await addIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. getAllIncome
// ═══════════════════════════════════════════════════════════════════════════
describe('getAllIncome', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GAI01 – returns incomes sorted by date desc', async () => {
        const incomes = [{ _id: 'a' }, { _id: 'b' }];
        Income.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(incomes) });

        const req = baseReq();
        const res = mockRes();
        await getAllIncome(req, res);

        expect(Income.find).toHaveBeenCalledWith({ userId: 'user1' });
        expect(res.json).toHaveBeenCalledWith(incomes);
    });

    it('TC-GAI02 – sort is called with { date: -1 }', async () => {
        const sortMock = jest.fn().mockResolvedValue([]);
        Income.find.mockReturnValue({ sort: sortMock });
        const req = baseReq();
        const res = mockRes();
        await getAllIncome(req, res);
        expect(sortMock).toHaveBeenCalledWith({ date: -1 });
    });

    it('TC-GAI03 – returns 500 on error', async () => {
        Income.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('DB fail')) });
        const req = baseReq();
        const res = mockRes();
        await getAllIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. deleteIncome
// ═══════════════════════════════════════════════════════════════════════════
describe('deleteIncome', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-DI01 – deletes by id and returns success message', async () => {
        Income.findByIdAndDelete.mockResolvedValue(true);
        const req = { ...baseReq(), params: { id: 'inc1' } };
        const res = mockRes();
        await deleteIncome(req, res);
        expect(Income.findByIdAndDelete).toHaveBeenCalledWith('inc1');
        expect(res.json).toHaveBeenCalledWith({ message: 'Income deleted successfully' });
    });

    it('TC-DI02 – returns 500 on error', async () => {
        Income.findByIdAndDelete.mockRejectedValue(new Error('fail'));
        const req = { ...baseReq(), params: { id: 'inc1' } };
        const res = mockRes();
        await deleteIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. updateIncome
// ═══════════════════════════════════════════════════════════════════════════
describe('updateIncome', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-UI01 – returns 400 when required fields missing', async () => {
        const req = { user: { id: 'u1' }, params: { id: 'inc1' }, body: { source: 'A' } };
        const res = mockRes();
        await updateIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-UI02 – returns 404 when income not found', async () => {
        Income.findById.mockResolvedValue(null);
        const req = { user: { id: 'u1' }, params: { id: 'inc1' }, body: { source: 'A', amount: 100, date: '2024-01-01' } };
        const res = mockRes();
        await updateIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('TC-UI03 – returns 403 when user is not the owner', async () => {
        Income.findById.mockResolvedValue({ userId: { toString: () => 'other-user' }, save: jest.fn() });
        const req = { user: { id: 'u1' }, params: { id: 'inc1' }, body: { source: 'A', amount: 100, date: '2024-01-01' } };
        const res = mockRes();
        await updateIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('TC-UI04 – updates fields and returns 200 for owner', async () => {
        const saveMock = jest.fn().mockResolvedValue(true);
        const fakeIncome = { userId: { toString: () => 'u1' }, icon: '', source: '', amount: 0, date: null, save: saveMock };
        Income.findById.mockResolvedValue(fakeIncome);

        const req = { user: { id: 'u1' }, params: { id: 'inc1' }, body: { icon: '💸', source: 'Bonus', amount: 500, date: '2024-06-01' } };
        const res = mockRes();
        await updateIncome(req, res);

        expect(fakeIncome.source).toBe('Bonus');
        expect(fakeIncome.amount).toBe(500);
        expect(saveMock).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-UI05 – returns 500 on DB error', async () => {
        Income.findById.mockRejectedValue(new Error('fail'));
        const req = { user: { id: 'u1' }, params: { id: 'inc1' }, body: { source: 'A', amount: 100, date: '2024-01-01' } };
        const res = mockRes();
        await updateIncome(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. downloadIncomeExcel
// ═══════════════════════════════════════════════════════════════════════════
describe('downloadIncomeExcel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        xlsx.utils = {
            book_new:        jest.fn().mockReturnValue({}),
            json_to_sheet:   jest.fn().mockReturnValue({}),
            book_append_sheet: jest.fn(),
        };
        xlsx.writeFile = jest.fn();
    });

    it('TC-DE01 – fetches incomes for the user sorted by date', async () => {
        const sortMock = jest.fn().mockResolvedValue([]);
        Income.find.mockReturnValue({ sort: sortMock });
        const req = baseReq();
        const res = mockRes();
        await downloadIncomeExcel(req, res);
        expect(Income.find).toHaveBeenCalledWith({ userId: 'user1' });
        expect(sortMock).toHaveBeenCalledWith({ date: -1 });
    });

    it('TC-DE02 – builds workbook and calls writeFile', async () => {
        const fakeIncome = [
            { source: 'Salary', amount: 1000, date: new Date('2024-01-01') },
        ];
        Income.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(fakeIncome) });

        const req = baseReq();
        const res = mockRes();
        await downloadIncomeExcel(req, res);

        expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith([
            { Source: 'Salary', Amount: 1000, Date: fakeIncome[0].date }
        ]);
        expect(xlsx.writeFile).toHaveBeenCalled();
        expect(res.download).toHaveBeenCalled();
    });

    it('TC-DE03 – returns 500 on error', async () => {
        Income.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('fail')) });
        const req = baseReq();
        const res = mockRes();
        await downloadIncomeExcel(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. getUniqueSources
// ═══════════════════════════════════════════════════════════════════════════
describe('getUniqueSources', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GUS01 – returns sorted unique sources', async () => {
        Income.distinct.mockResolvedValue(['Freelance', 'Salary', 'Bonus']);
        const req = baseReq();
        const res = mockRes();
        await getUniqueSources(req, res);
        const result = res.json.mock.calls[0][0];
        expect(result).toEqual(['Bonus', 'Freelance', 'Salary']);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-GUS02 – filters out falsy values before sorting', async () => {
        Income.distinct.mockResolvedValue(['Salary', '', null, 'Bonus']);
        const req = baseReq();
        const res = mockRes();
        await getUniqueSources(req, res);
        const result = res.json.mock.calls[0][0];
        expect(result).not.toContain('');
        expect(result).not.toContain(null);
    });

    it('TC-GUS03 – queries with userId filter and excludes empty sources', async () => {
        Income.distinct.mockResolvedValue([]);
        const req = baseReq();
        const res = mockRes();
        await getUniqueSources(req, res);
        expect(Income.distinct).toHaveBeenCalledWith('source', expect.objectContaining({ userId: 'user1' }));
    });

    it('TC-GUS04 – returns 500 on error', async () => {
        Income.distinct.mockRejectedValue(new Error('fail'));
        const req = baseReq();
        const res = mockRes();
        await getUniqueSources(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
