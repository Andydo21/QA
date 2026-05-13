// tests/unit/watchlistController.test.js
// Tests: sortItems, getWatchlist, addToWatchlist, updateStarredStatus, removeFromWatchlist

jest.mock('../../models/Watchlist');

const Watchlist = require('../../models/Watchlist');
const {
    getWatchlist,
    addToWatchlist,
    updateStarredStatus,
    removeFromWatchlist,
} = require('../../controllers/watchlistController');

const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const baseReq = (body = {}, params = {}) => ({ user: { id: 'u1' }, body, params });

// ─── helper: build a fake watchlist doc ───────────────────────────────────
const fakeWatchlist = (items = []) => ({
    items,
    save: jest.fn().mockResolvedValue(true),
    markModified: jest.fn(),
});

// ═══════════════════════════════════════════════════════════════════════════
// sortItems (helper) – tested indirectly via getWatchlist
// ═══════════════════════════════════════════════════════════════════════════
describe('sortItems (helper)', () => {
    it('TC-SI01 – starred items appear before unstarred', async () => {
        // [SORTING LOGIC] Starred items (yêu thích) phải hiển thị trước
        // INPUT: items = [AAPL (unstarred), BTC (starred)]
        // STEP: 1) getWatchlist gọi sortItems
        //       2) sortItems sắp xếp: starred=true trước, starred=false sau
        // EXPECTED: result[0] = BTC (starred), result[1] = AAPL (unstarred)
        const now = new Date();
        const items = [
            { symbol: 'AAPL', starred: false, addedAt: now },
            { symbol: 'BTC',  starred: true,  addedAt: now },
        ];
        Watchlist.findOne.mockResolvedValue(fakeWatchlist(items));
        Watchlist.create.mockResolvedValue(fakeWatchlist(items));

        const res = mockRes();
        await getWatchlist(baseReq(), res);
        const result = res.json.mock.calls[0][0].items;
        expect(result[0].starred).toBe(true);
        expect(result[1].starred).toBe(false);
    });

    it('TC-SI02 – among same starred flag, older addedAt comes first', async () => {
        // [SECONDARY SORT] Khi starred flag giống nhau, sắp xếp theo ngày thêm (cũ trước)
        // INPUT: items = [B (newer), A (older)], cả 2 unstarred
        // STEP: 1) Sắp xếp theo starred (ngang nhau)
        //       2) Trong unstarred, sắp xếp theo addedAt: 2024-01-01 < 2024-06-01
        // EXPECTED: result[0] = A (2024-01-01), result[1] = B (2024-06-01)
        const older = new Date('2024-01-01');
        const newer = new Date('2024-06-01');
        const items = [
            { symbol: 'B', starred: false, addedAt: newer },
            { symbol: 'A', starred: false, addedAt: older },
        ];
        Watchlist.findOne.mockResolvedValue(fakeWatchlist(items));

        const res = mockRes();
        await getWatchlist(baseReq(), res);
        const result = res.json.mock.calls[0][0].items;
        expect(result[0].symbol).toBe('A');
        expect(result[1].symbol).toBe('B');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getWatchlist
// ═══════════════════════════════════════════════════════════════════════════
describe('getWatchlist', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GW01 – returns existing watchlist items with 200', async () => {
        const items = [{ symbol: 'AAPL', type: 'stock', starred: false, addedAt: new Date() }];
        Watchlist.findOne.mockResolvedValue(fakeWatchlist(items));

        const res = mockRes();
        await getWatchlist(baseReq(), res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0]).toHaveProperty('items');
    });

    it('TC-GW02 – creates default watchlist when none exists', async () => {
        Watchlist.findOne.mockResolvedValue(null);
        const defaultDoc = fakeWatchlist([{ symbol: '^VNINDEX.VN', type: 'index', starred: false, addedAt: new Date() }]);
        Watchlist.create.mockResolvedValue(defaultDoc);

        const res = mockRes();
        await getWatchlist(baseReq(), res);
        expect(Watchlist.create).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-GW03 – returns 500 on DB error', async () => {
        Watchlist.findOne.mockRejectedValue(new Error('fail'));
        const res = mockRes();
        await getWatchlist(baseReq(), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// addToWatchlist
// ═══════════════════════════════════════════════════════════════════════════
describe('addToWatchlist', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-ATW01 – returns 400 when symbol is missing', async () => {
        const res = mockRes();
        await addToWatchlist(baseReq({ type: 'stock' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-ATW02 – returns 400 when type is missing', async () => {
        const res = mockRes();
        await addToWatchlist(baseReq({ symbol: 'AAPL' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-ATW03 – returns 409 when symbol already in watchlist', async () => {
        const wl = fakeWatchlist([{ symbol: 'AAPL', type: 'stock', starred: false, addedAt: new Date() }]);
        Watchlist.findOne.mockResolvedValue(wl);

        const res = mockRes();
        await addToWatchlist(baseReq({ symbol: 'aapl', type: 'stock' }), res);
        expect(res.status).toHaveBeenCalledWith(409);
    });

    it('TC-ATW04 – adds symbol and returns 201', async () => {
        const wl = fakeWatchlist([]);
        Watchlist.findOne.mockResolvedValue(wl);

        const res = mockRes();
        await addToWatchlist(baseReq({ symbol: 'MSFT', type: 'stock' }), res);

        expect(wl.items.length).toBe(1);
        expect(wl.items[0].symbol).toBe('MSFT');
        expect(wl.items[0].starred).toBe(true);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('TC-ATW05 – normalizes symbol to uppercase', async () => {
        const wl = fakeWatchlist([]);
        Watchlist.findOne.mockResolvedValue(wl);
        const res = mockRes();
        await addToWatchlist(baseReq({ symbol: 'msft', type: 'stock' }), res);
        expect(wl.items[0].symbol).toBe('MSFT');
    });

    it('TC-ATW06 – returns 500 on DB error', async () => {
        Watchlist.findOne.mockRejectedValue(new Error('fail'));
        const res = mockRes();
        await addToWatchlist(baseReq({ symbol: 'AAPL', type: 'stock' }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateStarredStatus
// ═══════════════════════════════════════════════════════════════════════════
describe('updateStarredStatus', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-USS01 – returns 400 when symbol missing', async () => {
        const res = mockRes();
        await updateStarredStatus(baseReq({ starred: true }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-USS02 – returns 400 when starred is not boolean', async () => {
        const res = mockRes();
        await updateStarredStatus(baseReq({ symbol: 'AAPL', starred: 'yes' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-USS03 – returns 404 when symbol not in watchlist', async () => {
        Watchlist.findOne.mockResolvedValue(fakeWatchlist([]));
        const res = mockRes();
        await updateStarredStatus(baseReq({ symbol: 'XYZ', starred: true }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('TC-USS04 – updates starred flag and returns 200', async () => {
        const item = { symbol: 'AAPL', starred: false, addedAt: new Date() };
        const wl = fakeWatchlist([item]);
        Watchlist.findOne.mockResolvedValue(wl);

        const res = mockRes();
        await updateStarredStatus(baseReq({ symbol: 'AAPL', starred: true }), res);

        expect(item.starred).toBe(true);
        expect(wl.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-USS05 – returns 500 on DB error', async () => {
        Watchlist.findOne.mockRejectedValue(new Error('fail'));
        const res = mockRes();
        await updateStarredStatus(baseReq({ symbol: 'AAPL', starred: true }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// removeFromWatchlist
// ═══════════════════════════════════════════════════════════════════════════
describe('removeFromWatchlist', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-RFW01 – returns 400 when symbol param is missing', async () => {
        const res = mockRes();
        await removeFromWatchlist({ user: { id: 'u1' }, params: { symbol: '' } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('TC-RFW02 – returns 404 when symbol not in watchlist', async () => {
        Watchlist.findOne.mockResolvedValue(fakeWatchlist([{ symbol: 'AAPL', addedAt: new Date() }]));
        const res = mockRes();
        await removeFromWatchlist({ user: { id: 'u1' }, params: { symbol: 'XYZ' } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('TC-RFW03 – removes symbol and returns 200', async () => {
        const wl = fakeWatchlist([
            { symbol: 'AAPL', starred: false, addedAt: new Date() },
            { symbol: 'MSFT', starred: false, addedAt: new Date() },
        ]);
        Watchlist.findOne.mockResolvedValue(wl);

        const res = mockRes();
        await removeFromWatchlist({ user: { id: 'u1' }, params: { symbol: 'AAPL' } }, res);

        expect(wl.items.every(i => i.symbol !== 'AAPL')).toBe(true);
        expect(wl.markModified).toHaveBeenCalledWith('items');
        expect(wl.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('TC-RFW04 – case-insensitive removal', async () => {
        const wl = fakeWatchlist([{ symbol: 'BTCUSDT', starred: false, addedAt: new Date() }]);
        Watchlist.findOne.mockResolvedValue(wl);

        const res = mockRes();
        await removeFromWatchlist({ user: { id: 'u1' }, params: { symbol: 'btcusdt' } }, res);
        expect(wl.items.length).toBe(0);
    });

    it('TC-RFW05 – returns 500 on DB error', async () => {
        Watchlist.findOne.mockRejectedValue(new Error('fail'));
        const res = mockRes();
        await removeFromWatchlist({ user: { id: 'u1' }, params: { symbol: 'AAPL' } }, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
