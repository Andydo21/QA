// tests/unit/dashboardController.test.js

jest.mock('../../models/Income');
jest.mock('../../models/Expense');

const Income  = require('../../models/Income');
const Expense = require('../../models/Expense');
const { getDashboardData } = require('../../controllers/dashboardController');

const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };

describe('getDashboardData', () => {
    beforeEach(() => jest.clearAllMocks());

    const makeReq = () => ({ user: { id: '507f1f77bcf86cd799439011' } });

    it('TC-DD01 – returns 200 with correct totals', async () => {
        // [CALCULATION] Tính tổng thu, chi, và số dư: totalBalance = totalIncome - totalExpenses
        // INPUT: totalIncome = 5000, totalExpenses = 2000
        // FORMULA: totalBalance = 5000 - 2000 = 3000
        // STEP: 1) Gọi Income.aggregate (mock = 5000)
        //       2) Gọi Expense.aggregate (mock = 2000)
        //       3) Tính totalBalance = 5000 - 2000 = 3000
        // EXPECTED: Status 200, totalBalance = 3000, totalIncome = 5000, totalExpenses = 2000
        Income.aggregate.mockResolvedValue([{ _id: null, total: 5000 }]);
        Expense.aggregate.mockResolvedValue([{ _id: null, total: 2000 }]);

        // getDashboardData calls Income.find 3 times: last30Days, limit(10) for recentTxns
        // and Expense.find 3 times similarly
        const limitMock = jest.fn().mockResolvedValue([]);
        const sortWithLimit = { sort: jest.fn().mockReturnValue({ limit: limitMock }) };
        const sortWithoutLimit = { sort: jest.fn().mockResolvedValue([]) };

        Income.find
            .mockReturnValueOnce(sortWithoutLimit)   // last 30 days query
            .mockReturnValue(sortWithLimit);          // limit(10) query

        Expense.find
            .mockReturnValueOnce(sortWithoutLimit)   // last 30 days query
            .mockReturnValue(sortWithLimit);          // limit(10) query

        const req = makeReq();
        const res = mockRes();
        await getDashboardData(req, res);

        expect(res.json).toHaveBeenCalled();
        const payload = res.json.mock.calls[0][0];
        expect(payload.totalBalance).toBe(3000);
        expect(payload.totalIncome).toBe(5000);
        expect(payload.totalExpenses).toBe(2000);
    });

    it('TC-DD02 – uses 0 when no income/expense aggregates', async () => {
        // [EDGE CASE] Nếu không có dữ liệu thu hoặc chi, mặc định = 0
        // INPUT: Income.aggregate = [], Expense.aggregate = []
        // EXPECTED: totalIncome = 0, totalExpenses = 0, totalBalance = 0 (không lỗi)
        Income.aggregate.mockResolvedValue([]);
        Expense.aggregate.mockResolvedValue([]);

        const limitMock = jest.fn().mockResolvedValue([]);
        const sortWithLimit = { sort: jest.fn().mockReturnValue({ limit: limitMock }) };
        const sortWithoutLimit = { sort: jest.fn().mockResolvedValue([]) };

        Income.find
            .mockReturnValueOnce(sortWithoutLimit)
            .mockReturnValue(sortWithLimit);

        Expense.find
            .mockReturnValueOnce(sortWithoutLimit)
            .mockReturnValue(sortWithLimit);

        const res = mockRes();
        await getDashboardData(makeReq(), res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.totalBalance).toBe(0);
        expect(payload.totalIncome).toBe(0);
        expect(payload.totalExpenses).toBe(0);
    });

    it('TC-DD03 – last30DaysIncome.total is sum of last 30 days transactions', async () => {
        Income.aggregate.mockResolvedValue([{ total: 1000 }]);
        Expense.aggregate.mockResolvedValue([{ total: 500 }]);

        const inc30 = [{ amount: 300 }, { amount: 200 }];
        const exp30 = [{ amount: 100 }];
        const limitMock = jest.fn().mockResolvedValue([]);
        const sortLimitMock = jest.fn().mockReturnValue({ limit: limitMock });

        Income.find
            .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(inc30) })  // last30Days query
            .mockReturnValue({ sort: sortLimitMock });                          // limit(10) query
        Expense.find
            .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(exp30) })
            .mockReturnValue({ sort: sortLimitMock });

        const res = mockRes();
        await getDashboardData(makeReq(), res);
        const payload = res.json.mock.calls[0][0];
        expect(payload.last30DaysIncome.total).toBe(500);
        expect(payload.last30DaysExpenses.total).toBe(100);
    });

    it('TC-DD04 – recentTransactions sorted latest first', async () => {
        Income.aggregate.mockResolvedValue([]);
        Expense.aggregate.mockResolvedValue([]);

        const now = new Date();
        const earlier = new Date(now.getTime() - 1000);
        const incTxns = [{ toObject: () => ({ date: now, amount: 10 }) }];
        const expTxns = [{ toObject: () => ({ date: earlier, amount: 5 }) }];

        Income.find
            .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue([]) })
            .mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(incTxns) }) });
        Expense.find
            .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue([]) })
            .mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(expTxns) }) });

        const res = mockRes();
        await getDashboardData(makeReq(), res);
        const txns = res.json.mock.calls[0][0].recentTransactions;
        expect(txns[0].date.getTime()).toBeGreaterThanOrEqual(txns[1].date.getTime());
    });

    it('TC-DD05 – returns 500 on DB error', async () => {
        Income.aggregate.mockRejectedValue(new Error('DB fail'));
        const res = mockRes();
        await getDashboardData(makeReq(), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
