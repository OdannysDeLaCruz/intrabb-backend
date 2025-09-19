const Bull = require('bull');

// Script temporal para limpiar las colas de notificaciones
async function clearQueues() {
  try {
    console.log('🧹 Limpiando colas de Bull...');

    // Conectar a las colas
    const notificationRetryQueue = new Bull('notification-retry', {
      redis: {
        host: 'localhost',
        port: 6379,
      }
    });

    const notificationCleanupQueue = new Bull('notification-cleanup', {
      redis: {
        host: 'localhost',
        port: 6379,
      }
    });

    // Limpiar trabajos pendientes, activos, completados y fallidos
    await notificationRetryQueue.clean(0, 'wait');
    await notificationRetryQueue.clean(0, 'active');
    await notificationRetryQueue.clean(0, 'completed');
    await notificationRetryQueue.clean(0, 'failed');
    await notificationRetryQueue.clean(0, 'delayed');

    await notificationCleanupQueue.clean(0, 'wait');
    await notificationCleanupQueue.clean(0, 'active');
    await notificationCleanupQueue.clean(0, 'completed');
    await notificationCleanupQueue.clean(0, 'failed');
    await notificationCleanupQueue.clean(0, 'delayed');

    console.log('✅ Colas limpiadas exitosamente');

    // Cerrar conexiones
    await notificationRetryQueue.close();
    await notificationCleanupQueue.close();

    process.exit(0);
  } catch (error) {
    console.error('❌ Error limpiando colas:', error);
    process.exit(1);
  }
}

clearQueues();