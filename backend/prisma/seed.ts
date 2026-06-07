import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient, InstrumentType } from '@prisma/client';
import { getMarketSessionBounds } from '../src/market/market-time';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString,
    }),
});

const MARKET_OPEN_TIME = process.env.MARKET_OPEN_TIME ?? '10:00';
const MARKET_CLOSE_TIME = process.env.MARKET_CLOSE_TIME ?? '20:00';
const MARKET_TIMEZONE = process.env.MARKET_TIMEZONE ?? 'Asia/Dhaka';

const INDEX_SYMBOL = process.env.DEFAULT_INDEX_SYMBOL ?? 'DSEX';
const STOCK_SYMBOL = process.env.DEFAULT_STOCK_SYMBOL ?? 'GP';

const INDEX_YESTERDAY_CLOSE = Number(
    process.env.INDEX_YESTERDAY_CLOSE ?? 5222.22,
);

const STOCK_YESTERDAY_CLOSE = Number(
    process.env.STOCK_YESTERDAY_CLOSE ?? 238.88,
);

function randomBetween(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function moveWithinRange(params: {
    current: number;
    center: number;
    minOffset: number;
    maxOffset: number;
    step: number;
}) {
    const { current, center, minOffset, maxOffset, step } = params;

    const min = center + minOffset;
    const max = center + maxOffset;

    const movement = randomBetween(-step, step);
    let next = current + movement;

    if (next < min) {
        next = min + randomBetween(0, step);
    }

    if (next > max) {
        next = max - randomBetween(0, step);
    }

    return next;
}

async function seedIndexData(openDate: Date, endDate: Date) {
    let cursor = new Date(openDate);
    let currentValue = INDEX_YESTERDAY_CLOSE;

    const rows: Prisma.MarketTickCreateManyInput[] = [];

    while (cursor <= endDate) {
        currentValue = moveWithinRange({
            current: currentValue,
            center: INDEX_YESTERDAY_CLOSE,
            minOffset: -100,
            maxOffset: 100,
            step: 18,
        });

        const percentageChange =
            ((currentValue - INDEX_YESTERDAY_CLOSE) / INDEX_YESTERDAY_CLOSE) * 100;

        rows.push({
            symbol: INDEX_SYMBOL,
            instrumentType: InstrumentType.INDEX,
            eventTime: new Date(cursor),
            value: Number(currentValue.toFixed(4)),
            yesterdayClose: INDEX_YESTERDAY_CLOSE,
            changePercent: Number(percentageChange.toFixed(4)),
            rawPayload: {
                index_id: INDEX_SYMBOL,
                time: cursor.getTime(),
                capital_value: Number(currentValue.toFixed(4)),
                percentage_change_from_yesterday_close_value: Number(
                    percentageChange.toFixed(4),
                ),
            },
        });

        // Important: unequal interval, not fixed 1-minute data.
        const nextGapSeconds = Math.floor(randomBetween(8, 95));
        cursor = new Date(cursor.getTime() + nextGapSeconds * 1000);
    }

    await prisma.marketTick.createMany({
        data: rows,
    });

    console.log(`Seeded ${rows.length} irregular INDEX ticks.`);
}

async function seedStockData(openDate: Date, endDate: Date) {
    let cursor = new Date(openDate);
    let currentValue = STOCK_YESTERDAY_CLOSE;

    const rows: Prisma.MarketTickCreateManyInput[] = [];

    while (cursor <= endDate) {
        currentValue = moveWithinRange({
            current: currentValue,
            center: STOCK_YESTERDAY_CLOSE,
            minOffset: -1,
            maxOffset: 1,
            step: 0.22,
        });

        rows.push({
            symbol: STOCK_SYMBOL,
            instrumentType: InstrumentType.STOCK,
            eventTime: new Date(cursor),
            value: Number(currentValue.toFixed(4)),
            yesterdayClose: STOCK_YESTERDAY_CLOSE,
            rawPayload: {
                trade_code: STOCK_SYMBOL,
                time: cursor.getTime(),
                close_price: Number(currentValue.toFixed(4)),
                yesterday_close_price: STOCK_YESTERDAY_CLOSE,
            },
        });

        // Important: unequal interval, not fixed 1-minute data.
        const nextGapSeconds = Math.floor(randomBetween(6, 80));
        cursor = new Date(cursor.getTime() + nextGapSeconds * 1000);
    }

    await prisma.marketTick.createMany({
        data: rows,
    });

    console.log(`Seeded ${rows.length} irregular STOCK ticks.`);
}

async function main() {
    const now = new Date();
    const { openDate, closeDate } = getMarketSessionBounds(now, {
        openTime: MARKET_OPEN_TIME,
        closeTime: MARKET_CLOSE_TIME,
        timeZone: MARKET_TIMEZONE,
    });
    const endDate = now < openDate ? closeDate : now > closeDate ? closeDate : now;

    console.log('Clearing old seed data...');
    await prisma.marketTick.deleteMany({});

    console.log(`Seeding from ${openDate.toISOString()} to ${endDate.toISOString()}`);

    await seedIndexData(openDate, endDate);
    await seedStockData(openDate, endDate);

    console.log('Seed complete.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
