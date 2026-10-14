const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { app, BrowserWindow, Menu } = require('electron');

const PORT = process.env.PORT || 3000;
// Instalado, sempre roda em modo produção. Em desenvolvimento, "dev" abre o
// Vite (que precisa estar rodando) e "prod" simula o app instalado.
const runMode = app.isPackaged ? 'prod' : (process.env.ELECTRON_RUN_MODE || 'dev');

let mainWindow = null;

function createWindow(loadUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '..', 'frontend', 'public', 'logo-essencial.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (runMode !== 'dev') {
    Menu.setApplicationMenu(null);
  }

  mainWindow.loadURL(loadUrl);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Sobe o backend dentro do processo do Electron e devolve a URL para a janela.
 * Não usa o backend/server.js porque ele lê o .env, e no app instalado as
 * configurações vêm daqui. As variáveis precisam ser definidas antes do
 * require dos módulos do backend (database.js lê DATABASE_DIR ao carregar).
 */
async function bootstrapBackendAndGetUrl() {
  const userDataDir = app.getPath('userData');
  fs.mkdirSync(userDataDir, { recursive: true });

  // 1) Carrega (ou gera, no primeiro uso) o segredo JWT desta instalação.
  const secretFilePath = path.join(userDataDir, 'secret.json');
  let jwtSecret;
  if (fs.existsSync(secretFilePath)) {
    ({ jwtSecret } = JSON.parse(fs.readFileSync(secretFilePath, 'utf-8')));
  } else {
    jwtSecret = crypto.randomBytes(64).toString('hex');
    fs.writeFileSync(secretFilePath, JSON.stringify({ jwtSecret }), { mode: 0o600 });
  }

  // 2) Env vars antes de qualquer require de módulo do backend.
  process.env.JWT_SECRET = jwtSecret;
  process.env.DATABASE_DIR = path.join(userDataDir, 'database');
  process.env.BACKUP_DIRECTORY = path.join(userDataDir, 'backups');
  process.env.FRONTEND_DIST_PATH = path.join(__dirname, '..', 'frontend', 'dist');
  process.env.PORT = String(PORT);

  // 3) Só agora os módulos do backend podem ser carregados.
  const { initializeDatabase } = require('../backend/src/config/database');
  const { seedUsers } = require('../backend/src/database/seedUsers');
  const { startBackupScheduler } = require('../backend/src/services/backupService');
  const expressApp = require('../backend/src/app');

  await initializeDatabase();
  await seedUsers();
  startBackupScheduler();

  await new Promise((resolve, reject) => {
    const server = expressApp.listen(PORT, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  return `http://127.0.0.1:${PORT}/`;
}

async function start() {
  if (runMode === 'dev') {
    createWindow('http://localhost:5173');
    return;
  }

  try {
    const url = await bootstrapBackendAndGetUrl();
    createWindow(url);
  } catch (error) {
    console.error('Falha ao iniciar o backend embutido:', error);
    app.quit();
  }
}

// Evita duas instâncias simultâneas escrevendo no mesmo banco/porta.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
}
