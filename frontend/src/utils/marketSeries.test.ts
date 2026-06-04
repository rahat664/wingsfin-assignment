import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChartPoint, LiveTickEvent } from '../types';
import {
  extendSeriesToCurrentMinute,
  getLatestRealPoint,
  mergeLiveTick,
  padToMarketClose,
} from './marketSeries';

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function formatHHMM(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

describe('marketSeries utils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pads future minutes to market close and marks them as future points', () => {
    const start = new Date('2026-06-03T10:00:00.000Z');
    const marketCloseTime = formatHHMM(addMinutes(start, 2));

    const points: ChartPoint[] = [
      {
        time: start.toISOString(),
        value: 100,
        yesterdayClose: 99,
        status: 'ABOVE',
        isLatest: true,
      },
    ];

    const padded = padToMarketClose(points, marketCloseTime);

    expect(padded).toHaveLength(3);
    expect(padded[0]).toMatchObject({
      time: '2026-06-03T10:00:00.000Z',
      isLatest: true,
    });
    expect(padded[1]).toMatchObject({
      time: '2026-06-03T10:01:00.000Z',
      isFuture: true,
      value: null,
    });
    expect(padded[2]).toMatchObject({
      time: '2026-06-03T10:02:00.000Z',
      isFuture: true,
      value: null,
    });
  });

  it('extends the series to the current minute without introducing gaps', () => {
    vi.useFakeTimers();
    const now = new Date('2026-06-03T10:03:40.000Z');
    vi.setSystemTime(now);
    const marketCloseTime = formatHHMM(addMinutes(now, 2));

    const extended = extendSeriesToCurrentMinute(
      [
        {
          time: '2026-06-03T10:00:00.000Z',
          value: 100,
          yesterdayClose: 99,
          status: 'ABOVE',
          isLatest: true,
        },
      ],
      marketCloseTime,
    );

    expect(extended.map((point) => point.time)).toEqual([
      '2026-06-03T10:00:00.000Z',
      '2026-06-03T10:01:00.000Z',
      '2026-06-03T10:02:00.000Z',
      '2026-06-03T10:03:00.000Z',
      '2026-06-03T10:04:00.000Z',
      '2026-06-03T10:05:00.000Z',
    ]);
    expect(extended.some((point) => point.isFuture)).toBe(true);
    expect(extended.filter((point) => !point.isFuture)).toHaveLength(4);

  });

  it('keeps the latest live tick for the same minute and preserves a continuous timeline', () => {
    const seriesStart = new Date('2026-06-03T10:00:00.000Z');
    const marketCloseTime = formatHHMM(addMinutes(seriesStart, 5));

    const startPoints: ChartPoint[] = [
      {
        time: seriesStart.toISOString(),
        value: 100,
        yesterdayClose: 98,
        status: 'ABOVE',
        isLatest: false,
      },
      {
        time: new Date(seriesStart.getTime() + 60_000).toISOString(),
        value: 100,
        yesterdayClose: 98,
        status: 'ABOVE',
        isLatest: true,
      },
      {
        time: new Date(seriesStart.getTime() + 120_000).toISOString(),
        value: null,
        yesterdayClose: 98,
        status: 'NO_DATA',
        isLatest: false,
        isFuture: true,
      },
    ];

    const merged = mergeLiveTick(
      startPoints,
      {
        type: 'INDEX',
        symbol: 'DSEX',
        time: '2026-06-03T10:01:50.000Z',
        value: 110,
        yesterdayClose: 98,
        status: 'ABOVE',
      } satisfies LiveTickEvent,
      marketCloseTime,
    );

    expect(merged.map((point) => point.time)).toEqual([
      '2026-06-03T10:00:00.000Z',
      '2026-06-03T10:01:00.000Z',
      '2026-06-03T10:02:00.000Z',
      '2026-06-03T10:03:00.000Z',
      '2026-06-03T10:04:00.000Z',
      '2026-06-03T10:05:00.000Z',
    ]);
    expect(merged[1]).toMatchObject({
      value: 110,
      yesterdayClose: 98,
    });
    expect(merged.filter((point) => point.isFuture)).toHaveLength(4);
    expect(getLatestRealPoint(merged)).toMatchObject({
      time: '2026-06-03T10:01:00.000Z',
      value: 110,
    });
  });

  it('keeps the latest value when multiple ticks arrive in the same minute', () => {
    const seriesStart = new Date('2026-06-03T10:00:00.000Z');
    const marketCloseTime = formatHHMM(addMinutes(seriesStart, 5));

    const merged = mergeLiveTick(
      [
        {
          time: seriesStart.toISOString(),
          value: 100,
          yesterdayClose: 98,
          status: 'ABOVE',
          isLatest: true,
        },
      ],
      {
        type: 'INDEX',
        symbol: 'DSEX',
        time: '2026-06-03T10:00:50.000Z',
        value: 111,
        yesterdayClose: 98,
        status: 'ABOVE',
      },
      marketCloseTime,
    );

    expect(merged[0]).toMatchObject({
      value: 111,
      isLatest: true,
    });
  });
});
