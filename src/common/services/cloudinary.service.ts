import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    // Configurar Cloudinary
    console.log({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    })
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Genera una signature para upload directo desde el frontend
   * Esto permite que el frontend suba directamente a Cloudinary de forma segura
   */
  generateUploadSignature(folder: string = 'service-requests'): {
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
    folder: string;
    quality: string;
    fetch_format: string;
    bytes: number;
  } {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Parámetros para el upload (solo los que van en la signature)
    const params = {
      folder: folder,
      timestamp: timestamp,
    };

    // Generar signature
    const signature = cloudinary.utils.api_sign_request(
      params,
      this.configService.get('CLOUDINARY_API_SECRET')
    );

    return {
      signature,
      timestamp,
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      folder,
      // Parámetros opcionales que NO van en la signature pero sí en el FormData
      quality: 'auto:eco',
      fetch_format: 'auto',
      bytes: 5000000,
    };
  }

  /**
   * Valida que una URL pertenezca a nuestro Cloudinary
   */
  validateCloudinaryUrl(url: string): boolean {
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    const expectedDomain = `https://res.cloudinary.com/${cloudName}/`;
    return url.startsWith(expectedDomain);
  }

  /**
   * Extrae el public_id de una URL de Cloudinary
   */
  extractPublicIdFromUrl(url: string): string | null {
    try {
      const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
      const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload/`;
      
      if (!url.startsWith(baseUrl)) {
        return null;
      }

      // Remover la base URL y obtener el public_id
      let publicId = url.replace(baseUrl, '');
      
      // Remover transformaciones si las hay (todo lo que esté entre el baseUrl y el public_id)
      const parts = publicId.split('/');
      // El public_id suele estar al final, sin extensión
      const lastPart = parts[parts.length - 1];
      const publicIdWithoutExt = lastPart.split('.')[0];
      
      // Si había folders, reconstruir el path completo
      if (parts.length > 1) {
        parts[parts.length - 1] = publicIdWithoutExt;
        return parts.join('/');
      }
      
      return publicIdWithoutExt;
    } catch (error) {
      console.error('Error extracting public_id from URL:', error);
      return null;
    }
  }

  /**
   * Elimina una imagen de Cloudinary
   */
  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
      return false;
    }
  }

  /**
   * Elimina múltiples imágenes
   */
  async deleteMultipleImages(urls: string[]): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const url of urls) {
      const publicId = this.extractPublicIdFromUrl(url);
      if (publicId) {
        const deleted = await this.deleteImage(publicId);
        results.push(deleted);
      } else {
        results.push(false);
      }
    }
    
    return results;
  }
}