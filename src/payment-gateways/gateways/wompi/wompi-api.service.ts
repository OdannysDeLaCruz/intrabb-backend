import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class WompiApiService {
  private readonly logger = new Logger(WompiApiService.name);
  private readonly baseUrl: string;
  private readonly privateKey: string;
  private readonly publicKey: string;
  private acceptanceTokenCache: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('WOMPI_BASE_URL');
    this.privateKey = this.configService.get<string>('WOMPI_PRIVATE_KEY');
    this.publicKey = this.configService.get<string>('WOMPI_PUBLIC_KEY');
  }

  /**
   * Obtiene el acceptance token (con caché)
   */
  async getAcceptanceToken(): Promise<string> {
    if (this.acceptanceTokenCache) {
      return this.acceptanceTokenCache;
    }

    try {
      const url = `${this.baseUrl}/merchants/${this.publicKey}`;
      const response: AxiosResponse<any> = await firstValueFrom(this.httpService.get(url));

      this.acceptanceTokenCache =
        response.data?.data?.presigned_acceptance?.acceptance_token;

      if (!this.acceptanceTokenCache) {
        throw new Error('Failed to get acceptance token from Wompi');
      }

      this.logger.log('Acceptance token obtained and cached');
      return this.acceptanceTokenCache;
    } catch (error) {
      this.logger.error(
        `Error getting acceptance token: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Crea una transacción en Wompi
   */
  async createTransaction(payload: any): Promise<any> {
    try {
      const url = `${this.baseUrl}/transactions`;

      this.logger.debug(`Creating transaction with payload: ${JSON.stringify(payload)}`);

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            Authorization: `Bearer ${this.privateKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`Transaction created: ${response.data?.data?.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error creating transaction: ${error.message}`,
        error.response?.data || error.stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene información de una transacción
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/transactions/${transactionId}`;

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${this.privateKey}`,
          },
        }),
      );

      return response.data?.data;
    } catch (error) {
      this.logger.error(
        `Error getting transaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Anula una transacción (para reembolsos)
   */
  async voidTransaction(transactionId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/transactions/${transactionId}/void`;

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(
          url,
          {},
          {
            headers: {
              Authorization: `Bearer ${this.privateKey}`,
            },
          },
        ),
      );

      this.logger.log(`Transaction voided: ${transactionId}`);
      return response.data?.data;
    } catch (error) {
      this.logger.error(`Error voiding transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Tokeniza una tarjeta de crédito/débito
   */
  async tokenizeCard(cardData: {
    number: string;
    cvc: string;
    exp_month: string;
    exp_year: string;
    card_holder: string;
  }): Promise<any> {
    try {
      const url = `${this.baseUrl}/tokens/cards`;

      this.logger.debug('Tokenizing card');

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(url, cardData, {
          headers: {
            Authorization: `Bearer ${this.publicKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`Card tokenized successfully: ${response.data?.data?.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error tokenizing card: ${error.message}`,
        error.response?.data || error.stack,
      );
      throw error;
    }
  }
}
