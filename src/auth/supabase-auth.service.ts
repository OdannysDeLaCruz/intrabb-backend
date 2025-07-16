import { Injectable } from '@nestjs/common';
import { createServerClient } from '@supabase/ssr';
import { Request, Response } from 'express';

@Injectable()
export class SupabaseAuthService {
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

  async getUser(request: Request, response: Response) {
    const supabase = this.createClient(request, response);
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user;
  }

  async getAccessToken(request: Request, response: Response) {
    const supabase = this.createClient(request, response);
    const { data: { session } } = await supabase.auth.getSession();
    
    return session?.access_token || null;
  }
}