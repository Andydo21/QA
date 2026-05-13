// tests/unit/calculatePriceChange.test.js
// Tests: calculateStockChange, calculateForexChange, calculateCryptoChange, calculatePriceChange

jest.mock('../../config/pg');
jest.mock('../../config/redis');

const pool  = require('../../config/pg');
const redis = require('../../config/redis');

const {
    calculateStockChange,
    calculateForexChange,
    calculateCryptoChange,
    calculatePriceChange,
    calculateCommodityChange,
} = require('../../services/calculatePriceChange');

// ═══════════════════════════════════════════════════════════════════════════
// calculateStockChange
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateStockChange', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-CS01 – returns changePercent:0 when no rows', async () => {
        // [EDGE CASE] Nếu không có dữ liệu lịch sử, trả về giá trị mặc định 0%
        // INPUT: rows = [] (không có dữ liệu)
        // EXPECTED: currentPrice = null, changePercent = 0, previousPrice = null
        pool.query.mockResolvedValue({ rows: [] });
        const result = await calculateStockChange(1, null);
        expect(result).toEqual({ currentPrice: null, changePercent: 0, previousPrice: null });
    });

    it('TC-CS02 – returns changePercent:0 when only 1 row', async () => {
        // [EDGE CASE] Nếu chỉ 1 row dữ liệu, không thể tính % thay đổi → trả về 0%
        // INPUT: 1 dòng giá = 150
        // EXPECTED: currentPrice = 150, changePercent = 0, previousPrice = 150 (cùng giá)
        pool.query.mockResolvedValue({ rows: [{ close: '150' }] });
        const result = await calculateStockChange(1, null);
        expect(result).toEqual({ currentPrice: 150, changePercent: 0, previousPrice: 150 });
    });

    it('TC-CS03 – computes correct percentage with 2 rows', async () => {
        // [CALCULATION] Tính % thay đổi giá từ dữ liệu lịch sử
        // INPUT: 2 dòng giá: close = 110 (hiện tại), close = 100 (trước)
        // FORMULA: changePercent = ((110 - 100) / 100) × 100 = 10%
        // EXPECTED: changePercent ≈ 10%, currentPrice = 110, previousPrice = 100
        pool.query.mockResolvedValue({ rows: [{ close: '110' }, { close: '100' }] });
        const result = await calculateStockChange(1, null);
        expect(result.changePercent).toBeCloseTo(10, 5);
        expect(result.currentPrice).toBe(110);
        expect(result.previousPrice).toBe(100);
    });

    it('TC-CS04 – handles negative change correctly', async () => {
        // [NEGATIVE CHANGE] Kiểm tra xử lý giá GIẢM (thay đổi âm)
        // INPUT: close = 90 (giảm từ 100)
        // FORMULA: changePercent = ((90 - 100) / 100) × 100 = -10%
        // EXPECTED: changePercent ≈ -10% (xác nhận dấu âm được tính đúng)
        pool.query.mockResolvedValue({ rows: [{ close: '90' }, { close: '100' }] });
        const result = await calculateStockChange(1, null);
        const result = await calculateStockChange(1, null);
        expect(result.changePercent).toBeCloseTo(-10, 5);
    });

    it('TC-CS05 – returns zero result on DB error (graceful)', async () => {
        pool.query.mockRejectedValue(new Error('DB fail'));
        const result = await calculateStockChange(1, null);
        expect(result).toEqual({ currentPrice: null, changePercent: 0, previousPrice: null });
    });

    //Additional edge case for caculate stock change
    it('TC-CS07 – returns safe default when DB returns non-numeric close', async () => {
    pool.query.mockResolvedValue({ rows: [{ close: 'abc' }, { close: '100' }] });
    const result = await calculateStockChange(1, null);
    expect(result).toEqual({ currentPrice: null, changePercent: 0, previousPrice: null });
    });

});

