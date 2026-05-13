// tests/unit/assetsController.test.js
// Tests: searchAssets, getAssetBySymbol, getSimilarAssets

jest.mock('../../config/pg');
jest.mock('../../config/redis');

const pool  = require('../../config/pg');
const redis = require('../../config/redis');
const { searchAssets, getAssetBySymbol, getSimilarAssets } = require('../../controllers/assetsController');

const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };

// ─── searchAssets ─────────────────────────────────────────────────────────
describe('searchAssets', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-SA01 – returns popular assets when no query', async () => {
        // [DEFAULT BEHAVIOR] Khi search mà không có query, trả về danh sách assets phổ biến
        // INPUT: q = '', limit = 10 (không tìm kiếm, chỉ lấy danh sách mặc định)
        // EXPECTED: Trả về danh sách assets phổ biến, có count + results
        const rows = [{ id: 1, symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', asset_type: 'stock' }];
        pool.query.mockResolvedValue({ rows });

        const req = { query: { q: '', limit: '10' } };
        const res = mockRes();
        await searchAssets(req, res);

        expect(res.json).toHaveBeenCalledWith({ count: 1, results: rows });
    });

    it('TC-SA02 – filters by asset_type when provided with empty query', async () => {
        pool.query.mockResolvedValue({ rows: [] });
        const req = { query: { q: '', asset_type: 'crypto', limit: '5' } };
        const res = mockRes();
        await searchAssets(req, res);

        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toContain('asset_type');
        expect(params).toContain('crypto');
    });

    it('TC-SA03 – performs search by prefix + name LIKE for a query string', async () => {
        // [SEARCH LOGIC] Tìm kiếm assets bằng prefix (BTC) hoặc name (LIKE)
        // INPUT: q = 'btc', limit = 20
        // STEP: 1) Chuẩn hóa query thành uppercase (BTC)
        //       2) Tìm assets có symbol = BTC hoặc name LIKE %btc%
        //       3) Trả về kết quả
        // EXPECTED: Tìm thấy Bitcoin (symbol = BTC), trả về query + results
        const rows = [{ id: 2, symbol: 'BTC', name: 'Bitcoin', exchange: 'BINANCE', asset_type: 'crypto' }];
        pool.query.mockResolvedValue({ rows });

        const req = { query: { q: 'btc', limit: '20' } };
        const res = mockRes();
        await searchAssets(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.query).toBe('BTC');
        expect(payload.results[0].symbol).toBe('BTC');
    });

    it('TC-SA04 – query param is uppercased before use', async () => {
        pool.query.mockResolvedValue({ rows: [] });
        const req = { query: { q: 'apple', limit: '5' } };
        const res = mockRes();
        await searchAssets(req, res);

        const [, params] = pool.query.mock.calls[0];
        expect(params[0]).toBe('APPLE');
    });

    it('TC-SA05 – returns 500 on DB error', async () => {
        pool.query.mockRejectedValue(new Error('DB fail'));
        const req = { query: { q: 'BTC', limit: '5' } };
        const res = mockRes();
        await searchAssets(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ─── getAssetBySymbol ─────────────────────────────────────────────────────
describe('getAssetBySymbol', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GAB01 – returns cached asset with source:cache', async () => {
        const cached = { id: 1, symbol: 'AAPL', name: 'Apple' };
        redis.get.mockResolvedValue(JSON.stringify(cached));

        const req = { params: { symbol: 'aapl' } };
        const res = mockRes();
        await getAssetBySymbol(req, res);

        expect(res.json).toHaveBeenCalledWith({ ...cached, source: 'cache' });
    });

    it('TC-GAB02 – returns 404 when asset not found in DB', async () => {
        redis.get.mockResolvedValue(null);
        pool.query.mockResolvedValue({ rows: [] });

        const req = { params: { symbol: 'UNKNOWN' } };
        const res = mockRes();
        await getAssetBySymbol(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('TC-GAB03 – returns DB asset with source:db and caches it', async () => {
        redis.get.mockResolvedValue(null);
        redis.setex = jest.fn().mockResolvedValue('OK');

        const dbRow = {
            id: 1, symbol: 'AAPL', name: 'Apple', currency: 'USD',
            exchange: 'NASDAQ', asset_type: 'stock', sector: 'Tech',
            status: 'OK', metadata: {}, created_at: new Date(), last_fetched: new Date(),
        };
        pool.query.mockResolvedValue({ rows: [dbRow] });

        const req = { params: { symbol: 'AAPL' } };
        const res = mockRes();
        await getAssetBySymbol(req, res);

        expect(redis.setex).toHaveBeenCalledWith('asset:AAPL', 300, expect.any(String));
        const payload = res.json.mock.calls[0][0];
        expect(payload.source).toBe('db');
        expect(payload.symbol).toBe('AAPL');
    });

    it('TC-GAB04 – crypto assets get tradingHours "24/7"', async () => {
        redis.get.mockResolvedValue(null);
        redis.setex = jest.fn().mockResolvedValue('OK');
        const dbRow = {
            id: 2, symbol: 'BTCUSDT', name: 'Bitcoin', currency: 'USDT',
            exchange: 'BINANCE', asset_type: 'crypto', sector: null,
            status: 'OK', metadata: {}, created_at: new Date(), last_fetched: new Date(),
        };
        pool.query.mockResolvedValue({ rows: [dbRow] });

        const req = { params: { symbol: 'BTCUSDT' } };
        const res = mockRes();
        await getAssetBySymbol(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.tradingHours).toBe('24/7');
    });

    it('TC-GAB05 – returns 500 on error', async () => {
        redis.get.mockRejectedValue(new Error('Redis down'));
        const req = { params: { symbol: 'AAPL' } };
        const res = mockRes();
        await getAssetBySymbol(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ─── getSimilarAssets ─────────────────────────────────────────────────────
describe('getSimilarAssets', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GSA01 – returns 404 when base asset not found', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const req = { params: { symbol: 'UNKNOWN' }, query: {} };
        const res = mockRes();
        await getSimilarAssets(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('TC-GSA02 – returns similar assets on same exchange and type', async () => {
        const baseRow = [{ exchange: 'NASDAQ', asset_type: 'stock' }];
        const similarRows = [{ id: 2, symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', asset_type: 'stock' }];
        pool.query
            .mockResolvedValueOnce({ rows: baseRow })
            .mockResolvedValueOnce({ rows: similarRows });

        const req = { params: { symbol: 'AAPL' }, query: { limit: '5' } };
        const res = mockRes();
        await getSimilarAssets(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.symbol).toBe('AAPL');
        expect(payload.similar).toEqual(similarRows);
    });

    it('TC-GSA03 – excludes the base symbol from results query', async () => {
        const baseRow = [{ exchange: 'NASDAQ', asset_type: 'stock' }];
        pool.query
            .mockResolvedValueOnce({ rows: baseRow })
            .mockResolvedValueOnce({ rows: [] });

        const req = { params: { symbol: 'AAPL' }, query: {} };
        const res = mockRes();
        await getSimilarAssets(req, res);

        const secondCall = pool.query.mock.calls[1];
        expect(secondCall[1]).toContain('AAPL'); // symbol != $3
    });

    it('TC-GSA04 – returns 500 on DB error', async () => {
        pool.query.mockRejectedValue(new Error('fail'));
        const req = { params: { symbol: 'AAPL' }, query: {} };
        const res = mockRes();
        await getSimilarAssets(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
