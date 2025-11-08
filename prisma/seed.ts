import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    await prisma.role.createMany({
      data: [
        {
          name: 'admin'
        },
        {
          name: 'client'
        },
        {
          name: 'intrabbler'
        }
      ]
    });
    
    await prisma.user.create({
      data: {
        id: uuidv4(),
        role_id: 1,
        name: 'admin',
        lastname: 'admin',
        phone_number: '+573000000000',
        document_number: '',
        email: 'admin@intrabb.com',
        password_hash: 'admin',
        username: 'admin',
        is_active: true,
        is_online: false,
        last_login: new Date()
      }
    });

  await prisma.documentType.createMany({
    data: [
      {
        name: 'identity_card_front_side',
        description: 'Parte frontal de la cédula de identidad'
      },
      {
        name: 'identity_card_back_side',
        description: 'Parte posterior de la cédula de identidad'
      },
      {
        name: 'selfie',
        description: 'Fotografía selfie del usuario'
      },
      {
        name: 'identity_card_full',
        description: 'Cédula de identidad completa'
      },
      {
        name: 'camara_comercio',
        description: 'Cámara de comercio'
      }
    ]
  });

  await prisma.serviceCategory.createMany({
    data: [
      {
        name: 'Servicio de limpieza',
        slug: 'servicio-de-limpieza'
      },
      {
        name: 'Servicio de plomería',
        slug: 'servicio-de-plomeria'
      },
      {
        name: 'Servicio de electricidad',
        slug: 'servicio-de-electricidad'
      },
      {
        name: 'Servicio de jardinería',
        slug: 'servicio-de-jardineria'
      },
      {
        name: 'Servicio de pintura',
        slug: 'servicio-de-pintura'
      },
      {
        name: 'Servicio de carpintería',
        slug: 'servicio-de-carpinteria'
      }
    ]
  });

  // Seed Payment Methods
  // Verificar si ya existen métodos de pago
  const existingMethods = await prisma.paymentMethod.count();

  if (existingMethods === 0) {
    await prisma.paymentMethod.createMany({
      data: [
        {
          name: 'Wallet',
          description: 'Saldo de la billetera virtual',
          code: 'WALLET',
          is_active: true,
          is_visible_in_app: false,
          url_icon: 'https://example.com/wallet-icon.png'
        },
        {
          name: 'Tarjeta de Crédito/Débito',
          description:
            'Pago con tarjeta de crédito o débito (Visa, Mastercard, AmEx)',
          code: 'CARD',
          is_active: true,
          is_visible_in_app: true,
          url_icon: 'https://example.com/card-icon.png'
        },
        {
          name: 'Nequi',
          description: 'Pago a través de la app Nequi',
          code: 'NEQUI',
          is_active: true,
          is_visible_in_app: true,
          url_icon: 'https://example.com/nequi-icon.png'
        },
        {
          name: 'PSE',
          description: 'Pago con PSE - Débito desde cuenta bancaria',
          code: 'PSE',
          is_active: true,
          is_visible_in_app: true,
          url_icon: 'https://example.com/pse-icon.png'
        },
        {
          name: 'Bancolombia Transfer',
          description: 'Pago con Botón Bancolombia',
          code: 'BANCOLOMBIA_TRANSFER',
          is_active: true,
          is_visible_in_app: true,
          url_icon: 'https://example.com/bancolombia-icon.png'
        }
      ]
    });

    console.log('✅ Payment methods seeded successfully');
  } else {
    console.log('⏭️  Payment methods already exist, skipping seed');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
