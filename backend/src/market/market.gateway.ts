import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type MarketTickEvent = {
    type: 'INDEX' | 'STOCK';
    symbol: string;
    time: string;
    value: number;
    yesterdayClose: number;
    status: 'ABOVE' | 'BELOW' | 'EQUAL';
};

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class MarketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('market.subscribe')
    handleSubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: { type: 'INDEX' | 'STOCK'; symbol: string },
    ) {
        const room = this.getRoomName(body.type, body.symbol);
        client.join(room);

        return {
            event: 'market.subscribed',
            data: {
                room,
                type: body.type,
                symbol: body.symbol,
            },
        };
    }

    @SubscribeMessage('market.unsubscribe')
    handleUnsubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: { type: 'INDEX' | 'STOCK'; symbol: string },
    ) {
        const room = this.getRoomName(body.type, body.symbol);
        client.leave(room);

        return {
            event: 'market.unsubscribed',
            data: {
                room,
                type: body.type,
                symbol: body.symbol,
            },
        };
    }

    emitTick(event: MarketTickEvent) {
        const room = this.getRoomName(event.type, event.symbol);

        this.server.to(room).emit('market.tick', event);

        // Also emit globally for debugging/demo.
        this.server.emit('market.tick.all', event);
    }

    private getRoomName(type: string, symbol: string) {
        return `market:${type}:${symbol}`;
    }
}