// tests/unit/currencyConverter.blackbox.fail.test.js
// Black-box fail tests for currencyConverter.js
// Only checks visible outputs: return values / promise behavior.

jest.mock('axios');
jest.mock('../../config/redis');

const axios = require('axios');
const redis = require('../../config/redis');

const {
    getExchangeRate,
    convertPrice,
    convertPricesBulk,
} = require('../../services/currencyConverter');

const FALLBACK_RATE = 25000;

describe('currencyConverter black-box fail cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getExchangeRate', () => {
        it('TC-GER-F01 – invalid cached value should fall back to default rate', async () => {
            redis.get.mockResolvedValue('abc');

            const rate = await getExchangeRate();

            expect(rate).toBe(FALLBACK_RATE);
        });

        it('TC-GER-F02 – invalid API payload should fall back to default rate', async () => {
            redis.get.mockResolvedValue(null);
            axios.get.mockResolvedValue({ data: { rates: { VND: 'abc' } } });

            const rate = await getExchangeRate();

            expect(rate).toBe(FALLBACK_RATE);
        });
    });

    describe('convertPrice', () => {
        it('TC-CP-F01 – invalid numeric input should not produce NaN', async () => {
            const result = await convertPrice('not-a-number', 'NASDAQ', 25000);

            expect(result).toEqual({ price: 0, currency: 'VND', original: 0 });
        });

        it('TC-CP-F02 – zero price should be treated as invalid input', async () => {
            const result = await convertPrice(0, 'NASDAQ', 25000);

            expect(result).toEqual({ price: 0, currency: 'VND', original: 0 });
        });
    });

    describe('convertPricesBulk', () => {
        it('TC-CPB-F01 – empty input should return empty array', async () => {
            const result = await convertPricesBulk([]);

            expect(result).toEqual([]);
        });

        it('TC-CPB-F02 – malformed items should not crash the conversion', async () => {
            redis.get.mockResolvedValue('25000');

            await expect(convertPricesBulk([null, { exchange: 'NASDAQ' }])).resolves.toEqual([]);
        });
    });
});
