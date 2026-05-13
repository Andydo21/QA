// tests/unit/calculatePriceChange.blackbox.fail.test.js
// Black-box fail tests for calculatePriceChange.js
// Only checks visible return values.

jest.mock('../../config/pg');
jest.mock('../../config/redis');

const pool = require('../../config/pg');
const redis = require('../../config/redis');

const {
    getCurrentPrice,
    calculatePriceChange,
} = require('../../services/calculatePriceChange');

describe('calculatePriceChange black-box fail cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getCurrentPrice', () => {
        it('TC-GCP-F01 – invalid Redis value should not return NaN', async () => {
            redis.get.mockResolvedValue('abc');
            pool.query.mockResolvedValueOnce({ rows: [] });
            pool.query.mockResolvedValueOnce({ rows: [] });

            const price = await getCurrentPrice(1, 'AAPL');

            expect(price).toBeNull();
        });
    });

    describe('calculatePriceChange', () => {
        it('TC-CPC-F01 – unsupported asset type should return null', async () => {
            redis.get.mockResolvedValue('100');
            pool.query.mockResolvedValueOnce({ rows: [] });
            pool.query.mockResolvedValueOnce({ rows: [] });

            const result = await calculatePriceChange(1, 'AAPL', 'bond');

            expect(result).toBeNull();
        });

        it('TC-CPC-F02 – invalid current price data should return null', async () => {
            redis.get.mockResolvedValue('abc');
            pool.query.mockResolvedValueOnce({ rows: [] });
            pool.query.mockResolvedValueOnce({ rows: [] });

            const result = await calculatePriceChange(1, 'AAPL', 'crypto');

            expect(result).toBeNull();
        });
    });
});
