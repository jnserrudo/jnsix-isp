import React, { useEffect, useState } from 'react';
import { Save, Power, FileText, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { showToast } from '../../utils/toast';
import TablePagination from './TablePagination';

interface Props {
  nodeId: string;
  token: string;
}

const MikrotikSystemControl: React.FC<Props> = ({ nodeId, token }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [errorLogs, setErrorLogs] = useState('');

  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(15);

  const [loadingReboot, setLoadingReboot] = useState(false);
  const [showRebootConfirm, setShowRebootConfirm] = useState(false);

  const [loadingBackup, setLoadingBackup] = useState(false);
  const [backupName, setBackupName] = useState('');

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      setErrorLogs('');
      const response = await fetch(`/api/nodes/${nodeId}/mikrotik/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Error al conectar con el router para obtener logs.');
      }
      const { data } = await response.json();
      setLogs(data || []);
    } catch (err: any) {
      setErrorLogs(err.message || 'Error de red');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (nodeId) fetchLogs();
  }, [nodeId]);

  const reversedLogs = [...logs].reverse();
  const totalLogs = reversedLogs.length;
  const startIndex = (logsPage - 1) * logsPerPage;
  const paginatedLogs = reversedLogs.slice(startIndex, startIndex + logsPerPage);

  useEffect(() => {
    const max = Math.ceil(totalLogs / logsPerPage);
    if (logsPage > max && max > 0) setLogsPage(max);
  }, [totalLogs, logsPerPage, logsPage]);

  const handleReboot = async () => {
    try {
      setLoadingReboot(true);
      const response = await fetch(`/api/nodes/${nodeId}/mikrotik/reboot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Fallo al enviar comando de reinicio');
      }
      showToast('Comando de reinicio enviado correctamente. El router se apagará en unos segundos.', 'success');
      setShowRebootConfirm(false);
    } catch (err: any) {
      showToast(err.message || 'Error al intentar reiniciar', 'error');
    } finally {
      setLoadingReboot(false);
    }
  };

  const handleBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoadingBackup(true);
      const response = await fetch(`/api/nodes/${nodeId}/mikrotik/backup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backupName: backupName.trim() || undefined })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Fallo al generar backup');
      }
      showToast('Copia de seguridad (.backup) generada y guardada en el router con éxito', 'success');
      setBackupName('');
    } catch (err: any) {
      showToast(err.message || 'Error al generar backup', 'error');
    } finally {
      setLoadingBackup(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Sistema y Mantenimiento Avanzado</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Desde este panel puede administrar aspectos críticos del Router MikroTik: visualizar registros de actividad (Logs), forzar un reinicio en caso de congestión, y generar copias de seguridad de toda la configuración para evitar pérdidas ante fallos de hardware.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '2rem' }}>
        {/* Logs */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText color="var(--accent)" />
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Visor de Logs (Registros)</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loadingLogs}>
              <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>

          <div style={{ flex: 1, backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '4px', overflowY: 'auto', maxHeight: '350px', padding: '0.5rem' }}>
            {loadingLogs ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Obteniendo registros...</div>
            ) : errorLogs ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#f00' }}>{errorLogs}</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>El registro de MikroTik está vacío.</div>
            ) : (
              <>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', border: 'none' }}>
                  <tbody>
                    {paginatedLogs.map((l, i) => {
                      const isError = l.topics?.includes('error') || l.topics?.includes('critical');
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '4px', color: '#888', whiteSpace: 'nowrap', width: '60px' }}>{l.time}</td>
                          <td style={{ padding: '4px', color: isError ? '#f00' : '#38bdf8', whiteSpace: 'nowrap', width: '100px' }}>{l.topics}</td>
                          <td style={{ padding: '4px', color: isError ? '#f00' : '#ddd' }}>{l.message}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {totalLogs > 0 && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #333' }}>
                    <TablePagination
                      currentPage={logsPage}
                      totalItems={totalLogs}
                      itemsPerPage={logsPerPage}
                      onPageChange={setLogsPage}
                      onItemsPerPageChange={setLogsPerPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mantenimiento (Reboot / Backup) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Backup */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <Save color="var(--color-success)" />
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Generador de Backup</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Cree una copia exacta de toda la configuración (PPPoE, Firewall, IPs, Passwords). El archivo se guardará en la memoria interna del router.
            </p>
            <form onSubmit={handleBackup} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Nombre (Opcional, se autogenera fecha)" 
                value={backupName} 
                onChange={e => setBackupName(e.target.value)} 
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={loadingBackup}>
                {loadingBackup ? <><RefreshCw size={14} className="animate-spin"/> Generando...</> : <><Download size={14} /> Crear Backup</>}
              </button>
            </form>
          </div>

          {/* Reboot */}
          <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', paddingBottom: '1rem' }}>
              <Power color="var(--accent)" />
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>Reinicio de Emergencia</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Esta acción forzará el reinicio inmediato del nodo MikroTik. <strong>Todos los clientes perderán conexión a internet durante aproximadamente 1 a 3 minutos</strong>. Utilice esta opción solo si la red está colapsada o inestable.
            </p>
            
            {showRebootConfirm ? (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--accent)' }}>
                <p style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '1rem' }}>¿Está absolutamente seguro de querer reiniciar el router?</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => setShowRebootConfirm(false)} disabled={loadingReboot}>
                    Cancelar
                  </button>
                  <button className="btn btn-danger" onClick={handleReboot} disabled={loadingReboot}>
                    {loadingReboot ? <><RefreshCw size={14} className="animate-spin" /> Reiniciando...</> : <><Power size={14} /> CONFIRMAR APAGADO</>}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-danger" onClick={() => setShowRebootConfirm(true)}>
                <AlertTriangle size={14} style={{ marginRight: '0.5rem' }} />
                Forzar Reinicio del Equipo
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default MikrotikSystemControl;
