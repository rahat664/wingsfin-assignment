import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketGateway } from './market.gateway';
import { MarketService } from './market.service';

@Injectable()
export class MarketSimulatorService implements OnModuleInit, OnModuleDestroy {
    private stopped = false;

    private currentIndexValue: number;
    private currentStockValue: number;

    constructor(
        private readonly config: ConfigService,
        private readonly marketService: MarketService,
        private readonly marketGateway: MarketGateway,
    ) {
        this.currentIndexValue = Number(
            this.config.get<string>('INDEX_YESTERDAY_CLOSE') ?? 5222.22,
        );

        this.currentStockValue = Number(
            this.config.get<string>('STOCK_YESTERDAY_CLOSE') ?? 238.88,
        );
    }

    onModuleInit() {
        const enabled =
            this.config.get<string>('MARKET_SIMULATOR_ENABLED') === 'true';

        if (!enabled) {
            console.log('Market simulator disabled.');
            return;
        }

        console.log('Market simulator enabled.');
        this.scheduleNextIndexUpdate();
        this.scheduleNextStockUpdate();
    }

    onModuleDestroy() {
        this.stopped = true;
    }

    private scheduleNextIndexUpdate() {
        if (this.stopped) return;

        const delay = this.getRandomDelay();

        setTimeout(async () => {
            try {
                if (this.marketService.isOpenNowForSimulator()) {
                    await this.generateIndexUpdate();
                }
            } catch (error) {
                console.error('Index simulator error:', error);
            }

            this.scheduleNextIndexUpdate();
        }, delay);
    }

    private scheduleNextStockUpdate() {
        if (this.stopped) return;

        const delay = this.getRandomDelay();

        setTimeout(async () => {
            try {
                if (this.marketService.isOpenNowForSimulator()) {
                    await this.generateStockUpdate();
                }
            } catch (error) {
                console.error('Stock simulator error:', error);
            }

            this.scheduleNextStockUpdate();
        }, delay);
    }

    private async generateIndexUpdate() {
        const symbol = this.config.get<string>('DEFAULT_INDEX_SYMBOL') ?? 'DSEX';
        const yesterdayClose = Number(
            this.config.get<string>('INDEX_YESTERDAY_CLOSE') ?? 5222.22,
        );

        this.currentIndexValue = this.moveWithinRange({
            current: this.currentIndexValue,
            center: yesterdayClose,
            minOffset: -100,
            maxOffset: 100,
            step: 12,
        });

        const percentageChange =
            ((this.currentIndexValue - yesterdayClose) / yesterdayClose) * 100;

        const event = await this.marketService.ingestIndexPayload({
            index_id: symbol,
            time: Date.now(),
            capital_value: Number(this.currentIndexValue.toFixed(4)),
            percentage_change_from_yesterday_close_value: Number(
                percentageChange.toFixed(4),
            ),
        });

        this.marketGateway.emitTick(event);
    }

    private async generateStockUpdate() {
        const symbol = this.config.get<string>('DEFAULT_STOCK_SYMBOL') ?? 'GP';
        const yesterdayClose = Number(
            this.config.get<string>('STOCK_YESTERDAY_CLOSE') ?? 238.88,
        );

        this.currentStockValue = this.moveWithinRange({
            current: this.currentStockValue,
            center: yesterdayClose,
            minOffset: -1,
            maxOffset: 1,
            step: 0.18,
        });

        const event = await this.marketService.ingestStockPayload({
            trade_code: symbol,
            time: Date.now(),
            close_price: Number(this.currentStockValue.toFixed(4)),
            yesterday_close_price: yesterdayClose,
        });

        this.marketGateway.emitTick(event);
    }

    private getRandomDelay() {
        const maxDelay = Number(
            this.config.get<string>('SIMULATOR_MAX_INTERVAL_MS') ?? 3000,
        );

        const minDelay = 400;

        return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    }

    private moveWithinRange(params: {
        current: number;
        center: number;
        minOffset: number;
        maxOffset: number;
        step: number;
    }) {
        const { current, center, minOffset, maxOffset, step } = params;

        const min = center + minOffset;
        const max = center + maxOffset;

        const movement = (Math.random() * 2 - 1) * step;
        let next = current + movement;

        if (next < min) {
            next = min + Math.random() * step;
        }

        if (next > max) {
            next = max - Math.random() * step;
        }

        return next;
    }
}