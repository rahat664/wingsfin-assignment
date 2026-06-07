import { getMarketSessionBounds, isMarketOpenAt } from './market-time';

describe('market-time', () => {
    const session = {
        openTime: '09:00',
        closeTime: '17:00',
        timeZone: 'UTC',
    };

    it('treats the market as closed before the configured open time', () => {
        expect(isMarketOpenAt(new Date('2026-06-03T08:59:59.000Z'), session)).toBe(false);
    });

    it('treats the market as open during the configured session window', () => {
        expect(isMarketOpenAt(new Date('2026-06-03T12:00:00.000Z'), session)).toBe(true);
    });

    it('treats the market as closed after the configured close time', () => {
        expect(isMarketOpenAt(new Date('2026-06-03T17:00:01.000Z'), session)).toBe(false);
    });

    it('resolves open and close bounds in the configured timezone', () => {
        const bounds = getMarketSessionBounds(new Date('2026-06-03T12:34:56.000Z'), session);

        expect(bounds.openDate.toISOString()).toBe('2026-06-03T09:00:00.000Z');
        expect(bounds.closeDate.toISOString()).toBe('2026-06-03T17:00:00.000Z');
        expect(bounds.currentMinuteDate.toISOString()).toBe('2026-06-03T12:34:00.000Z');
    });
});
