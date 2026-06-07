import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstrumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
    getMarketSessionBounds,
    isMarketOpenAt,
    type MarketSessionConfig,
} from './market-time';
import {
    buildOneMinuteForwardFilledSeries,
    getPointStatus,
} from './market-series.utils';

@Injectable()
export class MarketService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    getMarketStatus(sessionConfig?: Partial<MarketSessionConfig>) {
        const marketSession = this.getMarketSessionConfig(sessionConfig);
        const now = new Date();
        const marketOpen = this.isMarketOpen(now, marketSession);

        return {
            marketOpen,
            now: now.toISOString(),
            openTime: marketSession.openTime,
            closeTime: marketSession.closeTime,
            timezone: marketSession.timeZone,
        };
    }

    async getHistory(
        type: InstrumentType,
        symbol: string,
        sessionConfig?: Partial<MarketSessionConfig>,
    ) {
        if (!Object.values(InstrumentType).includes(type)) {
            throw new BadRequestException('Invalid instrument type');
        }

        const marketSession = this.getMarketSessionConfig(sessionConfig);
        const now = new Date();

        if (!this.isMarketOpen(now, marketSession)) {
            return {
                marketOpen: false,
                message: 'Market is closed. Charts are available only during market hours.',
                points: [],
                sessionOpenTime: marketSession.openTime,
                sessionCloseTime: marketSession.closeTime,
                sessionTimeZone: marketSession.timeZone,
            };
        }

        const { openDate, currentMinuteDate } = this.getSessionBounds(
            now,
            marketSession,
        );

        const ticks = await this.prisma.marketTick.findMany({
            where: {
                instrumentType: type,
                symbol,
                eventTime: {
                    gte: openDate,
                    lte: currentMinuteDate,
                },
            },
            orderBy: {
                eventTime: 'asc',
            },
        });

        const previousTick = await this.prisma.marketTick.findFirst({
            where: {
                instrumentType: type,
                symbol,
                eventTime: {
                    lt: openDate,
                },
            },
            orderBy: {
                eventTime: 'desc',
            },
        });

        const points = this.buildOneMinuteForwardFilledSeries({
            openDate,
            currentMinuteDate,
            ticks,
            previousTick,
        });

        return {
            marketOpen: true,
            type,
            symbol,
            sessionOpenTime: marketSession.openTime,
            sessionCloseTime: marketSession.closeTime,
            sessionTimeZone: marketSession.timeZone,
            openTime: openDate.toISOString(),
            currentTime: currentMinuteDate.toISOString(),
            totalPoints: points.length,
            latestValue: points.at(-1)?.value ?? null,
            yesterdayClose: points.at(-1)?.yesterdayClose ?? null,
            points,
        };
    }

    private isMarketOpen(
        now: Date,
        marketSession: MarketSessionConfig,
    ): boolean {
        return isMarketOpenAt(now, marketSession);
    }

    private getSessionBounds(now: Date, marketSession: MarketSessionConfig) {
        const { openDate, currentMinuteDate } = getMarketSessionBounds(
            now,
            marketSession,
        );

        return {
            openDate,
            currentMinuteDate,
        };
    }

    private buildOneMinuteForwardFilledSeries(params: {
        openDate: Date;
        currentMinuteDate: Date;
        ticks: Array<{
            eventTime: Date;
            value: unknown;
            yesterdayClose: unknown;
        }>;
        previousTick:
            | {
            value: unknown;
            yesterdayClose: unknown;
        }
            | null
            | undefined;
    }) {
        return buildOneMinuteForwardFilledSeries(params);
    }

    private getPointStatus(
        value: number | null,
        yesterdayClose: number | null,
    ) {
        return getPointStatus(value, yesterdayClose);
    }

    async ingestIndexPayload(payload: {
        index_id: string;
        time: number;
        capital_value: number;
        percentage_change_from_yesterday_close_value?: number;
    }) {
        const yesterdayClose = this.resolveIndexYesterdayClose(payload);

        const tick = await this.prisma.marketTick.create({
            data: {
                symbol: payload.index_id,
                instrumentType: InstrumentType.INDEX,
                eventTime: new Date(payload.time),
                value: payload.capital_value,
                yesterdayClose,
                changePercent:
                    payload.percentage_change_from_yesterday_close_value ?? null,
                rawPayload: payload,
            },
        });

        return {
            type: 'INDEX' as const,
            symbol: tick.symbol,
            time: tick.eventTime.toISOString(),
            value: Number(tick.value),
            yesterdayClose: Number(tick.yesterdayClose),
            status: this.getPointStatus(
                Number(tick.value),
                Number(tick.yesterdayClose),
            ) as 'ABOVE' | 'BELOW' | 'EQUAL',
        };
    }

    async ingestStockPayload(payload: {
        trade_code: string;
        time: number;
        close_price: number;
        yesterday_close_price: number;
    }) {
        const tick = await this.prisma.marketTick.create({
            data: {
                symbol: payload.trade_code,
                instrumentType: InstrumentType.STOCK,
                eventTime: new Date(payload.time),
                value: payload.close_price,
                yesterdayClose: payload.yesterday_close_price,
                rawPayload: payload,
            },
        });

        return {
            type: 'STOCK' as const,
            symbol: tick.symbol,
            time: tick.eventTime.toISOString(),
            value: Number(tick.value),
            yesterdayClose: Number(tick.yesterdayClose),
            status: this.getPointStatus(
                Number(tick.value),
                Number(tick.yesterdayClose),
            ) as 'ABOVE' | 'BELOW' | 'EQUAL',
        };
    }

    isOpenNowForSimulator() {
        return this.isMarketOpen(new Date(), this.getMarketSessionConfig());
    }

    private resolveIndexYesterdayClose(payload: {
        capital_value: number;
        percentage_change_from_yesterday_close_value?: number;
    }) {
        const configuredClose = this.config.get<string>('INDEX_YESTERDAY_CLOSE');

        if (configuredClose) {
            return Number(configuredClose);
        }

        const changePercent =
            payload.percentage_change_from_yesterday_close_value;

        if (
            typeof changePercent === 'number' &&
            Number.isFinite(changePercent) &&
            changePercent !== -100
        ) {
            return payload.capital_value / (1 + changePercent / 100);
        }

        return payload.capital_value;
    }

    private getMarketSessionConfig(
        overrides?: Partial<MarketSessionConfig>,
    ): MarketSessionConfig {
        return {
            openTime:
                overrides?.openTime ??
                this.config.get<string>('MARKET_OPEN_TIME') ??
                '10:00',
            closeTime:
                overrides?.closeTime ??
                this.config.get<string>('MARKET_CLOSE_TIME') ??
                '20:00',
            timeZone:
                overrides?.timeZone ??
                this.config.get<string>('MARKET_TIMEZONE') ??
                'Asia/Dhaka',
        };
    }
}
