const { PrismaClient } = require('@prisma/client');

async function clearFailedNotifications() {
  const prisma = new PrismaClient();

  try {
    console.log('🗑️ Limpiando tabla failed_notification...');

    const result = await prisma.failedNotification.deleteMany({});

    console.log(`✅ ${result.count} notificaciones fallidas eliminadas`);

  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

clearFailedNotifications();