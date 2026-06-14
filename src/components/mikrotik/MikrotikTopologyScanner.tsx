import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Radio, Network, Plus } from 'lucide-react';
import { showToast } from '../../utils/toast';
import SkeletonTable from '../SkeletonTable';
import TablePagination from './TablePagination';

interface TopologyDevice {
  id: string;
  identity: string;
  mac: string;
  ip: string | null;
  platform: string;
  board: string;
  version: string;
  type: 'MNDP' | 'ROMON';
}

interface Props {
  nodeId: string;
  token: string;
  onImportNode?: (ip: string, name: string) => void;
}

const MikrotikTopologyScanner: React.FC<Props> = ({ nodeId, token, onImportNode }) => {
  const [devices, setDevices] = useState<TopologyDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scannedAt, setScannedAt] = useState('');

  const [topoPage, setTopoPage] = useState(1);
  const [topoPerPage, setTopoPerPage] = useState(10);

  const fetchTopology = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/nodes/${nodeId}/mikrotik/discover`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al escanear la red');
      }
      
      const { data } = await response.json();
      
      // Parse neighbors and romon
      const discovered: TopologyDevice[] = [];
      const seenMacs = new Set<string>();

      // Procesar MNDP
      if (data.neighbors) {
        data.neighbors.forEach((n: any) => {
          const mac = n['mac-address'] || n['address'];
          if (mac && !seenMacs.has(mac)) {
            seenMacs.add(mac);
            discovered.push({
              id: n['.id'],
              identity: n['identity'] || 'Desconocido',
              mac: mac,
              ip: n['ipv4-address'] || null,
              platform: n['platform'] || 'Genérico',
              board: n['board'] || '-',
              version: n['version'] || '-',
              type: 'MNDP'
            });
          }
        });
      }

      // Procesar RoMON
      if (data.romon) {
        data.romon.forEach((r: any) => {
          const mac = r['mac-address'];
          if (mac && !seenMacs.has(mac)) {
            seenMacs.add(mac);
            discovered.push({
              id: r['.id'],
              identity: r['identity'] || 'RoMON Node',
              mac: mac,
              ip: null, // RoMON doesn't expose IP directly in discover
              platform: 'MikroTik',
              board: 'RoMON',
              version: '-',
              type: 'ROMON'
            });
          }
        });
      }

      setDevices(discovered);
      setScannedAt(new Date().toISOString());
      showToast('Escaneo de red completado exitosamente', 'success');
    } catch (err: any) {
      setError(err.message || 'Error al obtener topología');
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nodeId) fetchTopology();
  }, [nodeId]);

  const totalTopo = devices.length;
  const startIndex = (topoPage - 1) * topoPerPage;
  const paginatedDevices = devices.slice(startIndex, startIndex + topoPerPage);

  useEffect(() => {
    const max = Math.ceil(totalTopo / topoPerPage);
    if (topoPage > max && max > 0) setTopoPage(max);
  }, [totalTopo, topoPerPage, topoPage]);

  if (loading) {
    return (
      <div style={{ marginTop: '1rem' }}>
        <SkeletonTable rows={4} columns={['25%', '20%', '20%', '15%', '20%']} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--status-error)', border: '1px solid var(--status-error)' }}>
        <AlertTriangle size={32} style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Fallo en Escaneo de Red</h3>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={fetchTopology} style={{ marginTop: '1rem' }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '3px solid var(--accent)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Antenas/Routers Detectados</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>{devices.length}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={fetchTopology} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ marginRight: '0.5rem' }} />
            Escanear de Nuevo
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Network size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          No se detectaron antenas o routers vecinos en la red.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="mobile-card-list">
            <thead>
              <tr>
                <th>Identidad</th>
                <th className="desktop-only">Dirección MAC</th>
                <th>IP Local</th>
                <th className="desktop-only">Hardware / Versión</th>
                <th style={{ textAlign: 'right' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevices.map((dev) => (
                <tr key={dev.mac}>
                  <td data-label="Identidad">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Radio size={16} color="var(--accent)" />
                      <div style={{ fontWeight: 600 }}>{dev.identity}</div>
                    </div>
                    <div className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      {dev.platform} • {dev.type}
                    </div>
                  </td>
                  <td className="desktop-only" style={{ fontFamily: 'monospace' }}>{dev.mac}</td>
                  <td data-label="IP Local">
                    {dev.ip ? (
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#fff' }}>{dev.ip}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin IP Ruteable</span>
                    )}
                  </td>
                  <td className="desktop-only">
                    <div style={{ fontSize: '0.85rem' }}>{dev.board}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dev.platform} (v{dev.version})</div>
                  </td>
                  <td data-label="Estado" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {dev.ip ? (
                        <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>Administrable</span>
                      ) : (
                        <span className="badge badge-suspended" style={{ fontSize: '0.7rem' }}>Requiere IP</span>
                      )}
                      {dev.platform.toLowerCase().includes('mikrotik') ? (
                        onImportNode && (
                          <button 
                            className="btn btn-sm btn-primary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => onImportNode(dev.ip || '', dev.identity)}
                          >
                            <Plus size={14} /> Importar
                          </button>
                        )
                      ) : (
                        <div title="El sistema de administración de nodos es exclusivo para equipos RouterOS (MikroTik). No se pueden importar antenas u OLTs de otras marcas.">
                          <button 
                            className="btn btn-sm btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', opacity: 0.5, cursor: 'not-allowed' }}
                            disabled
                          >
                            No compatible
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalTopo > 0 && (
            <TablePagination
              currentPage={topoPage}
              totalItems={totalTopo}
              itemsPerPage={topoPerPage}
              onPageChange={setTopoPage}
              onItemsPerPageChange={setTopoPerPage}
            />
          )}
        </div>
      )}
      
      {scannedAt && (
        <div style={{ textAlign: 'right', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Último escaneo: {new Date(scannedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default MikrotikTopologyScanner;
