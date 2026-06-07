import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketGateway } from './market.gateway';
import { MarketSimulatorService } from './market-simulator.service';
import { MarketService } from './market.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, MarketGateway, MarketSimulatorService],
  exports: [MarketService],
})
export class MarketModule {}
