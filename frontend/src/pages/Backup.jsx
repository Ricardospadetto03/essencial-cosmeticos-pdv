import React, { useEffect, useState } from "react";
import api from "../services/api";
import { showToast } from "../utils/toast";

/**
 * Tela de backup:
 * - exibe status da rotina automática
 * - permite gerar backup manual sob demanda
 */
function Backup() {
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);

  useEffect(() => {
    async function loadBackupStatus() {
      try {
        const response = await api.get("/backup/status");
        setBackupStatus(response?.data || null);
      } catch {
        // Se falhar status, mantém tela funcional para backup manual.
      }
    }

    loadBackupStatus();
  }, []);

  async function handleManualBackup() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await api.post("/backup/manual");
      const fileName = response?.data?.file_name || "";
      const filePath = response?.data?.file_path || "";

      setLastBackup({
        fileName,
        filePath,
        createdAt: new Date(),
      });
      showToast(
        response?.data?.message ||
          (fileName ? `Backup criado com sucesso: ${fileName}` : "Backup criado com sucesso."),
        "success"
      );
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao gerar backup manual.", "error");
    } finally {
      setLoading(false);
    }
  }

  const scheduleText = backupStatus?.schedule?.text || "07:30";
  const backupDirectory = backupStatus?.backupDirectory || "-";

  return (
    <section className="backup-page">
      <div className="backup-head">
        <h2>Backup</h2>
        <p className="muted">Proteção do banco com rotina automática e acionamento manual.</p>
      </div>

      <div className="backup-grid">
        <article className="section-card backup-card backup-card-info">
          <div className="backup-card-head">
            <h3>Backup Automático</h3>
            <span className="backup-badge">Ativo</span>
          </div>
          <ul className="backup-list">
            <li>
              Horário diário: <strong>{scheduleText}</strong>
            </li>
            <li>
              O sistema cria 1 backup por dia e faz o backup pendente ao iniciar, se o horário já passou.
            </li>
            <li>
              Pasta sincronizada: <strong>{backupDirectory}</strong>
            </li>
            <li>Recomendação: mantenha o Google Drive Desktop aberto para sincronização contínua.</li>
          </ul>
        </article>

        <article className="section-card backup-card backup-card-action">
          <h3>Backup Manual</h3>
          <p className="muted">Use antes de alterações críticas ou fechamento do dia.</p>
          <div className="inline-row backup-actions">
            <button className="btn-primary" type="button" onClick={handleManualBackup} disabled={loading}>
              {loading ? "Gerando backup..." : "Gerar backup agora"}
            </button>
          </div>
        </article>
      </div>

      {lastBackup ? (
        <article className="section-card backup-last-box">
          <h3>Último backup manual</h3>
          <div className="backup-last-grid">
            <p>
              <strong>Arquivo:</strong> {lastBackup.fileName || "-"}
            </p>
            <p>
              <strong>Gerado em:</strong> {lastBackup.createdAt.toLocaleString("pt-BR")}
            </p>
            <p className="backup-path">
              <strong>Caminho:</strong> {lastBackup.filePath || "-"}
            </p>
          </div>
        </article>
      ) : (
        <article className="section-card backup-last-box backup-last-empty">
          <p className="muted">Nenhum backup manual gerado nesta sessão.</p>
        </article>
      )}
    </section>
  );
}

export default Backup;
