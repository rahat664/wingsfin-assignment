export type MarketSessionConfig = {
    openTime: string;
    closeTime: string;
    timeZone: string;
};

type WallClockTime = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

function parseHHMM(value: string) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());

    if (!match) {
        throw new Error(`Invalid time value: ${value}`);
    }

    return {
        hour: Number(match[1]),
        minute: Number(match[2]),
    };
}

function getZonedDateParts(date: Date, timeZone: string): WallClockTime {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return {
        year: Number(lookup.year),
        month: Number(lookup.month),
        day: Number(lookup.day),
        hour: Number(lookup.hour),
        minute: Number(lookup.minute),
        second: Number(lookup.second),
    };
}

function zonedTimeToUtc(parts: WallClockTime, timeZone: string) {
    const guess = new Date(
        Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hour,
            parts.minute,
            parts.second,
            0,
        ),
    );

    const zonedParts = getZonedDateParts(guess, timeZone);
    const zonedAsUtc = Date.UTC(
        zonedParts.year,
        zonedParts.month - 1,
        zonedParts.day,
        zonedParts.hour,
        zonedParts.minute,
        zonedParts.second,
        0,
    );

    return new Date(guess.getTime() - (zonedAsUtc - guess.getTime()));
}

export function floorToMinute(date: Date) {
    const result = new Date(date);
    result.setSeconds(0, 0);
    return result;
}

export function getMarketSessionBounds(
    now: Date,
    config: MarketSessionConfig,
) {
    const currentDay = getZonedDateParts(now, config.timeZone);
    const open = parseHHMM(config.openTime);
    const close = parseHHMM(config.closeTime);

    const openDate = zonedTimeToUtc(
        {
            year: currentDay.year,
            month: currentDay.month,
            day: currentDay.day,
            hour: open.hour,
            minute: open.minute,
            second: 0,
        },
        config.timeZone,
    );

    const closeDayOffset = close.hour < open.hour ||
        (close.hour === open.hour && close.minute <= open.minute)
        ? 1
        : 0;

    const closeDate = zonedTimeToUtc(
        {
            year: currentDay.year,
            month: currentDay.month,
            day: currentDay.day + closeDayOffset,
            hour: close.hour,
            minute: close.minute,
            second: 0,
        },
        config.timeZone,
    );

    return {
        openDate,
        closeDate,
        currentMinuteDate: floorToMinute(now),
    };
}

export function isMarketOpenAt(now: Date, config: MarketSessionConfig) {
    const { openDate, closeDate } = getMarketSessionBounds(now, config);
    return now >= openDate && now <= closeDate;
}
