import { useState } from 'react';
import { RefreshCw, Wifi, WifiOff, Activity } from 'lucide-react';
import axios from 'axios';
import TablePagination from './mikrotik/TablePagination';

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

interface Connection {
  type: 'PPPoE' | 'DHCP' | 'Static IP';
  deviceName: string;
  ip: string;
  mac: string;
  interface: string;
  uptime: string;
  signal: string | null;
  rx: number | null;
  tx: number | null;
  isAssociated?: boolean;
  clientName?: string | null;
  clientId?: string | null;
  contractId?: string | null;
}

interface LiveConnectionsData {
  success: boolean;
  nodeId: string;
  nodeName: string;
  totalDevices: number;
  connections: Connection[];
  scannedAt: string;
}

interface Props {
  nodeId: string;
}

export default function LiveConnectionsTable({ nodeId }: Props) {
  const [data, setData] = useState<LiveConnectionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const getToken = () => localStorage.getItem('token');

  const scanNetwork = async () => {
    setLoading(true);
    setError('');
    setCurrentPage(1);

    try {
      const response = await axios.get(
        `${API_URL}/api/nodes/${nodeId}/live-connections`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      setData(response.data);
    } catch (err: any) {
      console.error('Error escaneando red:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Error al escanear la red'
      );
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      'PPPoE': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'DHCP': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Static IP': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return styles[type as keyof typeof styles] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const formatSignal = (signal: string | null) => {
    if (!signal) return '-';
    const value = parseInt(signal);
    if (value >= -50) return <span className="text-green-400">{signal} dBm</span>;
    if (value >= -70) return <span className="text-yellow-400">{signal} dBm</span>;
    return <span className="text-red-400">{signal} dBm</span>;
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '-';
    const mb = bytes / 1024 / 1024;
    if (mb < 1) return `${(bytes / 1024).toFixed(2)} KB`;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const totalItems = data ? data.connections.length : 0;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedConnections = data
    ? data.connections.slice(startIndex, startIndex + rowsPerPage)
    : [];

  return (
    <div className="data-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#ffffff', marginBottom: '0.25rem' }}>
            Radar de Dispositivos
          </h2>
          {data && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {data.totalDevices} dispositivos detectados en {data.nodeName}
            </p>
          )}
        </div>
        <button
          onClick={scanNetwork}
          disabled={loading}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Escaneando...' : 'Escanear Red'}
        </button>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Activity size={48} className="animate-spin" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>Escaneando dispositivos en la red...</p>
        </div>
      )}

      {data && data.connections.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <WifiOff size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>No se detectaron dispositivos conectados</p>
        </div>
      )}

      {data && data.connections.length > 0 && (
        <>
          <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Dispositivo/Usuario
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tipo
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    IP
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    MAC Address
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Interfaz
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Señal
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Uptime
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    RX/TX
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedConnections.map((conn, idx) => (
                  <tr 
                    key={idx}
                    style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Wifi size={16} style={{ color: conn.signal ? 'var(--color-success)' : 'var(--text-muted)' }} />
                        {conn.isAssociated ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <a 
                              href={`/clients/${conn.clientId}`} 
                              style={{ 
                                color: 'var(--color-success)', 
                                textDecoration: 'none', 
                                fontWeight: '600',
                                transition: 'opacity 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                              {conn.clientName}
                            </a>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Usuario: {conn.deviceName}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '500' }}>{conn.deviceName}</span>
                            <span 
                              style={{ 
                                backgroundColor: 'rgba(235, 94, 85, 0.15)', 
                                color: 'var(--accent)', 
                                border: '1px solid rgba(235, 94, 85, 0.3)', 
                                padding: '0.1rem 0.4rem', 
                                fontSize: '0.65rem', 
                                fontWeight: 'bold',
                                borderRadius: '0px'
                              }}
                            >
                              Huérfano (No Registrado)
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span 
                        className={getTypeBadge(conn.type)}
                        style={{ 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '9999px', 
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          border: '1px solid',
                          display: 'inline-block'
                        }}
                      >
                        {conn.type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {conn.ip}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {conn.mac}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {conn.interface}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                      {formatSignal(conn.signal)}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      {conn.uptime}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {conn.rx && conn.tx ? (
                        <div style={{ fontSize: '0.75rem' }}>
                           <div>↓ {formatBytes(conn.rx)}</div>
                           <div>↑ {formatBytes(conn.tx)}</div>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setRowsPerPage}
          />

          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Última actualización: {new Date(data.scannedAt).toLocaleString('es-AR')}
          </div>
        </>
      )}
    </div>
  );
}
