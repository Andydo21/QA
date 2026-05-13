// tests/unit/watchlistController.blackbox.fail.test.js
// Black-box fail tests for watchlistController.js
// Only checks visible outputs: status / json.

jest.mock('../../models/Watchlist');

const Watchlist = require('../../models/Watchlist');
const {
    getWatchlist,
    addToWatchlist,
    updateStarredStatus,
    removeFromWatchlist,
} = require('../../controllers/watchlistController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const baseReq = (body = {}, params = {}) => ({
    user: { id: 'user1' },
    body,
    params,
});

describe('watchlistController black-box fail cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getWatchlist', () => {
        it('TC-WL-F01 – returns 500 when loading watchlist fails', async () => {
            Watchlist.findOne.mockRejectedValue(new Error('DB down'));
            const req = baseReq();
            const res = mockRes();

            await getWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'Failed to load watchlist' });
        });
    });

    describe('addToWatchlist', () => {
        it('TC-WL-F02 – missing symbol should return 400', async () => {
            const req = baseReq({ type: 'stock' });
            const res = mockRes();

            await addToWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Symbol and type are required' });
        });

        it('TC-WL-F03 – missing type should return 400', async () => {
            const req = baseReq({ symbol: 'AAPL' });
            const res = mockRes();

            await addToWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('TC-WL-F04 – duplicate symbol should return 409', async () => {
            const watchlist = {
                items: [{ symbol: 'AAPL', type: 'stock', starred: false }],
                save: jest.fn().mockResolvedValue(true),
            };
            Watchlist.findOne.mockResolvedValue(watchlist);

            const req = baseReq({ symbol: 'aapl', type: 'stock' });
            const res = mockRes();

            await addToWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({ message: 'Symbol already in watchlist' });
        });

        it('TC-WL-F05 – returns 500 when add fails', async () => {
            Watchlist.findOne.mockRejectedValue(new Error('fail'));
            const req = baseReq({ symbol: 'AAPL', type: 'stock' });
            const res = mockRes();

            await addToWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'Failed to add symbol' });
        });
    });

    describe('updateStarredStatus', () => {
        it('TC-WL-F06 – missing starred flag should return 400', async () => {
            const req = baseReq({ symbol: 'AAPL' });
            const res = mockRes();

            await updateStarredStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Symbol and starred flag are required' });
        });

        it('TC-WL-F07 – missing symbol should return 400', async () => {
            const req = baseReq({ starred: true });
            const res = mockRes();

            await updateStarredStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('TC-WL-F08 – unknown symbol should return 404', async () => {
            const watchlist = {
                items: [{ symbol: 'MSFT', type: 'stock', starred: false }],
                save: jest.fn().mockResolvedValue(true),
            };
            Watchlist.findOne.mockResolvedValue(watchlist);

            const req = baseReq({ symbol: 'AAPL', starred: true });
            const res = mockRes();

            await updateStarredStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Symbol not found' });
        });

        it('TC-WL-F09 – returns 500 when update fails', async () => {
            Watchlist.findOne.mockRejectedValue(new Error('DB down'));
            const req = baseReq({ symbol: 'AAPL', starred: true });
            const res = mockRes();

            await updateStarredStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'Failed to update starred status' });
        });
    });

    describe('removeFromWatchlist', () => {
        it('TC-WL-F10 – missing symbol param should return 400', async () => {
            const req = baseReq({}, {});
            const res = mockRes();

            await removeFromWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Symbol parameter is required' });
        });

        it('TC-WL-F11 – unknown symbol should return 404', async () => {
            const watchlist = {
                items: [{ symbol: 'MSFT', type: 'stock', starred: false }],
                markModified: jest.fn(),
                save: jest.fn().mockResolvedValue(true),
            };
            Watchlist.findOne.mockResolvedValue(watchlist);

            const req = baseReq({}, { symbol: 'AAPL' });
            const res = mockRes();

            await removeFromWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Symbol not found' });
        });

        it('TC-WL-F12 – returns 500 when removal fails', async () => {
            Watchlist.findOne.mockRejectedValue(new Error('DB down'));
            const req = baseReq({}, { symbol: 'AAPL' });
            const res = mockRes();

            await removeFromWatchlist(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'Failed to remove symbol' });
        });
    });
});
