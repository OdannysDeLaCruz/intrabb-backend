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

  await prisma.paymentMethod.createMany({
    data: [
      {
        name: 'wallet',
        description: 'Wallet',
        code: 'wallet'
      }
    ]
  });
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
