// tests/unit/expenseController.blackbox.fail.test.js
// Black-box fail tests for expenseController.js
// Only checks visible outputs: status / json / download.

jest.mock('xlsx');
jest.mock('../../models/Expense');

const xlsx = require('xlsx');
const Expense = require('../../models/Expense');

const {
    addExpense,
    deleteExpense,
    updateExpense,
    downloadExpenseExcel,
    getUniqueCategories,
} = require('../../controllers/expenseController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.download = jest.fn().mockReturnValue(res);
    return res;
};

const baseReq = (body = {}, params = {}) => ({
    user: { id: 'user1' },
    body,
    params,
});

describe('expenseController black-box fail cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addExpense', () => {
        it('TC-AE-F01 – missing category should be rejected', async () => {
            const req = baseReq({ amount: 50, date: '2024-01-01' });
            const res = mockRes();

            await addExpense(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });

        it('TC-AE-F02 – invalid date should be rejected', async () => {
            const req = baseReq({ icon: '🍔', category: 'Food', amount: 50, date: 'not-a-date' });
            const res = mockRes();

            await addExpense(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });
    });

    describe('deleteExpense', () => {
        it('TC-DE-F01 – missing id should not return success', async () => {
            Expense.findByIdAndDelete.mockResolvedValue(null);
            const req = { ...baseReq(), params: {} };
            const res = mockRes();

            await deleteExpense(req, res);

            expect(res.json).not.toHaveBeenCalledWith({ message: 'Expense deleted' });
        });

        it('TC-DE-F02 – unknown id should not return success', async () => {
            Expense.findByIdAndDelete.mockResolvedValue(null);
            const req = { ...baseReq(), params: { id: 'missing-id' } };
            const res = mockRes();

            await deleteExpense(req, res);

            expect(res.json).not.toHaveBeenCalledWith({ message: 'Expense deleted' });
        });
    });

    describe('updateExpense', () => {
        it('TC-UE-F01 – missing required fields should be rejected', async () => {
            const req = { user: { id: 'user1' }, params: { id: 'exp1' }, body: { category: 'Food' } };
            const res = mockRes();

            await updateExpense(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });

        it('TC-UE-F02 – invalid date should be rejected', async () => {
            Expense.findById.mockResolvedValue({
                userId: { toString: () => 'user1' },
                save: jest.fn().mockResolvedValue(true),
            });

            const req = {
                user: { id: 'user1' },
                params: { id: 'exp1' },
                body: { icon: '🛒', category: 'Shopping', amount: 200, date: 'invalid-date' },
            };
            const res = mockRes();

            await updateExpense(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });
    });

    describe('downloadExpenseExcel', () => {
        beforeEach(() => {
            xlsx.utils = {
                book_new: jest.fn().mockReturnValue({}),
                json_to_sheet: jest.fn().mockReturnValue({}),
                book_append_sheet: jest.fn(),
            };
            xlsx.writeFile = jest.fn();
        });

        it('TC-DEX-F01 – no expense data should not download a file', async () => {
            Expense.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
            const req = baseReq();
            const res = mockRes();

            await downloadExpenseExcel(req, res);

            expect(res.download).not.toHaveBeenCalled();
        });
    });

    describe('getUniqueCategories', () => {
        it('TC-GUC-F01 – empty result should return an empty array', async () => {
            Expense.distinct.mockResolvedValue([]);
            const req = baseReq();
            const res = mockRes();

            await getUniqueCategories(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith([]);
        });
    });
});
