import { ApiProperty } from '@nestjs/swagger';
import { InstrumentType } from '@prisma/client';

export class MarketStatusResponseDto {
    @ApiProperty({ example: true })
    marketOpen: boolean;

    @ApiProperty({ example: '2026-06-04T12:33:01.493Z' })
    now: string;

    @ApiProperty({ example: '10:00' })
    openTime: string;

    @ApiProperty({ example: '20:00' })
    closeTime: string;

    @ApiProperty({ example: 'Asia/Dhaka' })
    timezone: string;
}

export class MarketHistoryPointDto {
    @ApiProperty({ example: '2026-06-04T04:00:00.000Z' })
    time: string;

    @ApiProperty({ nullable: true, example: 5231.22 })
    value: number | null;

    @ApiProperty({ nullable: true, example: 5222.22 })
    yesterdayClose: number | null;

    @ApiProperty({ enum: ['ABOVE', 'BELOW', 'EQUAL', 'NO_DATA'] })
    status: 'ABOVE' | 'BELOW' | 'EQUAL' | 'NO_DATA';

    @ApiProperty({ example: false })
    isLatest: boolean;
}

export class MarketHistoryOpenResponseDto {
    @ApiProperty({ example: true })
    marketOpen: true;

    @ApiProperty({ enum: InstrumentType, enumName: 'InstrumentType' })
    type: InstrumentType;

    @ApiProperty({ example: 'DSEX' })
    symbol: string;

    @ApiProperty({ example: '10:00' })
    sessionOpenTime: string;

    @ApiProperty({ example: '20:00' })
    sessionCloseTime: string;

    @ApiProperty({ example: 'Asia/Dhaka' })
    sessionTimeZone: string;

    @ApiProperty({ example: '2026-06-04T04:00:00.000Z' })
    openTime: string;

    @ApiProperty({ example: '2026-06-04T04:33:00.000Z' })
    currentTime: string;

    @ApiProperty({ example: 34 })
    totalPoints: number;

    @ApiProperty({ nullable: true, example: 5231.22 })
    latestValue: number | null;

    @ApiProperty({ nullable: true, example: 5222.22 })
    yesterdayClose: number | null;

    @ApiProperty({ type: [MarketHistoryPointDto] })
    points: MarketHistoryPointDto[];
}

export class MarketHistoryClosedResponseDto {
    @ApiProperty({ example: false })
    marketOpen: false;

    @ApiProperty({
        example: 'Market is closed. Charts are available only during market hours.',
    })
    message: string;

    @ApiProperty({ type: [MarketHistoryPointDto], example: [] })
    points: MarketHistoryPointDto[];

    @ApiProperty({ example: '10:00' })
    sessionOpenTime: string;

    @ApiProperty({ example: '20:00' })
    sessionCloseTime: string;

    @ApiProperty({ example: 'Asia/Dhaka' })
    sessionTimeZone: string;
}
