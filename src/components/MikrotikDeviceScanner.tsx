import React, { useEffect, useState } from 'react';
import { Search, Plus, UserCheck, UserX, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { showToast } from '../utils/toast';
import SkeletonTable from './SkeletonTable';
import TablePagination from './mikrotik/TablePagination';

interface DeviceConnection {
  type: string;
  deviceName: string;
  ip: string;
  mac: string | null;
  interface: string;
  uptime: string | null;
  signal: string | null;
  rx: number | null;
  tx: number | null;
  isAssociated?: boolean;
  clientId?: string;
  clientName?: string;
  contractId?: string;
}

interface MikrotikDeviceScannerProps {
  nodeId: string;
}

const MikrotikDeviceScanner: React.FC<MikrotikDeviceScannerProps> = ({ nodeId }) => {
  const [connections, setConnections] = useState<DeviceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [scannedAt, setScannedAt] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal de asociación
  const [associateTarget, setAssociateTarget] = useState<DeviceConnection | null>(null);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [associateSubmitting, setAssociateSubmitting] = useState(false);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`/api/nodes/${nodeId}/live-connections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al conectar con MikroTik');
      }
      
      const data = await response.json();
      setConnections(data.connections || []);
      setScannedAt(data.scannedAt);
    } catch (err: any) {
      setError(err.message || 'Error al obtener conexiones');
      showToast(err.message, 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nodeId) {
      fetchConnections();
    }
  }, [nodeId]);

  useEffect(() => {
    // Fetch clients for the dropdown
    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch('/api/clients', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Filter out cancelled clients if needed, or keep all active/suspended
          setClientsList(data.filter((c: any) => c.status !== 'CANCELLED'));
        }
      } catch (err) {
        console.error('Error fetching clients for dropdown', err);
      }
    };
    fetchClients();
  }, []);

  const handleAssociate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!associateTarget || !selectedClientId) return;

    // Find the client to get their contract
    const client = clientsList.find(c => c.id === selectedClientId);
    if (!client || !client.contracts || client.contracts.length === 0) {
      showToast('El cliente seleccionado no tiene un contrato válido.', 'warning');
      return;
    }

    const contractId = client.contracts[0].id;
    setAssociateSubmitting(true);

    try {
      const payload: any = {};
      if (associateTarget.type === 'PPPoE') {
        payload.pppoeUsername = associateTarget.deviceName;
        // Optionally set a default password or leave existing
      } else {
        payload.staticIp = associateTarget.ip;
        if (associateTarget.mac) payload.macAddress = associateTarget.mac;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al asociar contrato');
      }

      showToast(`Dispositivo asociado correctamente a ${client.fullName}`, 'success');
      setAssociateTarget(null);
      setSelectedClientId('');
      fetchConnections(); // refresh the table
    } catch (err: any) {
      showToast(err.message || 'Error al asociar', 'warning');
    } finally {
      setAssociateSubmitting(false);
    }
  };

  const filteredConnections = connections.filter(conn => {
    const term = search.toLowerCase();
    const matchesSearch = conn.deviceName.toLowerCase().includes(term) || 
                          conn.ip.includes(term) || 
                          (conn.mac && conn.mac.toLowerCase().includes(term));
    
    let matchesType = true;
    if (filterType === 'ASSOCIATED') matchesType = !!conn.isAssociated;
    if (filterType === 'ORPHANS') matchesType = !conn.isAssociated;

    return matchesSearch && matchesType;
  });

  const orphansCount = connections.filter(c => !c.isAssociated).length;

  // Pagination logic
  const totalItems = filteredConnections.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedConnections = filteredConnections.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    const maxPage = Math.ceil(totalItems / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(maxPage);
    }
  }, [totalItems, itemsPerPage, currentPage]);

  if (loading) {
    return (
      <div style={{ marginTop: '1rem' }}>
        <SkeletonTable rows={6} columns={['25%', '15%', '15%', '15%', '15%', '15%']} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--status-error)', border: '1px solid var(--status-error)' }}>
        <AlertTriangle size={32} style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Fallo de Conexión</h3>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={fetchConnections} style={{ marginTop: '1rem' }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      {/* Resumen y Alertas */}
      <div className="grid grid-cols-3" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Dispositivos</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{connections.length}</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '3px solid var(--color-success)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Registrados en Sistema</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)' }}>
            {connections.length - orphansCount}
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: orphansCount > 0 ? '3px solid var(--accent)' : '3px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Huérfanos (No Registrados)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: orphansCount > 0 ? 'var(--accent)' : '#fff' }}>
            {orphansCount}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Buscar dispositivo, IP o MAC..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div className="filter-chips-container" style={{ margin: 0, padding: 0 }}>
          <button 
            className={`filter-chip ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            Todos
          </button>
          <button 
            className={`filter-chip ${filterType === 'ASSOCIATED' ? 'active' : ''}`}
            onClick={() => setFilterType('ASSOCIATED')}
            style={filterType === 'ASSOCIATED' ? { borderColor: 'var(--color-success)', color: 'var(--color-success)', backgroundColor: 'rgba(16, 185, 129, 0.1)' } : {}}
          >
            <UserCheck size={14} /> Asociados
          </button>
          <button 
            className={`filter-chip ${filterType === 'ORPHANS' ? 'active' : ''}`}
            onClick={() => setFilterType('ORPHANS')}
          >
            <UserX size={14} /> Huérfanos
          </button>
        </div>
      </div>

      {/* Tabla */}
      {filteredConnections.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No se encontraron dispositivos que coincidan con los filtros.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="mobile-card-list">
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Estado en Sistema</th>
                <th className="desktop-only">IP / MAC</th>
                <th className="desktop-only">Tipo</th>
                <th className="desktop-only">Uptime</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedConnections.map((conn, idx) => (
                <tr key={`${conn.mac || conn.ip}-${idx}`}>
                  <td data-label="Dispositivo">
                    <div style={{ fontWeight: 600 }}>{conn.deviceName}</div>
                    <div className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      {conn.ip} • {conn.type}
                    </div>
                  </td>
                  <td data-label="Estado en Sistema">
                    {conn.isAssociated ? (
                      <div>
                        <span className="badge badge-active" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                          Asociado
                        </span>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#fff' }}>{conn.clientName}</div>
                      </div>
                    ) : (
                      <span className="badge badge-cancelled" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                        Huérfano
                      </span>
                    )}
                  </td>
                  <td className="desktop-only">
                    <div style={{ fontFamily: 'monospace' }}>{conn.ip}</div>
                    {conn.mac && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{conn.mac}</div>}
                  </td>
                  <td className="desktop-only">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{conn.type}</span>
                  </td>
                  <td className="desktop-only">
                    <span style={{ fontSize: '0.85rem' }}>{conn.uptime || '-'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {!conn.isAssociated && (
                      <button 
                        className="btn btn-sm btn-primary w-full"
                        onClick={() => setAssociateTarget(conn)}
                      >
                        <Plus size={14} />
                        <span style={{ marginLeft: '0.4rem' }}>Asociar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {totalItems > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </div>
      )}

      {scannedAt && (
        <div style={{ textAlign: 'right', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Último escaneo: {new Date(scannedAt).toLocaleTimeString()}
        </div>
      )}

      {/* Modal de Asociación */}
      {associateTarget && (
        <div className="modal-backdrop" onClick={() => setAssociateTarget(null)}>
          <div className="modal-content bottom-sheet" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setAssociateTarget(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Asociar Dispositivo: {associateTarget.deviceName}</h3>

            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ color: '#38bdf8', marginTop: '0.1rem' }}><RefreshCw size={18} /></div>
              <div>
                <h4 style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>Información del Nodo</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
                  Estás vinculando el dispositivo detectado en este nodo a un cliente. Al confirmar, el contrato del cliente se actualizará con estas credenciales, permitiéndole acceso inmediato.
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tipo de Conexión:</span>
                <strong style={{ color: '#fff' }}>{associateTarget.type}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dirección IP:</span>
                <strong style={{ fontFamily: 'monospace', color: '#fff' }}>{associateTarget.ip}</strong>
              </div>
            </div>

            <form onSubmit={handleAssociate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Seleccionar Cliente</label>
                <select 
                  value={selectedClientId} 
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={associateSubmitting}
                  required
                >
                  <option value="">-- Seleccione un cliente --</option>
                  {clientsList.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.fullName} ({client.dni})
                    </option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  A este cliente se le asignará el usuario {associateTarget.deviceName}.
                </small>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssociateTarget(null)} disabled={associateSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={associateSubmitting || !selectedClientId}>
                  {associateSubmitting ? (
                    <><RefreshCw size={14} className="animate-spin" /> Asociando...</>
                  ) : 'Confirmar Asociación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MikrotikDeviceScanner;
