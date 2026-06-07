import { Controller, Get, Query } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiExtraModels,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { InstrumentType } from '@prisma/client';
import { MarketService } from './market.service';
import {
    MarketHistoryClosedResponseDto,
    MarketHistoryOpenResponseDto,
    MarketStatusResponseDto,
} from './market.docs';

@ApiTags('market')
@ApiExtraModels(MarketStatusResponseDto, MarketHistoryOpenResponseDto, MarketHistoryClosedResponseDto)
@Controller('market')
export class MarketController {
    constructor(private readonly marketService: MarketService) {}

    @Get('status')
    @ApiOperation({
        summary: 'Get the current market session status',
        description:
            'Returns the configured open/close window and whether the current time is inside the active market session.',
    })
    @ApiQuery({ name: 'openTime', required: false, example: '10:00' })
    @ApiQuery({ name: 'closeTime', required: false, example: '20:00' })
    @ApiQuery({ name: 'timeZone', required: false, example: 'Asia/Dhaka' })
    @ApiOkResponse({ type: MarketStatusResponseDto })
    getStatus(
        @Query('openTime') openTime?: string,
        @Query('closeTime') closeTime?: string,
        @Query('timeZone') timeZone?: string,
    ) {
        return this.marketService.getMarketStatus({
            openTime,
            closeTime,
            timeZone,
        });
    }

    @Get('history')
    @ApiOperation({
        summary: 'Get market history for the active or closed session state',
        description:
            'When the market is open, returns a continuous one-minute series. When closed, returns a closed-market response with an explanatory message.',
    })
    @ApiQuery({
        name: 'type',
        required: false,
        enum: InstrumentType,
        enumName: 'InstrumentType',
        example: InstrumentType.INDEX,
    })
    @ApiQuery({ name: 'symbol', required: false, example: 'DSEX' })
    @ApiQuery({ name: 'openTime', required: false, example: '10:00' })
    @ApiQuery({ name: 'closeTime', required: false, example: '20:00' })
    @ApiQuery({ name: 'timeZone', required: false, example: 'Asia/Dhaka' })
    @ApiOkResponse({
        schema: {
            oneOf: [
                { $ref: getSchemaPath(MarketHistoryOpenResponseDto) },
                { $ref: getSchemaPath(MarketHistoryClosedResponseDto) },
            ],
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid instrument type' })
    getHistory(
        @Query('type') type: InstrumentType = InstrumentType.INDEX,
        @Query('symbol') symbol = 'DSEX',
        @Query('openTime') openTime?: string,
        @Query('closeTime') closeTime?: string,
        @Query('timeZone') timeZone?: string,
    ) {
        return this.marketService.getHistory(type, symbol, {
            openTime,
            closeTime,
            timeZone,
        });
    }
}