// ═══════════════════════════════════════════════════════════════════════════
// calculateForexChange
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateForexChange', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-CF01 – uses today\'s open when available', async () => {
        pool.query.mockResolvedValue({ rows: [{ open: '1.10' }] });
        const result = await calculateForexChange(1, 1.12);
        expect(result.previousPrice).toBe(1.10);
        expect(result.changePercent).toBeCloseTo(((1.12 - 1.10) / 1.10) * 100, 5);
    });

    it('TC-CF02 – falls back to most recent open on weekend/holiday', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ open: '1.08' }] });
        const result = await calculateForexChange(1, 1.10);
        expect(result.previousPrice).toBe(1.08);
    });

    it('TC-CF03 – returns changePercent:0 when no fallback data', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });
        const result = await calculateForexChange(1, 1.10);
        expect(result).toEqual({ changePercent: 0, previousPrice: 1.10 });
    });

    it('TC-CF04 – returns zero on DB error (graceful)', async () => {
        pool.query.mockRejectedValue(new Error('fail'));
        const result = await calculateForexChange(1, 1.10);
        expect(result).toEqual({ changePercent: 0, previousPrice: 1.10 });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// calculateCryptoChange
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateCryptoChange', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-CC01 – uses price from price_ticks 24h ago', async () => {
        pool.query.mockResolvedValue({ rows: [{ price: '40000' }] });
        const result = await calculateCryptoChange(1, 44000);
        expect(result.previousPrice).toBe(40000);
        expect(result.changePercent).toBeCloseTo(10, 5);
    });

    it('TC-CC02 – falls back to price_ohlcv_1h when ticks unavailable', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ close: '38000' }] });
        const result = await calculateCryptoChange(1, 40000);
        expect(result.previousPrice).toBe(38000);
    });

    it('TC-CC03 – falls back to daily OHLCV as last resort', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ close: '36000' }] });
        const result = await calculateCryptoChange(1, 40000);
        expect(result.previousPrice).toBe(36000);
    });

    it('TC-CC04 – returns changePercent:0 when all fallbacks fail', async () => {
        pool.query.mockResolvedValue({ rows: [] });
        const result = await calculateCryptoChange(1, 40000);
        expect(result).toEqual({ changePercent: 0, previousPrice: 40000 });
    });

    it('TC-CC05 – returns zero on DB error (graceful)', async () => {
        pool.query.mockRejectedValue(new Error('fail'));
        const result = await calculateCryptoChange(1, 50000);
        expect(result).toEqual({ changePercent: 0, previousPrice: 50000 });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// calculatePriceChange (dispatcher)
// ═══════════════════════════════════════════════════════════════════════════
describe('calculatePriceChange', () => {
    beforeEach(() => jest.clearAllMocks());

    it('TC-CPC01 – routes stock type through calculateStockChange path', async () => {
        pool.query.mockResolvedValue({ rows: [{ close: '150' }, { close: '140' }] });
        const result = await calculatePriceChange(1, 'AAPL', 'stock');
        expect(result).not.toBeNull();
        expect(result).toHaveProperty('changePercent');
        expect(result.positive).toBe(result.changePercent >= 0);
    });

    it('TC-CPC02 – routes index type through calculateStockChange path', async () => {
        pool.query.mockResolvedValue({ rows: [{ close: '1200' }, { close: '1000' }] });
        const result = await calculatePriceChange(1, '^VNINDEX', 'index');
        expect(result.changePercent).toBeCloseTo(20, 5);
    });

    it('TC-CPC03 – routes forex type and gets currentPrice from cache/ticks', async () => {
        redis.get.mockResolvedValue('1.10');
        pool.query.mockResolvedValue({ rows: [{ open: '1.08' }] });
        const result = await calculatePriceChange(1, 'EURUSD', 'forex');
        expect(result).not.toBeNull();
        expect(result.currentPrice).toBe(1.10);
    });

    it('TC-CPC04 – routes crypto type', async () => {
        redis.get.mockResolvedValue('44000');
        pool.query.mockResolvedValue({ rows: [{ price: '40000' }] });
        const result = await calculatePriceChange(1, 'BTCUSDT', 'crypto');
        expect(result).not.toBeNull();
        expect(result.changePercent).toBeCloseTo(10, 5);
    });

    it('TC-CPC05 – returns null when no price data for crypto/forex', async () => {
        redis.get.mockResolvedValue(null);
        pool.query.mockResolvedValue({ rows: [] });
        const result = await calculatePriceChange(1, 'EURUSD', 'forex');
        expect(result).toBeNull();
    });

    it('TC-CPC06 – returns null for stock with no data', async () => {
        pool.query.mockResolvedValue({ rows: [] });
        const result = await calculatePriceChange(1, 'AAPL', 'stock');
        expect(result).toBeNull();
    });

    it('TC-CPC07 – positive flag is true for positive change', async () => {
        pool.query.mockResolvedValue({ rows: [{ close: '110' }, { close: '100' }] });
        const result = await calculatePriceChange(1, 'AAPL', 'stock');
        expect(result.positive).toBe(true);
    });

    it('TC-CPC08 – positive flag is true for zero change', async () => {
        pool.query.mockResolvedValue({ rows: [{ close: '100' }, { close: '100' }] });
        const result = await calculatePriceChange(1, 'AAPL', 'stock');
        expect(result.positive).toBe(true);
    });

    it('TC-CPC09 – returns null on unexpected error', async () => {
        pool.query.mockRejectedValue(new Error('crash'));
        const result = await calculatePriceChange(1, 'AAPL', 'stock');
        expect(result).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// calculateCommodityChange (delegates to calculateStockChange)
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateCommodityChange', () => {
    it('TC-COMM01 – behaves identically to calculateStockChange', async () => {
        pool.query.mockResolvedValue({ rows: [{ close: '2000' }, { close: '1900' }] });
        const stockResult = await calculateStockChange(1, null);
        pool.query.mockResolvedValue({ rows: [{ close: '2000' }, { close: '1900' }] });
        const commResult = await calculateCommodityChange(1, null);
        expect(commResult).toEqual(stockResult);
    });
});
