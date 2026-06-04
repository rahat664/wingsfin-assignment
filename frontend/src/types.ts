export type InstrumentType = 'INDEX' | 'STOCK';

export type PointStatus = 'ABOVE' | 'BELOW' | 'EQUAL' | 'NO_DATA';

export type ChartPoint = {
    time: string;
    value: number | null;
    yesterdayClose: number | null;
    status: PointStatus;
    isLatest: boolean;
    isFuture?: boolean;
};

export type HistoryResponse = {
    marketOpen: boolean;
    message?: string;
    type?: InstrumentType;
    symbol?: string;
    openTime?: string;
    currentTime?: string;
    totalPoints?: number;
    latestValue?: number | null;
    yesterdayClose?: number | null;
    points: ChartPoint[];
};

export type LiveTickEvent = {
    type: InstrumentType;
    symbol: string;
    time: string;
    value: number;
    yesterdayClose: number;
    status: Exclude<PointStatus, 'NO_DATA'>;
};

export type ChartSelection = {
    label: string;
    type: InstrumentType;
    symbol: string;
};

export type MarketSessionConfig = {
    openTime: string;
    closeTime: string;
    timeZone: string;
};

export type MarketStatusResponse = {
    marketOpen: boolean;
    now: string;
    openTime: string;
    closeTime: string;
    timezone: string;
};
