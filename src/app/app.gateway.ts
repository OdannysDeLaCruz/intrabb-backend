import { UseGuards } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from '../auth/guards/ws-auth.guard';
import { CacheService } from '../cache/cache.service';

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, deberías restringir esto a tu dominio
  },
})
@UseGuards(WsAuthGuard)
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly cacheService: CacheService) {}

  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    return 'Hello world!';
  }

  @SubscribeMessage('join_request_room')
  async handleJoinRequestRoom(client: Socket, payload: { requestId: number }) {
    try {
      const { requestId } = payload;
      const userId = client['user']?.id;
      
      if (!userId || !requestId) {
        client.emit('error', { message: 'Invalid request data' });
        return;
      }

      const roomName = `request-${requestId}`;
      
      // Join the client to the request room
      await client.join(roomName);
      
      // Store in Redis that this user is watching this request
      await this.cacheService.set(
        `watching_request:${requestId}:${userId}`, 
        {
          socketId: client.id,
          joinedAt: new Date().toISOString(),
          userInfo: client['user']
        },
        3600 // 1 hour expiry
      );
      
      console.log(`📺 Usuario ${userId} se unió a la sala de solicitud ${requestId}`);
      client.emit('joined_request_room', { requestId, roomName });
      
    } catch (error) {
      console.error('Error joining request room:', error);
      client.emit('error', { message: 'Failed to join request room' });
    }
  }

  @SubscribeMessage('leave_request_room')
  async handleLeaveRequestRoom(client: Socket, payload: { requestId: number }) {
    try {
      const { requestId } = payload;
      const userId = client['user']?.id;
      
      if (!userId || !requestId) {
        return;
      }

      const roomName = `request-${requestId}`;
      
      // Leave the room
      await client.leave(roomName);
      
      // Remove from Redis
      await this.cacheService.del(`watching_request:${requestId}:${userId}`);
      
      console.log(`📺 Usuario ${userId} salió de la sala de solicitud ${requestId}`);
      client.emit('left_request_room', { requestId, roomName });
      
    } catch (error) {
      console.error('Error leaving request room:', error);
    }
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      console.log('🔌 Nueva conexión WebSocket recibida:', client.id);
      
      // Validate token and set user data
      const token = client.handshake.auth.token;
      
      if (!token) {
        console.log('❌ Conexión rechazada: No token provided');
        client.disconnect();
        return;
      }
      
      console.log('🔑 Token recibido, verificando...');

      // Create Supabase client for token verification
      const { createServerClient } = await import('@supabase/ssr');
      const supabase = createServerClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        }
      );

      // Verify the token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.log('❌ Conexión rechazada: Invalid token');
        console.log('❌ Error de Supabase:', error?.message);
        client.disconnect();
        return;
      }
      
      console.log('✅ Token válido para usuario:', user.id);

      // Attach user information to the socket
      client['user'] = {
        id: user.id,
        email: user.email,
        phone: user.phone || null,
      };

      const aliadoId = client['user'].id;
      console.log(`✅ Aliado conectado: ${aliadoId}`);
      
      // Unir al aliado a su sala personal
      await client.join(`aliado-${aliadoId}`);
      
      // Almacenar en Redis que el aliado está online
      await this.cacheService.set(
        `online_aliado:${aliadoId}`, 
        {
          socketId: client.id,
          connectedAt: new Date().toISOString(),
          userInfo: client['user']
        },
        0 // Sin expiración automática
      );
      
      // Opcional: Notificar a otros servicios que el aliado está online
      console.log(`📱 Aliado ${aliadoId} registrado como online`);
    } catch (error) {
      console.log('❌ Error en handleConnection:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const aliadoId = client['user']?.id;
    if (aliadoId) {
      console.log(`❌ Aliado desconectado: ${aliadoId}`);
      
      // Salir de la sala personal
      await client.leave(`aliado-${aliadoId}`);
      
      // Remover de Redis
      await this.cacheService.del(`online_aliado:${aliadoId}`);
      
      console.log(`📱 Aliado ${aliadoId} removido de online`);
    }
  }

  // Método helper para verificar si un aliado está online
  async isAliadoOnline(aliadoId: string): Promise<boolean> {
    return await this.cacheService.exists(`online_aliado:${aliadoId}`);
  }

  // Método helper para obtener todos los aliados online
  async getOnlineAliados(): Promise<string[]> {
    const keys = await this.cacheService.keys('online_aliado:*');
    return keys.map(key => key.replace('online_aliado:', ''));
  }

  // Método para enviar notificación a un aliado específico
  async notifyAliado(aliadoId: string, event: string, data: any) {
    const isOnline = await this.isAliadoOnline(aliadoId);
    if (isOnline) {
      this.server.to(`aliado-${aliadoId}`).emit(event, data);
      console.log(`🔔 Notificación enviada a aliado ${aliadoId}: ${event}`);
      return true;
    }
    console.log(`⚠️ Aliado ${aliadoId} no está online para recibir: ${event}`);
    return false;
  }

  // Método para notificar a todos los usuarios que están viendo una solicitud específica
  async notifyRequestRoom(requestId: number, event: string, data: any) {
    const roomName = `request-${requestId}`;
    this.server.to(roomName).emit(event, data);
    console.log(`🔔 Notificación enviada a la sala de solicitud ${requestId}: ${event}`);
    return true;
  }

  // Método para obtener todos los usuarios que están viendo una solicitud
  async getWatchingUsers(requestId: number): Promise<string[]> {
    const keys = await this.cacheService.keys(`watching_request:${requestId}:*`);
    return keys.map(key => {
      const parts = key.split(':');
      return parts[parts.length - 1]; // Return user ID
    });
  }

  // Método específico para notificar nueva cotización
  async notifyNewQuotation(requestId: number, quotationData: any) {
    return this.notifyRequestRoom(requestId, 'nueva_cotizacion', quotationData);
  }

  // Método específico para notificar al aliado que su cotización fue aceptada
  async notifyQuotationAcceptedToIntrabbler(intrabberId: string, notificationData: any) {
    return this.notifyAliado(intrabberId, 'cotizacion_aceptada', notificationData);
  }

  // Método de prueba para verificar conectividad
  async testNotification(intrabberId: string) {
    const testData = {
      message: 'Esta es una notificación de prueba',
      timestamp: new Date().toISOString(),
    };
    return this.notifyAliado(intrabberId, 'test_notification', testData);
  }

}
