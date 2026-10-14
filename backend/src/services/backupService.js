const fs = require('fs');
const path = require('path');
const AppError = require('../shared/AppError');
const { databasePath, run } = require('../config/database');
const { toLocalDate, toLocalDateTime } = require('../shared/dates');

// Pasta dos backups: BACKUP_DIRECTORY no .env (ex: uma pasta do Google Drive)
// ou backend/backups.
const backupDirectory = process.env.BACKUP_DIRECTORY
  ? path.resolve(process.env.BACKUP_DIRECTORY)
  : path.resolve(__dirname, '../../backups');

const AUTO_BACKUP_HOUR = Number(process.env.BACKUP_AUTO_HOUR || 7);
const AUTO_BACKUP_MINUTE = Number(process.env.BACKUP_AUTO_MINUTE || 30);

let lastAutomaticBackupDate = null;
let schedulerStarted = false;

/**
 * Garante que a pasta de destino dos backups exista antes de gravar arquivos.
 */
function ensureBackupDirectory() {
  if (!fs.existsSync(backupDirectory)) {
    fs.mkdirSync(backupDirectory, { recursive: true });
  }
}

/**
 * Ex: backup-auto-2026-10-14_07-30-00.sqlite
 * @param {'backup-auto'|'backup-manual'} prefix
 */
function buildBackupFileName(prefix) {
  const timestamp = toLocalDateTime().replace(' ', '_').replace(/:/g, '-');
  return `${prefix}-${timestamp}.sqlite`;
}

/**
 * Verifica se já existe arquivo de backup automático gerado para a data informada.
 * Evita duplicar backup automático no mesmo dia mesmo após reiniciar o processo.
 * @param {string} dateKey YYYY-MM-DD
 */
function hasAutomaticBackupForDate(dateKey) {
  ensureBackupDirectory();
  const prefix = `backup-auto-${dateKey}_`;
  return fs
    .readdirSync(backupDirectory)
    .some((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.sqlite'));
}

/**
 * Verifica se o horário atual já passou do horário agendado para backup automático.
 * @param {Date} date
 */
function isAfterScheduledTime(date) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  return hour > AUTO_BACKUP_HOUR || (hour === AUTO_BACKUP_HOUR && minute >= AUTO_BACKUP_MINUTE);
}

/**
 * Executa a cópia física do arquivo do banco para a pasta de backup.
 * @param {'manual'|'auto'} mode
 */
async function performBackup(mode) {
  ensureBackupDirectory();

  if (!fs.existsSync(databasePath)) {
    throw new AppError('Arquivo de banco não encontrado para backup.', 500, 'DATABASE_FILE_NOT_FOUND');
  }

  const fileName = buildBackupFileName(mode === 'auto' ? 'backup-auto' : 'backup-manual');
  const filePath = path.join(backupDirectory, fileName);

  // VACUUM INTO gera uma cópia consistente mesmo com o banco em uso.
  // Copiar o arquivo .sqlite direto poderia perder o que ainda está no WAL.
  await run('VACUUM INTO ?;', [filePath]);

  return {
    mode,
    fileName,
    filePath,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Gera backup manual (acionado por ADMIN via endpoint).
 */
async function createManualBackup() {
  return performBackup('manual');
}

/**
 * Gera o backup automático do dia, caso o horário já tenha passado e ainda
 * não exista backup automático registrado para a data atual.
 */
async function runAutomaticBackupIfNeeded() {
  const now = new Date();
  const currentDate = toLocalDate(now);

  if (!isAfterScheduledTime(now)) {
    return null;
  }

  if (lastAutomaticBackupDate === currentDate || hasAutomaticBackupForDate(currentDate)) {
    lastAutomaticBackupDate = currentDate;
    return null;
  }

  try {
    const result = await performBackup('auto');
    lastAutomaticBackupDate = currentDate;
    console.log(`Backup automático gerado: ${result.fileName}`);

    return result;
  } catch (error) {
    // Falha de backup automático não deve derrubar o servidor: apenas loga.
    console.error('Falha no backup automático:', error.message);
    return null;
  }
}

/**
 * Inicia o agendador de backup automático.
 * Roda uma checagem imediata no startup (cobre o caso do horário já ter
 * passado quando o servidor sobe) e depois repete a checagem periodicamente.
 */
function startBackupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Faz checagem no startup (inclui catch-up caso já tenha passado o horário).
  runAutomaticBackupIfNeeded();

  // Checa periodicamente para disparar no primeiro ciclo após o horário.
  setInterval(runAutomaticBackupIfNeeded, 15 * 60 * 1000);
}

/**
 * Retorna configuração atual do agendamento e status do último backup automático.
 */
function getBackupStatus() {
  return {
    schedule: {
      hour: AUTO_BACKUP_HOUR,
      minute: AUTO_BACKUP_MINUTE,
      text: `${String(AUTO_BACKUP_HOUR).padStart(2, '0')}:${String(AUTO_BACKUP_MINUTE).padStart(2, '0')}`,
    },
    backupDirectory,
    lastAutomaticBackupDate,
  };
}

module.exports = {
  createManualBackup,
  startBackupScheduler,
  getBackupStatus,
};
