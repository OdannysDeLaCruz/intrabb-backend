import { CanActivate, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import { createServerClient } from '@supabase/ssr';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(
    context: any,
  ): boolean | any | Promise<boolean | any> | Observable<boolean | any> {
    const client: Socket = context.switchToWs().getClient();
    return this.validateClient(client);
  }

  private async validateClient(client: Socket): Promise<boolean> {
    try {
      const token = client.handshake.auth.token;
      
      if (!token) {
        throw new WsException('No token provided');
      }

      // Create Supabase client for token verification
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
        throw new WsException('Invalid token');
      }

      // Attach user information to the socket for later use
      client['user'] = {
        id: user.id,
        email: user.email,
        phone: user.phone || null,
      };

      return true;
    } catch (error) {
      // Optionally disconnect the client
      client.disconnect();
      throw new WsException('Unauthorized');
    }
  }
}