import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
//   const role = await prisma.role.createMany({
//     data: [
//       {
//         name: 'admin'
//       },
//       {
//         name: 'client'
//       },
//       {
//         name: 'intrabbler'
//       }
//     ]
//   });
// console.log(uuidv4())
//   await prisma.user.create({
//     data: {
//       id: uuidv4(),
//       role_id: 1,
//       name: 'admin',
//       lastname: 'admin',
//       phone_number: '3017953727',
//       email: 'admin@admin.com',
//       password_hash: 'admin',
//       username: 'admin',
//       is_active: true,
//       is_online: true,
//       last_login: new Date()
//     }
//   });

  // await prisma.documentType.createMany({
  //   data: [
  //     {
  //       name: 'identity_card_front_side',
  //       description: 'Parte frontal de la cédula de identidad'
  //     },
  //     {
  //       name: 'identity_card_back_side',
  //       description: 'Parte posterior de la cédula de identidad'
  //     },
  //     {
  //       name: 'selfie',
  //       description: 'Fotografía selfie del usuario'
  //     }
  //   ]
  // });

  // await prisma.serviceCategory.createMany({
  //   data: [
  //     {
  //       name: 'Servicio de limpieza',
  //       slug: 'servicio-de-limpieza'
  //     },
  //     {
  //       name: 'Servicio de plomería',
  //       slug: 'servicio-de-plomeria'
  //     },
  //     {
  //       name: 'Servicio de electricidad',
  //       slug: 'servicio-de-electricidad'
  //     },
  //     {
  //       name: 'Servicio de jardinería',
  //       slug: 'servicio-de-jardineria'
  //     },
  //     {
  //       name: 'Servicio de pintura',
  //       slug: 'servicio-de-pintura'
  //     },
  //     {
  //       name: 'Servicio de carpintería',
  //       slug: 'servicio-de-carpinteria'
  //     }
  //   ]
  // });

  // Seed Payment Methods
  // Verificar si ya existen métodos de pago
  const existingMethods = await prisma.paymentMethod.count();

  if (existingMethods === 0) {
    await prisma.paymentMethod.createMany({
      data: [
        {
          name: 'Wallet',
          description: 'Saldo de la billetera virtual',
          code: 'WALLET'
        },
        {
          name: 'Tarjeta de Crédito/Débito',
          description: 'Pago con tarjeta de crédito o débito (Visa, Mastercard, AmEx)',
          code: 'CARD'
        },
        {
          name: 'Nequi',
          description: 'Pago a través de la app Nequi',
          code: 'NEQUI'
        },
        {
          name: 'PSE',
          description: 'Pago con PSE - Débito desde cuenta bancaria',
          code: 'PSE'
        },
        {
          name: 'Bancolombia Transfer',
          description: 'Pago con Botón Bancolombia',
          code: 'BANCOLOMBIA_TRANSFER'
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
