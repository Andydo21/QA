// tests/unit/assetsController.blackbox.fail.test.js
// Black-box fail tests for assetsController.js
// Only checks visible outputs: json responses.

jest.mock('../../config/pg');
jest.mock('../../config/redis');

const pool = require('../../config/pg');
const redis = require('../../config/redis');

const {
    searchAssets,
    getAssetBySymbol,
    getSimilarAssets,
} = require('../../controllers/assetsController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const mockReq = (query = {}, params = {}) => ({
    query,
    params,
});

describe('assetsController black-box fail cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchAssets', () => {
        it('TC-AS-F01 – database error should return visible error payload', async () => {
            pool.query.mockRejectedValue(new Error('DB down'));
            const req = mockReq({ q: 'AAPL', limit: '10' });
            const res = mockRes();

            await searchAssets(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'search failed' })
            );
        });

        it('TC-AS-F02 – invalid asset_type should still return a response object', async () => {
            pool.query.mockResolvedValue({ rows: [] });
            const req = mockReq({ q: 'AAPL', asset_type: 'invalid-type', limit: '10' });
            const res = mockRes();

            await searchAssets(req, res);

            expect(res.json).toHaveBeenCalledWith({
                query: 'AAPL',
                count: 0,
                results: [],
            });
        });
    });

    describe('getAssetBySymbol', () => {
        it('TC-GAB-F01 – missing symbol should return error payload', async () => {
            const req = mockReq({}, {});
            const res = mockRes();

            await getAssetBySymbol(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'symbol required' })
            );
        });

        it('TC-GAB-F02 – corrupted cache should return visible error payload', async () => {
            redis.get.mockResolvedValue('{ invalid json }');
            const req = mockReq({}, { symbol: 'AAPL' });
            const res = mockRes();

            await getAssetBySymbol(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'failed' })
            );
        });

        it('TC-GAB-F03 – unknown symbol should return not found payload', async () => {
            redis.get.mockResolvedValue(null);
            pool.query.mockResolvedValue({ rows: [] });
            const req = mockReq({}, { symbol: 'UNKNOWN' });
            const res = mockRes();

            await getAssetBySymbol(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'asset not found' })
            );
        });
    });

    describe('getSimilarAssets', () => {
        it('TC-GSA-F01 – unknown base asset should return not found payload', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });
            const req = mockReq({}, { symbol: 'UNKNOWN' });
            const res = mockRes();

            await getSimilarAssets(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'asset not found' })
            );
        });

        it('TC-GSA-F02 – database error should return visible error payload', async () => {
            pool.query.mockRejectedValue(new Error('DB down'));
            const req = mockReq({ limit: '10' }, { symbol: 'AAPL' });
            const res = mockRes();

            await getSimilarAssets(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'failed' })
            );
        });
    });
});
