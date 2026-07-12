import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

const defaultOrigins = [
  'http://localhost:8080',
  'http://localhost:8082',
  'http://localhost:19006',
  'http://localhost:3001',
];

const envOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;

// Deployed Vercel frontend URLs
allowedOrigins.push('https://barlink-h6anpufjw-barlink.vercel.app');
allowedOrigins.push('https://barlink-barlink.vercel.app');

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, success?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  },
})
export class BarLinkGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BarLinkGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-bar-room')
  handleJoinBarRoom(
    @MessageBody() data: { barId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`bar:${data.barId}`);
    this.logger.log(`${client.id} joined bar room: ${data.barId}`);
    return { event: 'joined', room: `bar:${data.barId}` };
  }

  @SubscribeMessage('leave-bar-room')
  handleLeaveBarRoom(
    @MessageBody() data: { barId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`bar:${data.barId}`);
    return { event: 'left', room: `bar:${data.barId}` };
  }

  @SubscribeMessage('subscribe-entry')
  handleSubscribeEntry(
    @MessageBody() data: { entryId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`entry:${data.entryId}`);
    return { event: 'subscribed', room: `entry:${data.entryId}` };
  }

  emitQueueUpdate(barId: string, payload: any) {
    this.server.to(`bar:${barId}`).emit('queue-update', payload);
  }

  emitCapacityUpdate(barId: string, payload: any) {
    this.server.to(`bar:${barId}`).emit('capacity-update', payload);
  }

  emitPositionUpdate(entryId: string, position: number) {
    this.server.to(`entry:${entryId}`).emit('position-update', { position });
  }

  emitEvictionWarning(entryId: string) {
    this.server.to(`entry:${entryId}`).emit('eviction-warning', {
      message: 'You are next! Please arrive within 20 minutes.',
    });
  }

  emitAwayComeBack(entryId: string) {
    this.server.to(`entry:${entryId}`).emit('away-comeback', {
      message: 'Are you coming back? Reply within 5 minutes.',
    });
  }

  @SubscribeMessage('join-user-room')
  handleJoinUserRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user:${data.userId}`);
    return { event: 'joined', room: `user:${data.userId}` };
  }

  emitChatMessage(receiverId: string, message: any) {
    this.server.to(`user:${receiverId}`).emit('chat-message', message);
  }

  emitChatBlocked(userId: string, barId: string) {
    this.server.to(`user:${userId}`).emit('chat-blocked', {
      barId,
      message: 'Your chat access has been revoked — you are no longer inside the venue.',
    });
  }
}
