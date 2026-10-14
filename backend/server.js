const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definido. Copie o arquivo .env.example para .env e preencha.');
  process.exit(1);
}

const app = require('./src/app');
const { initializeDatabase } = require('./src/config/database');
const { seedUsers } = require('./src/database/seedUsers');
const { startBackupScheduler } = require('./src/services/backupService');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await initializeDatabase();
    await seedUsers();
    startBackupScheduler();

    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Falha ao iniciar o servidor:', error);
    process.exit(1);
  }
}

bootstrap();
