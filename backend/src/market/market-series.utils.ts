import { floorToMinute } from './market-time';

export type HistoryPoint = {
    time: string;
    value: number | null;
    yesterdayClose: number | null;
    status: 'ABOVE' | 'BELOW' | 'EQUAL' | 'NO_DATA';
    isLatest: boolean;
};

type TickLike = {
    eventTime: Date;
    value: unknown;
    yesterdayClose: unknown;
};

type PreviousTickLike =
    | {
          value: unknown;
          yesterdayClose: unknown;
      }
    | null
    | undefined;

export function getPointStatus(
    value: number | null,
    yesterdayClose: number | null,
): HistoryPoint['status'] {
    if (value === null || yesterdayClose === null) return 'NO_DATA';

    if (value > yesterdayClose) return 'ABOVE';
    if (value < yesterdayClose) return 'BELOW';
    return 'EQUAL';
}

export function buildOneMinuteForwardFilledSeries(params: {
    openDate: Date;
    currentMinuteDate: Date;
    ticks: TickLike[];
    previousTick: PreviousTickLike;
}): HistoryPoint[] {
    const { openDate, currentMinuteDate, ticks, previousTick } = params;

    const latestTickByMinute = new Map<
        number,
        {
            value: number;
            yesterdayClose: number;
            eventTime: Date;
        }
    >();

    for (const tick of ticks) {
        const minute = floorToMinute(tick.eventTime).getTime();

        latestTickByMinute.set(minute, {
            value: Number(tick.value),
            yesterdayClose: Number(tick.yesterdayClose),
            eventTime: tick.eventTime,
        });
    }

    let carriedValue =
        previousTick?.value !== undefined ? Number(previousTick.value) : null;
    let carriedYesterdayClose =
        previousTick?.yesterdayClose !== undefined
            ? Number(previousTick.yesterdayClose)
            : null;

    const points: HistoryPoint[] = [];

    for (
        let cursor = new Date(openDate);
        cursor <= currentMinuteDate;
        cursor = new Date(cursor.getTime() + 60_000)
    ) {
        const minuteKey = cursor.getTime();
        const tickForMinute = latestTickByMinute.get(minuteKey);

        if (tickForMinute) {
            carriedValue = tickForMinute.value;
            carriedYesterdayClose = tickForMinute.yesterdayClose;
        }

        points.push({
            time: cursor.toISOString(),
            value: carriedValue,
            yesterdayClose: carriedYesterdayClose,
            status: getPointStatus(carriedValue, carriedYesterdayClose),
            isLatest: cursor.getTime() === currentMinuteDate.getTime(),
        });
    }

    return points;
}
