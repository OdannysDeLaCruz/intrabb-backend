import { Injectable, BadRequestException } from '@nestjs/common';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Request, Response } from 'express';

interface CreateUserData {
  email?: string;
  phone: string;
  password?: string;
  user_metadata?: Record<string, any>;
}

interface SupabaseUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, any>;
}

@Injectable()
export class SupabaseAuthService {
  private adminClient: any;

  constructor() {
    // Crear cliente admin solo si existe la clave de servicio
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.adminClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }
  }

  createClient(request: Request, response: Response) {
    return createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return Object.keys(request.cookies).map(name => ({
              name,
              value: request.cookies[name] || '',
            }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookie(name, value, options);
            });
          },
        },
      }
    );
  }

  /**
   * Crea un usuario en Supabase sin requerir verificación OTP
   * Requiere SUPABASE_SERVICE_ROLE_KEY en variables de entorno
   */
  async createUserWithoutOtp(data: CreateUserData): Promise<SupabaseUser> {
    if (!this.adminClient) {
      throw new BadRequestException(
        'No se puede crear usuarios sin la configuración de clave de servicio de Supabase'
      );
    }

    try {
      const { data: user, error } = await this.adminClient.auth.admin.createUser({
        phone: data.phone,
        email: data.email,
        password: data.password || this.generateTemporaryPassword(),
        user_metadata: data.user_metadata || {},
        phone_confirm: false,
        email_confirm: false,
      });
console.log('SB DATA', data)
console.log('SB USER', user)
      if (error) {
        console.error('Error creando usuario en Supabase:', error);
        throw new BadRequestException(`Error al crear usuario en Supabase: ${error.message}`);
      }

      if (!user) {
        throw new BadRequestException('No se pudo crear el usuario en Supabase');
      }

      console.log('Usuario creado exitosamente en Supabase:', user.id);
      return user.user as SupabaseUser;
    } catch (error) {
      console.error('Error en createUserWithoutOtp:', error);
      throw error;
    }
  }

  /**
   * Genera una contraseña temporal aleatoria
   * Se puede cambiar posteriormente con reset de contraseña
   */
  private generateTemporaryPassword(): string {
    return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
  }

  /**
   * Obtiene un usuario de Supabase por ID
   */
  async getUserById(userId: string): Promise<SupabaseUser | null> {
    if (!this.adminClient) {
      throw new BadRequestException('Cliente admin no configurado');
    }

    try {
      const { data: { user }, error } = await this.adminClient.auth.admin.getUserById(userId);

      if (error) {
        console.error('Error obteniendo usuario:', error);
        return null;
      }

      return user as SupabaseUser || null;
    } catch (error) {
      console.error('Error en getUserById:', error);
      return null;
    }
  }

  /**
   * Actualiza metadatos de usuario en Supabase
   */
  async updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<SupabaseUser> {
    if (!this.adminClient) {
      throw new BadRequestException('Cliente admin no configurado');
    }

    try {
      const { data: { user }, error } = await this.adminClient.auth.admin.updateUserById(userId, {
        user_metadata: metadata,
      });

      if (error) {
        throw new BadRequestException(`Error al actualizar usuario: ${error.message}`);
      }

      return user as SupabaseUser;
    } catch (error) {
      console.error('Error en updateUserMetadata:', error);
      throw error;
    }
  }

  async getUser(request: Request, response: Response) {
    // Primero intentar con Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    // console.log('authHeader', authHeader);
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // console.log('token', token);
      const supabase = this.createClient(request, response);
      // console.log('supabase', supabase);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      // console.log('user', user);
      // console.log('error', error);
      if (!error && user) {
        return user;
      }
    }
    
    // Fallback a cookies para compatibilidad web
    // const supabase = this.createClient(request, response);
    // const { data: { user }, error } = await supabase.auth.getUser();
    
    // if (error || !user) {
    //   return null;
    // }
    
    // return user;
  }

  async getAccessToken(request: Request, response: Response) {
    const supabase = this.createClient(request, response);
    const { data: { session } } = await supabase.auth.getSession();
    
    return session?.access_token || null;
  }
}