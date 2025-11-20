import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentStatus, VerificationChannel } from '@prisma/client';

interface CreateVerifiableDocumentDto {
  userId: string;
  documentTypeName: string;
  documentUrl: string;
  status: string;
  verificationChannel: string;
  diditSessionId: string;
}

@Injectable()
export class VerifiableDocumentsService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string, documentType?: string) {
    // Primero obtenemos el perfil de intrabbler del usuario
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: userId },
    });

    if (!intrabblerProfile) {
      return [];
    }

    const whereClause: any = {
      intrabbler_profile_id: intrabblerProfile.id,
    };

    // Si se especifica un tipo de documento, filtramos por él
    if (documentType) {
      const docType = await this.prisma.documentType.findFirst({
        where: { name: documentType },
      });
console.log('DOC TYPE', docType);
      if (!docType) {
        return [];
      }

      whereClause.document_type_id = docType.id;
    }
console.log('WHERE CLAUSE', whereClause);
    return this.prisma.verifiableDocument.findMany({
      where: whereClause,
      include: {
        document_type: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        intrabbler_profile: {
          select: {
            id: true,
            user_id: true,
            profession: true,
          },
        },
        reviewed_by: {
          select: {
            id: true,
            name: true,
            lastname: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findById(id: number) {
    return this.prisma.verifiableDocument.findUnique({
      where: { id },
      include: {
        document_type: true,
        intrabbler_profile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastname: true,
                email: true,
                phone_number: true,
              },
            },
          },
        },
        reviewed_by: {
          select: {
            id: true,
            name: true,
            lastname: true,
            email: true,
          },
        },
      },
    });
  }

  async updateVerificationChannel(
    id: number,
    channel: VerificationChannel,
    sessionId?: string,
  ) {
    return this.prisma.verifiableDocument.update({
      where: { id },
      data: {
        verification_channel: channel,
        didit_session_id: sessionId,
        updated_at: new Date(),
      },
    });
  }

  async updateStatus(
    id: number,
    status: DocumentStatus,
    reviewedById: string,
    rejectionReason?: string,
  ) {
    return this.prisma.verifiableDocument.update({
      where: { id },
      data: {
        status,
        reviewed_by_id: reviewedById,
        reviewed_at: new Date(),
        rejection_reason: rejectionReason,
        updated_at: new Date(),
      },
    });
  }

  async findByDiditSessionId(sessionId: string) {
    return this.prisma.verifiableDocument.findFirst({
      where: { didit_session_id: sessionId },
      include: {
        document_type: true,
        intrabbler_profile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastname: true,
                email: true,
                phone_number: true,
              },
            },
          },
        },
      },
    });
  }

  async findUserById(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastname: true,
        email: true,
        phone_number: true,
      },
    });
  }

  async updateUserPhotoUrl(userId: string, photoUrl: string) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { photo_url: photoUrl },
    });
  }

  async createVerifiableDocument(data: CreateVerifiableDocumentDto) {
    // Obtener el perfil de intrabbler (debe existir)
    const intrabblerProfile = await this.prisma.intrabblerProfile.findUnique({
      where: { user_id: data.userId },
    });

    if (!intrabblerProfile) {
      throw new Error(`IntrabblerProfile not found for user ${data.userId}`);
    }

    // Obtener el tipo de documento
    const documentType = await this.prisma.documentType.findFirst({
      where: { name: data.documentTypeName },
    });

    if (!documentType) {
      throw new Error(`Document type '${data.documentTypeName}' not found`);
    }

    // Verificar si ya existe un documento de este tipo para este perfil
    const existingDocument = await this.prisma.verifiableDocument.findFirst({
      where: {
        intrabbler_profile_id: intrabblerProfile.id,
        document_type_id: documentType.id,
      },
    });

    if (existingDocument) {
      // Actualizar documento existente
      return this.prisma.verifiableDocument.update({
        where: { id: existingDocument.id },
        data: {
          document_url: data.documentUrl,
          status: data.status as DocumentStatus,
          verification_channel: data.verificationChannel as VerificationChannel,
          didit_session_id: data.diditSessionId,
          submitted_at: new Date(),
          updated_at: new Date(),
        },
      });
    } else {
      // Crear nuevo documento
      return this.prisma.verifiableDocument.create({
        data: {
          intrabbler_profile_id: intrabblerProfile.id,
          document_type_id: documentType.id,
          document_url: data.documentUrl,
          status: data.status as DocumentStatus,
          verification_channel: data.verificationChannel as VerificationChannel,
          didit_session_id: data.diditSessionId,
          reviewed_by_id: data.userId,
          submitted_at: new Date(),
        },
      });
    }
  }
}