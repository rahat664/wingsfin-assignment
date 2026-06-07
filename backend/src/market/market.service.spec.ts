import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InstrumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketService } from './market.service';

describe('MarketService', () => {
    let service: MarketService;
    let configValues: Record<string, string | undefined>;

    const prismaMock = {
        marketTick: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
        },
    };

    const configMock = {
        get: jest.fn((key: string) => configValues[key]),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        configValues = {
            MARKET_OPEN_TIME: '10:00',
            MARKET_CLOSE_TIME: '20:00',
            MARKET_TIMEZONE: 'Asia/Dhaka',
            DEFAULT_INDEX_SYMBOL: 'DSEX',
            DEFAULT_STOCK_SYMBOL: 'GP',
            STOCK_YESTERDAY_CLOSE: '238.88',
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MarketService,
                { provide: PrismaService, useValue: prismaMock },
                { provide: ConfigService, useValue: configMock },
            ],
        }).compile();

        service = module.get<MarketService>(MarketService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('reports market metadata from config', () => {
        jest.spyOn(service as any, 'isMarketOpen').mockReturnValue(true);

        const status = service.getMarketStatus();

        expect(status.marketOpen).toBe(true);
        expect(status.openTime).toBe('10:00');
        expect(status.closeTime).toBe('20:00');
        expect(status.timezone).toBe('Asia/Dhaka');
    });

    it('builds a forward-filled 1-minute history with latest tick per minute', async () => {
        const openDate = new Date('2026-06-03T04:00:00.000Z');
        const currentMinuteDate = new Date('2026-06-03T04:03:00.000Z');

        jest.spyOn(service as any, 'isMarketOpen').mockReturnValue(true);
        jest.spyOn(service as any, 'getSessionBounds').mockReturnValue({
            openDate,
            currentMinuteDate,
        });

        prismaMock.marketTick.findMany.mockResolvedValue([
            {
                eventTime: new Date('2026-06-03T04:01:05.000Z'),
                value: 101,
                yesterdayClose: 100,
            },
            {
                eventTime: new Date('2026-06-03T04:01:45.000Z'),
                value: 102,
                yesterdayClose: 100,
            },
            {
                eventTime: new Date('2026-06-03T04:03:00.000Z'),
                value: 103,
                yesterdayClose: 100,
            },
        ]);

        prismaMock.marketTick.findFirst.mockResolvedValue({
            value: 99,
            yesterdayClose: 100,
        });

        const history = await service.getHistory(InstrumentType.INDEX, 'DSEX');

        expect(prismaMock.marketTick.findMany).toHaveBeenCalledWith({
            where: {
                instrumentType: InstrumentType.INDEX,
                symbol: 'DSEX',
                eventTime: {
                    gte: openDate,
                    lte: currentMinuteDate,
                },
            },
            orderBy: {
                eventTime: 'asc',
            },
        });
        expect(history.marketOpen).toBe(true);
        expect(history.totalPoints).toBe(4);
        expect(history.latestValue).toBe(103);
        expect(history.yesterdayClose).toBe(100);
        expect(history.points.map((point) => point.value)).toEqual([
            99, 102, 102, 103,
        ]);
        expect(history.points.map((point) => point.status)).toEqual([
            'BELOW',
            'ABOVE',
            'ABOVE',
            'ABOVE',
        ]);
    });

    it('derives yesterday close from the payload when config is absent', async () => {
        configValues.INDEX_YESTERDAY_CLOSE = undefined;

        const expectedYesterdayClose = 5222.22 / 1.0412;

        prismaMock.marketTick.create.mockResolvedValue({
            id: 'tick-1',
            symbol: 'DSEX',
            eventTime: new Date('2026-06-03T04:00:00.000Z'),
            value: 5222.22,
            yesterdayClose: expectedYesterdayClose,
        });

        const tick = await service.ingestIndexPayload({
            index_id: 'DSEX',
            time: Date.parse('2026-06-03T04:00:00.000Z'),
            capital_value: 5222.22,
            percentage_change_from_yesterday_close_value: 4.12,
        });

        const createArg = prismaMock.marketTick.create.mock.calls[0][0];

        expect(createArg.data).toEqual(
            expect.objectContaining({
                symbol: 'DSEX',
                instrumentType: InstrumentType.INDEX,
            }),
        );
        expect(createArg.data.yesterdayClose).toBeCloseTo(
            expectedYesterdayClose,
            2,
        );
        expect(tick.status).toBe('ABOVE');
        expect(tick.yesterdayClose).toBeCloseTo(expectedYesterdayClose, 2);
    });

    it('stores stock payloads without mutation', async () => {
        prismaMock.marketTick.create.mockResolvedValue({
            id: 'tick-2',
            symbol: 'GP',
            eventTime: new Date('2026-06-03T04:00:00.000Z'),
            value: 238.79,
            yesterdayClose: 238.88,
        });

        const tick = await service.ingestStockPayload({
            trade_code: 'GP',
            time: Date.parse('2026-06-03T04:00:00.000Z'),
            close_price: 238.79,
            yesterday_close_price: 238.88,
        });

        expect(prismaMock.marketTick.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                symbol: 'GP',
                instrumentType: InstrumentType.STOCK,
                yesterdayClose: 238.88,
            }),
        });
        expect(tick.status).toBe('BELOW');
    });
});
