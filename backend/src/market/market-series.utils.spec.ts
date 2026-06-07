import {
    buildOneMinuteForwardFilledSeries,
    getPointStatus,
} from './market-series.utils';

describe('market-series utils', () => {
    it('forward-fills missing minutes while keeping the latest value for each minute', () => {
        const points = buildOneMinuteForwardFilledSeries({
            openDate: new Date('2026-06-03T10:00:00.000Z'),
            currentMinuteDate: new Date('2026-06-03T10:02:00.000Z'),
            previousTick: null,
            ticks: [
                {
                    eventTime: new Date('2026-06-03T10:00:10.000Z'),
                    value: 100,
                    yesterdayClose: 98,
                },
                {
                    eventTime: new Date('2026-06-03T10:02:20.000Z'),
                    value: 105,
                    yesterdayClose: 98,
                },
            ],
        });

        expect(points.map((point) => point.time)).toEqual([
            '2026-06-03T10:00:00.000Z',
            '2026-06-03T10:01:00.000Z',
            '2026-06-03T10:02:00.000Z',
        ]);
        expect(points.map((point) => point.value)).toEqual([100, 100, 105]);
        expect(points.map((point) => point.status)).toEqual([
            'ABOVE',
            'ABOVE',
            'ABOVE',
        ]);
        expect(points[2]?.isLatest).toBe(true);
    });

    it('uses the latest tick when multiple updates arrive in the same minute', () => {
        const points = buildOneMinuteForwardFilledSeries({
            openDate: new Date('2026-06-03T10:01:00.000Z'),
            currentMinuteDate: new Date('2026-06-03T10:01:00.000Z'),
            previousTick: null,
            ticks: [
                {
                    eventTime: new Date('2026-06-03T10:01:05.000Z'),
                    value: 100,
                    yesterdayClose: 98,
                },
                {
                    eventTime: new Date('2026-06-03T10:01:50.000Z'),
                    value: 110,
                    yesterdayClose: 98,
                },
            ],
        });

        expect(points).toHaveLength(1);
        expect(points[0]).toEqual({
            time: '2026-06-03T10:01:00.000Z',
            value: 110,
            yesterdayClose: 98,
            status: 'ABOVE',
            isLatest: true,
        });
    });

    it.each([
        ['ABOVE when value is above yesterday close', 101, 100, 'ABOVE'],
        ['BELOW when value is below yesterday close', 99, 100, 'BELOW'],
        ['EQUAL when value matches yesterday close', 100, 100, 'EQUAL'],
        ['NO_DATA when value is missing', null, 100, 'NO_DATA'],
        ['NO_DATA when yesterday close is missing', 100, null, 'NO_DATA'],
    ])('%s', (_title, value, yesterdayClose, expected) => {
        expect(getPointStatus(value, yesterdayClose)).toBe(expected);
    });
});
