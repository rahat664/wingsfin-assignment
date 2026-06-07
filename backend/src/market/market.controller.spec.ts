import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InstrumentType } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

describe('MarketController (HTTP)', () => {
    let app: INestApplication;
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
            MARKET_TIMEZONE: 'UTC',
        };

        const moduleRef: TestingModule = await Test.createTestingModule({
            controllers: [MarketController],
            providers: [
                MarketService,
                { provide: PrismaService, useValue: prismaMock },
                { provide: ConfigService, useValue: configMock },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        service = moduleRef.get(MarketService);
        await app.init();
    });

    afterEach(async () => {
        await app?.close();
    });

    it('GET /market/history returns a continuous 1-minute series with summary fields', async () => {
        const openDate = new Date('2026-06-03T10:00:00.000Z');
        const currentMinuteDate = new Date('2026-06-03T10:02:00.000Z');

        jest.spyOn(service as any, 'isMarketOpen').mockReturnValue(true);
        jest.spyOn(service as any, 'getSessionBounds').mockReturnValue({
            openDate,
            currentMinuteDate,
        });

        prismaMock.marketTick.findMany.mockResolvedValue([
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
        ]);
        prismaMock.marketTick.findFirst.mockResolvedValue(null);

        const response = await request(app.getHttpServer())
            .get('/market/history')
            .query({
                type: InstrumentType.INDEX,
                symbol: 'DSEX',
            })
            .expect(200);

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
        expect(response.body).toEqual(
            expect.objectContaining({
                marketOpen: true,
                latestValue: 105,
                yesterdayClose: 98,
            }),
        );
        expect(response.body.points).toHaveLength(3);
        expect(response.body.points.map((point: { time: string }) => point.time)).toEqual([
            '2026-06-03T10:00:00.000Z',
            '2026-06-03T10:01:00.000Z',
            '2026-06-03T10:02:00.000Z',
        ]);
        expect(response.body.points.map((point: { value: number | null }) => point.value)).toEqual([
            100,
            100,
            105,
        ]);
        expect(response.body.points.every((point: { time: string }) => Boolean(point.time))).toBe(
            true,
        );
    });
});
