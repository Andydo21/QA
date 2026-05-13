// tests/unit/currencyConverter.test.js
// Tests: convertPrice, getExchangeRate, convertPricesBulk

jest.mock('axios');
jest.mock('../../config/redis');

const axios = require('axios');
const redis = require('../../config/redis');

const {
    convertPrice,
    getExchangeRate,
    convertPricesBulk,
} = require('../../services/currencyConverter');

const FALLBACK_RATE = 25000;

// ═══════════════════════════════════════════════════════════════════════════
// convertPrice
// ═══════════════════════════════════════════════════════════════════════════
describe('convertPrice', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-CP01 – returns zeros when price is 0', async () => {
        // [EDGE CASE] Nếu price = 0, trả về 0 thay vì NaN hay lỗi
        // INPUT: price = 0, exchange = 'NASDAQ'
        // EXPECTED: price = 0, currency = 'VND', original = 0
        const result = await convertPrice(0, 'NASDAQ');
        expect(result).toEqual({ price: 0, currency: 'VND', original: 0 });
    });

    it('TC-CP03 – returns price unchanged for HOSE (already VND)', async () => {
        // [BUSINESS LOGIC] HOSE là sàn VN, giá đã là VND → không convert
        // INPUT: price = 100000, exchange = 'HOSE'
        // STEP: Kiểm tra exchange === 'HOSE' → trả về giá original
        // EXPECTED: price = 100000, currency = 'VND' (không đổi)
        const result = await convertPrice(100000, 'HOSE');
        expect(result.price).toBe(100000);
        expect(result.currency).toBe('VND');
        expect(result.original).toBe(100000);
    });

    it('TC-CP04 – case-insensitive HOSE detection', async () => {
        const result = await convertPrice(50000, 'hose');
        expect(result.price).toBe(50000);
    });

    it('TC-CP05 – converts USD to VND using provided exchange rate', async () => {
        // [CONVERSION] Chuyển đổi USD → VND với tỷ giá cung cấp
        // INPUT: price = 100 USD, exchange = 'NASDAQ', rate = 25000
        // FORMULA: 100 × 25000 = 2,500,000 VND
        // EXPECTED: price = 2500000 VND, original = 100 (ghi lại giá gốc)
        const result = await convertPrice(100, 'NASDAQ', 25000);
        expect(result.price).toBe(2500000);
        expect(result.currency).toBe('VND');
        expect(result.original).toBe(100);
        expect(result.originalCurrency).toBe('USD');
        expect(result.exchangeRate).toBe(25000);
    });

    it('TC-CP06 – fetches exchange rate from cache when not provided', async () => {
        redis.get.mockResolvedValue('24500');
        const result = await convertPrice(10, 'BINANCE');
        expect(result.price).toBe(245000);
        expect(result.exchangeRate).toBe(24500);
    });

    it('TC-CP07 – uses fallback rate when cache miss and API fails', async () => {
        redis.get.mockResolvedValue(null);
        axios.get.mockRejectedValue(new Error('API down'));
        redis.setex = jest.fn();
        const result = await convertPrice(1, 'BINANCE');
        expect(result.price).toBe(FALLBACK_RATE);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getExchangeRate
// ═══════════════════════════════════════════════════════════════════════════
describe('getExchangeRate', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-GER01 – returns cached rate (cache hit)', async () => {
        redis.get.mockResolvedValue('25500');
        const rate = await getExchangeRate();
        expect(rate).toBe(25500);
    });

    it('TC-GER02 – fetches from API on cache miss and caches result', async () => {
        redis.get.mockResolvedValue(null);
        redis.setex = jest.fn().mockResolvedValue('OK');
        axios.get.mockResolvedValue({ data: { rates: { VND: 24800 } } });

        const rate = await getExchangeRate();
        expect(rate).toBe(24800);
        expect(redis.setex).toHaveBeenCalledWith('exchange_rate:USD_VND', expect.any(Number), '24800');
    });

    it('TC-GER03 – returns FALLBACK_RATE when API fails', async () => {
        redis.get.mockResolvedValue(null);
        axios.get.mockRejectedValue(new Error('timeout'));

        const rate = await getExchangeRate();
        expect(rate).toBe(FALLBACK_RATE);
    });

    it('TC-GER04 – returns FALLBACK_RATE when API returns invalid data', async () => {
        redis.get.mockResolvedValue(null);
        axios.get.mockResolvedValue({ data: {} }); // no rates.VND

        const rate = await getExchangeRate();
        expect(rate).toBe(FALLBACK_RATE);
    });

    it('TC-GER05 – returns FALLBACK_RATE on Redis error', async () => {
        redis.get.mockRejectedValue(new Error('Redis down'));
        const rate = await getExchangeRate();
        expect(rate).toBe(FALLBACK_RATE);
    });

    it('TC-GER06 – returns fallback when Redis cache contains non-numeric data', async () => {
        // [KNOWN BUG] Cache polluted bằng chuỗi không hợp lệ sẽ làm parseFloat() trả NaN
        // INPUT: redis.get = 'abc'
        // EXPECTED: Không được trả NaN, phải fallback về FALLBACK_RATE
        redis.get.mockResolvedValue('abc');

        const rate = await getExchangeRate();

        expect(rate).toBe(FALLBACK_RATE);
    });

    it('TC-GER07 – returns fallback when API returns invalid VND rate', async () => {
        // [KNOWN BUG] API trả data.rates.VND không phải số sẽ bị trả NaN
        // INPUT: rates.VND = 'abc'
        // EXPECTED: Fallback rate thay vì NaN
        redis.get.mockResolvedValue(null);
        axios.get.mockResolvedValue({ data: { rates: { VND: 'abc' } } });

        const rate = await getExchangeRate();

        expect(rate).toBe(FALLBACK_RATE);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// convertPricesBulk
// ═══════════════════════════════════════════════════════════════════════════
describe('convertPricesBulk', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-CPB01 – returns empty array for empty input', async () => {
        const result = await convertPricesBulk([]);
        expect(result).toEqual([]);
    });

    it('TC-CPB02 – returns empty array for null input', async () => {
        const result = await convertPricesBulk(null);
        expect(result).toEqual([]);
    });

    it('TC-CPB03 – fetches exchange rate once and converts all items', async () => {
        redis.get.mockResolvedValue('25000');
        const items = [
            { price: 10, exchange: 'NASDAQ' },
            { price: 5,  exchange: 'BINANCE' },
        ];
        const result = await convertPricesBulk(items);

        // rate was fetched once
        expect(redis.get).toHaveBeenCalledTimes(1);
        expect(result.length).toBe(2);
        expect(result[0].price).toBe(250000);
        expect(result[1].price).toBe(125000);
    });

    it('TC-CPB04 – HOSE items remain unchanged', async () => {
        redis.get.mockResolvedValue('25000');
        const items = [{ price: 100000, exchange: 'HOSE' }];
        const result = await convertPricesBulk(items);
        expect(result[0].price).toBe(100000);
        expect(result[0].currency).toBe('VND');
    });

    it('TC-CPB05 – preserves other fields on each item', async () => {
        redis.get.mockResolvedValue('25000');
        const items = [{ price: 1, exchange: 'NASDAQ', symbol: 'AAPL', extra: true }];
        const result = await convertPricesBulk(items);
        expect(result[0].symbol).toBe('AAPL');
        expect(result[0].extra).toBe(true);
    });

    it('TC-CPB06 – handles malformed items in bulk input', async () => {
        // [KNOWN BUG] item null / thiếu price sẽ làm item.price bị crash
        // INPUT: [null, { exchange: 'NASDAQ' }]
        // EXPECTED: Bỏ qua hoặc xử lý an toàn, không được throw
        redis.get.mockResolvedValue('25000');

        await expect(convertPricesBulk([null, { exchange: 'NASDAQ' }])).resolves.toEqual([]);
    });
});
