const { createManualBackup, getBackupStatus } = require('../services/backupService');

async function manualBackup(req, res, next) {
  try {
    const result = await createManualBackup();

    return res.json({
      message: 'Backup gerado com sucesso.',
      file_name: result.fileName,
      file_path: result.filePath,
      created_at: result.createdAt,
    });
  } catch (error) {
    return next(error);
  }
}

function backupStatus(req, res) {
  return res.json(getBackupStatus());
}

module.exports = {
  manualBackup,
  backupStatus,
};
