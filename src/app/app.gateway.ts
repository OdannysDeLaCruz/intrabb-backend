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

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      // Validate token and set user data
      const token = client.handshake.auth.token;
      
      if (!token) {
        console.log('❌ Conexión rechazada: No token provided');
        client.disconnect();
        return;
      }

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
        client.disconnect();
        return;
      }

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

}
