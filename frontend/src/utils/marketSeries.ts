import type { ChartPoint, LiveTickEvent, PointStatus } from '../types';

const MARKET_CLOSE_TIME = import.meta.env.VITE_MARKET_CLOSE_TIME ?? '20:00';

export function floorToMinute(date: Date) {
    const result = new Date(date);
    result.setSeconds(0, 0);
    return result;
}

function setTimeOnSameDay(baseDate: Date, hhmm: string) {
    const [hour, minute] = hhmm.split(':').map(Number);
    const result = new Date(baseDate);
    result.setHours(hour, minute, 0, 0);
    return result;
}

function getPointStatus(
    value: number | null,
    yesterdayClose: number | null,
): PointStatus {
    if (value === null || yesterdayClose === null) return 'NO_DATA';

    if (value > yesterdayClose) return 'ABOVE';
    if (value < yesterdayClose) return 'BELOW';
    return 'EQUAL';
}

function normalizeLatest(points: ChartPoint[]) {
    let latestDataIndex = -1;

    for (let i = 0; i < points.length; i += 1) {
        if (!points[i].isFuture && points[i].value !== null) {
            latestDataIndex = i;
        }
    }

    return points.map((point, index) => ({
        ...point,
        isLatest: index === latestDataIndex,
    }));
}

function removeFuturePoints(points: ChartPoint[]) {
    return points.filter((point) => !point.isFuture);
}

export function padToMarketClose(
    points: ChartPoint[],
    marketCloseTime = MARKET_CLOSE_TIME,
) {
    if (points.length === 0) return points;

    const cleanPoints = removeFuturePoints(points);
    const pointMap = new Map(cleanPoints.map((point) => [point.time, point]));

    const firstPointDate = new Date(cleanPoints[0].time);
    const closeDate = setTimeOnSameDay(firstPointDate, marketCloseTime);

    const lastRealPoint = cleanPoints[cleanPoints.length - 1];

    const padded: ChartPoint[] = [];

    for (
        let cursor = new Date(cleanPoints[0].time);
        cursor <= closeDate;
        cursor = new Date(cursor.getTime() + 60_000)
    ) {
        const key = cursor.toISOString();
        const existing = pointMap.get(key);

        if (existing) {
            padded.push(existing);
        } else {
            padded.push({
                time: key,
                value: null,
                yesterdayClose: lastRealPoint?.yesterdayClose ?? null,
                status: 'NO_DATA',
                isLatest: false,
                isFuture: true,
            });
        }
    }

    return normalizeLatest(padded);
}

export function extendSeriesToCurrentMinute(
    points: ChartPoint[],
    marketCloseTime = MARKET_CLOSE_TIME,
) {
    const cleanPoints = removeFuturePoints(points);

    if (cleanPoints.length === 0) return points;

    const nowMinute = floorToMinute(new Date());
    const lastPoint = cleanPoints[cleanPoints.length - 1];
    let lastTime = new Date(lastPoint.time);

    const updated = [...cleanPoints];

    while (lastTime < nowMinute) {
        const nextMinute = new Date(lastTime.getTime() + 60_000);

        updated.push({
            time: nextMinute.toISOString(),
            value: lastPoint.value,
            yesterdayClose: lastPoint.yesterdayClose,
            status: getPointStatus(lastPoint.value, lastPoint.yesterdayClose),
            isLatest: false,
        });

        lastTime = nextMinute;
    }

    return padToMarketClose(normalizeLatest(updated), marketCloseTime);
}

export function mergeLiveTick(
    points: ChartPoint[],
    tick: LiveTickEvent,
    marketCloseTime = MARKET_CLOSE_TIME,
) {
    const cleanPoints = removeFuturePoints(points);
    const tickMinute = floorToMinute(new Date(tick.time)).toISOString();

    const pointMap = new Map(cleanPoints.map((point) => [point.time, point]));
    const lastPoint = cleanPoints[cleanPoints.length - 1];

    if (!lastPoint) {
        return padToMarketClose([
            {
                time: tickMinute,
                value: tick.value,
                yesterdayClose: tick.yesterdayClose,
                status: tick.status,
                isLatest: true,
            },
        ], marketCloseTime);
    }

    let cursor = new Date(lastPoint.time);

    while (cursor < new Date(tickMinute)) {
        cursor = new Date(cursor.getTime() + 60_000);

        const key = cursor.toISOString();

        if (!pointMap.has(key)) {
            pointMap.set(key, {
                time: key,
                value: lastPoint.value,
                yesterdayClose: lastPoint.yesterdayClose,
                status: getPointStatus(lastPoint.value, lastPoint.yesterdayClose),
                isLatest: false,
            });
        }
    }

    pointMap.set(tickMinute, {
        time: tickMinute,
        value: tick.value,
        yesterdayClose: tick.yesterdayClose,
        status: tick.status,
        isLatest: false,
    });

    const sorted = [...pointMap.values()].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    return padToMarketClose(normalizeLatest(sorted), marketCloseTime);
}

export function getLatestRealPoint(points: ChartPoint[]) {
    return [...points]
        .reverse()
        .find((point) => !point.isFuture && point.value !== null);
}
