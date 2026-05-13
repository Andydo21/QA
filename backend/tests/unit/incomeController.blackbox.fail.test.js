// tests/unit/incomeController.blackbox.fail.test.js
// Black-box fail tests for incomeController.js
// Only checks visible outputs: status / json / download.

jest.mock('xlsx');
jest.mock('../../models/Income');

const xlsx = require('xlsx');
const Income = require('../../models/Income');

const {
    addIncome,
    deleteIncome,
    updateIncome,
    downloadIncomeExcel,
    getUniqueSources,
} = require('../../controllers/incomeController');

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

describe('incomeController black-box fail cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addIncome', () => {
        it('TC-AI-F01 – invalid date should not be accepted', async () => {
            const req = baseReq({ source: 'Salary', amount: 100, date: 'not-a-date' });
            const res = mockRes();

            await addIncome(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });

        it('TC-AI-F02 – zero amount should not be accepted', async () => {
            const req = baseReq({ source: 'Salary', amount: 0, date: '2024-01-01' });
            const res = mockRes();

            await addIncome(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });
    });

    describe('deleteIncome', () => {
        it('TC-DI-F01 – missing id should not return success', async () => {
            Income.findByIdAndDelete.mockResolvedValue(null);
            const req = { ...baseReq(), params: {} };
            const res = mockRes();

            await deleteIncome(req, res);

            expect(res.json).not.toHaveBeenCalledWith({ message: 'Income deleted successfully' });
        });

        it('TC-DI-F02 – unknown id should not return success', async () => {
            Income.findByIdAndDelete.mockResolvedValue(null);
            const req = { ...baseReq(), params: { id: 'missing-id' } };
            const res = mockRes();

            await deleteIncome(req, res);

            expect(res.json).not.toHaveBeenCalledWith({ message: 'Income deleted successfully' });
        });
    });

    describe('updateIncome', () => {
        it('TC-UI-F01 – invalid date should not be accepted', async () => {
            Income.findById.mockResolvedValue({
                userId: { toString: () => 'user1' },
                save: jest.fn().mockResolvedValue(true),
            });

            const req = {
                user: { id: 'user1' },
                params: { id: 'inc1' },
                body: { source: 'Bonus', amount: 500, date: 'invalid-date' },
            };
            const res = mockRes();

            await updateIncome(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });

        it('TC-UI-F02 – missing source should not be accepted', async () => {
            const req = {
                user: { id: 'user1' },
                params: { id: 'inc1' },
                body: { amount: 500, date: '2024-06-01' },
            };
            const res = mockRes();

            await updateIncome(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
        });
    });

    describe('downloadIncomeExcel', () => {
        beforeEach(() => {
            xlsx.utils = {
                book_new: jest.fn().mockReturnValue({}),
                json_to_sheet: jest.fn().mockReturnValue({}),
                book_append_sheet: jest.fn(),
            };
            xlsx.writeFile = jest.fn();
        });

        it('TC-DE-F01 – no income data should not download a file', async () => {
            Income.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
            const req = baseReq();
            const res = mockRes();

            await downloadIncomeExcel(req, res);

            expect(res.download).not.toHaveBeenCalled();
        });
    });

    describe('getUniqueSources', () => {
        it('TC-GUS-F01 – empty result should return an empty array', async () => {
            Income.distinct.mockResolvedValue([]);
            const req = baseReq();
            const res = mockRes();

            await getUniqueSources(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith([]);
        });
    });
});
