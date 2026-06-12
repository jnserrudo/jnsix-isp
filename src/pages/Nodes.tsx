import React, { useEffect, useState } from 'react';
import { Plus, Radio, Check, X, RefreshCw } from 'lucide-react';
import { showToast } from '../utils/toast';
import LiveConnectionsTable from '../components/LiveConnectionsTable';
import TablePagination from '../components/mikrotik/TablePagination';

interface Node {
  id: string;
  name: string;
  mikrotikHost: string;
  mikrotikPort: number;
  mikrotikUser: string;
  oltHost: string | null;
  oltType: 'VSOL_GPON' | 'VSOL_EPON' | 'NONE';
  isActive: boolean;
}

interface NodesProps {
  token: string;
  userRole: string;
}

const Nodes: React.FC<NodesProps> = ({ token, userRole }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<{ [nodeId: string]: 'testing' | 'online' | 'offline' | null }>({});

  // Tabs state
  const [activeTab, setActiveTab] = useState<'nodes' | 'actions' | 'radar'>('nodes');
  const [selectedNodeForRadar, setSelectedNodeForRadar] = useState<string | null>(null);
  const [actions, setActions] = useState<Array<{
    id: string;
    clientName: string;
    nodeName: string;
    actionType: string;
    status: string;
    executedAt: string;
    errorMessage: string | null;
  }>>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  // Event pagination states
  const [evtCurrentPage, setEvtCurrentPage] = useState(1);
  const [evtRowsPerPage, setEvtRowsPerPage] = useState(10);

  // Form states
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8728');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [oltHost, setOltHost] = useState('');
  const [oltType, setOltType] = useState<'VSOL_GPON' | 'VSOL_EPON' | 'NONE'>('NONE');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nodes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error cargando nodos');
      const data = await response.json();
      setNodes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActions = async () => {
    try {
      setActionsLoading(true);
      const response = await fetch('/api/nodes/actions/log', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error cargando historial de acciones');
      const data = await response.json();
      setActions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setActionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'actions') {
      fetchActions();
      setEvtCurrentPage(1);
    } else {
      fetchNodes();
    }
  }, [token, activeTab]);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || !host || !user || !pass) {
      setFormError('Nombre, IP Host, Usuario y Contraseña son requeridos');
      return;
    }

    setSubmitting(true);
    showToast('Añadiendo nodo de red...', 'info');
    try {
      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          mikrotikHost: host,
          mikrotikPort: parseInt(port),
          mikrotikUser: user,
          mikrotikPassword: pass,
          oltHost: oltHost || null,
          oltType,
          notes
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar nodo');
      }

      showToast('Nodo de red creado con éxito', 'success');
      setIsModalOpen(false);
      setName('');
      setHost('');
      setPort('8728');
      setUser('');
      setPass('');
      setOltHost('');
      setOltType('NONE');
      setNotes('');
      fetchNodes();
    } catch (err: any) {
      const errMsg = err.message || 'Error guardando nodo';
      setFormError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async (nodeId: string) => {
    setTestStatus(prev => ({ ...prev, [nodeId]: 'testing' }));
    showToast('Probando conexión con el router...', 'info');
    try {
      const response = await fetch(`/api/nodes/${nodeId}/test-connection`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setTestStatus(prev => ({ ...prev, [nodeId]: 'online' }));
        showToast('Conexión con el Nodo exitosa (API OK)', 'success');
      } else {
        setTestStatus(prev => ({ ...prev, [nodeId]: 'offline' }));
        showToast('Error de conexión con el Nodo (API falló)', 'error');
      }
    } catch (err) {
      setTestStatus(prev => ({ ...prev, [nodeId]: 'offline' }));
      showToast('Fallo al conectar con el Nodo de red', 'error');
    }
  };

  const handleDeleteNode = async (id: string) => {
    showToast('Eliminando nodo...', 'info');
    try {
      const response = await fetch(`/api/nodes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar nodo');
      }
      showToast('Nodo de red eliminado con éxito', 'success');
      fetchNodes();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar nodo', 'error');
    }
  };

  // Pagination logic for actions/events
  const totalEvents = actions.length;
  const startIndexEvents = (evtCurrentPage - 1) * evtRowsPerPage;
  const paginatedEvents = actions.slice(startIndexEvents, startIndexEvents + evtRowsPerPage);

  useEffect(() => {
    const maxPage = Math.ceil(actions.length / evtRowsPerPage);
    if (evtCurrentPage > maxPage && maxPage > 0) {
      setEvtCurrentPage(maxPage);
    }
  }, [actions, evtRowsPerPage, evtCurrentPage]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="title-block">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Nodos e Infraestructura</h2>
          <span style={{ color: 'var(--text-muted)' }}>Routers MikroTik core de distribución y OLTs de fibra</span>
        </div>
        {userRole === 'ADMIN' && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            Nuevo Nodo
          </button>
        )}
      </div>

      {/* Educational description box */}
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Administración de Nodos</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Desde este panel puede dar de alta los equipos MikroTik (RB5009) y las OLTs de fibra (V-SOL GPON/EPON) que integran su red. 
          Es requisito indispensable habilitar el servicio API en cada router (puertos por defecto 8728 u 8729) y proveer un usuario con permisos de lectura y escritura. 
          Use el botón de "Test Conexión" para verificar en tiempo real que el backend de este panel logra comunicarse con el router de red.
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2.5rem', gap: '0px' }}>
        <button
          onClick={() => setActiveTab('nodes')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'nodes' ? 'var(--bg-secondary)' : 'transparent',
            border: '1px solid var(--border-color)',
            borderBottom: activeTab === 'nodes' ? '1px solid transparent' : '1px solid var(--border-color)',
            color: activeTab === 'nodes' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
            zIndex: activeTab === 'nodes' ? 2 : 1,
            marginBottom: '-1px'
          }}
        >
          Nodos de Red
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'actions' ? 'var(--bg-secondary)' : 'transparent',
            border: '1px solid var(--border-color)',
            borderBottom: activeTab === 'actions' ? '1px solid transparent' : '1px solid var(--border-color)',
            color: activeTab === 'actions' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
            zIndex: activeTab === 'actions' ? 2 : 1,
            marginBottom: '-1px'
          }}
        >
          Historial de Eventos
        </button>
        <button
          onClick={() => setActiveTab('radar')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'radar' ? 'var(--bg-secondary)' : 'transparent',
            border: '1px solid var(--border-color)',
            borderBottom: activeTab === 'radar' ? '1px solid transparent' : '1px solid var(--border-color)',
            color: activeTab === 'radar' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
            zIndex: activeTab === 'radar' ? 2 : 1,
            marginBottom: '-1px'
          }}
        >
          Radar de Dispositivos
        </button>
      </div>

      {activeTab === 'nodes' ? (
        loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent)' }}>Cargando nodos...</div>
        ) : nodes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No hay nodos registrados en la red. Agregue su router MikroTik para comenzar a integrar los bloqueos.
          </div>
        ) : (
          <div className="grid grid-cols-2">
            {nodes.map((node) => {
              const status = testStatus[node.id];
              return (
                <div key={node.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ backgroundColor: 'var(--accent-glow)', padding: '0.4rem', borderRadius: '6px' }}>
                        <Radio size={18} color="var(--accent)" />
                      </div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{node.name}</h3>
                    </div>
                    {userRole === 'ADMIN' && (
                      <button 
                        className="btn btn-danger btn-sm" 
                        style={{ padding: '0.3rem' }}
                        onClick={() => setDeleteTarget({ id: node.id, name: node.name })}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2" style={{ gap: '0.85rem', fontSize: '0.9rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>IP/Host MikroTik:</span>
                      <p style={{ fontFamily: 'monospace', fontWeight: 500 }}>{node.mikrotikHost}:{node.mikrotikPort}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Usuario API:</span>
                      <p style={{ fontWeight: 500 }}>{node.mikrotikUser}</p>
                    </div>
                    {node.oltHost && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>IP OLT GPON:</span>
                        <p style={{ fontFamily: 'monospace', fontWeight: 500 }}>{node.oltHost} ({node.oltType})</p>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Estado Conectividad:</span>
                      <div style={{ marginTop: '0.2rem' }}>
                        {status === 'testing' ? (
                          <span style={{ color: 'var(--accent)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <RefreshCw size={12} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} /> Conectando...
                          </span>
                        ) : status === 'online' ? (
                          <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                            <Check size={10} /> Conectado (API OK)
                          </span>
                        ) : status === 'offline' ? (
                          <span className="badge badge-suspended" style={{ fontSize: '0.7rem' }}>
                            <X size={10} /> Desconectado / Falló API
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin verificar</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleTestConnection(node.id)}
                      disabled={status === 'testing'}
                    >
                      Test Conexión Router
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'actions' ? (
        actionsLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent)' }}>Cargando historial de eventos...</div>
        ) : actions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No se han registrado acciones de MikroTik en el historial.
          </div>
        ) : (
          <>
            <div className="event-log-container">
              {paginatedEvents.map((act) => {
                const isSuccess = act.status === 'SUCCESS';
                const isFailed = act.status === 'FAILED';
                const statusClass = isSuccess ? 'success' : isFailed ? 'failed' : 'pending';

                return (
                  <div key={act.id} className={`event-log-card ${statusClass}`}>
                    {/* Time & ID */}
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'block' }}>
                        ID: #{act.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>
                        {new Date(act.executedAt).toLocaleTimeString()}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                        {new Date(act.executedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Client */}
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                        Abonado
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                        {act.clientName}
                      </span>
                    </div>

                    {/* Node */}
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                        Nodo de Red
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                        {act.nodeName}
                      </span>
                    </div>

                    {/* Action & Status */}
                    <div>
                      <span className={`badge ${
                        act.actionType === 'BLOCK' ? 'badge-suspended' : 'badge-active'
                      }`} style={{ marginBottom: '0.25rem', display: 'inline-flex' }}>
                        {act.actionType === 'BLOCK' ? 'Corte' :
                         act.actionType === 'UNBLOCK' ? 'Reactivar' :
                         act.actionType === 'SPEED_CHANGE' ? 'Velocidad' : 'Test'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                        <span 
                          style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: isSuccess ? 'var(--color-success)' : isFailed ? 'var(--accent)' : 'var(--color-warning)'
                          }}
                        />
                        <span style={{ color: isSuccess ? 'var(--color-success)' : isFailed ? 'var(--accent)' : 'var(--color-warning)', fontWeight: 600 }}>
                          {isSuccess ? 'Exitoso' : isFailed ? 'Fallido' : 'Pendiente'}
                        </span>
                      </div>
                    </div>

                    {/* Detail */}
                    <div style={{ paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-color)', minHeight: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                        Detalle del Sistema
                      </span>
                      <span className="event-system-log" style={{ color: isFailed ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {act.errorMessage || 'apiROS: command completed successfully'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Event Log Pagination bar */}
            {totalEvents > 0 && (
              <TablePagination
                currentPage={evtCurrentPage}
                totalItems={totalEvents}
                itemsPerPage={evtRowsPerPage}
                onPageChange={setEvtCurrentPage}
                onItemsPerPageChange={setEvtRowsPerPage}
              />
            )}
          </>
        )
      ) : activeTab === 'radar' ? (
        <div>
          {nodes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No hay nodos registrados. Agregue un nodo para escanear dispositivos.
            </div>
          ) : !selectedNodeForRadar ? (
            <div>
              <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Radar de Dispositivos</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Seleccione un nodo para escanear todos los dispositivos conectados en tiempo real. El sistema detecta automáticamente conexiones PPPoE, DHCP e IPs estáticas, independientemente de la subred configurada.
                </p>
              </div>
              <div className="grid grid-cols-2">
                {nodes.map((node) => (
                  <div 
                    key={node.id} 
                    className="card" 
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => setSelectedNodeForRadar(node.id)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                      <div style={{ backgroundColor: 'var(--accent-glow)', padding: '0.4rem', borderRadius: '6px' }}>
                        <Radio size={18} color="var(--accent)" />
                      </div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{node.name}</h3>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <div>IP: {node.mikrotikHost}:{node.mikrotikPort}</div>
                      <div>Usuario: {node.mikrotikUser}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button 
                onClick={() => setSelectedNodeForRadar(null)}
                className="btn btn-secondary"
                style={{ marginBottom: '1.5rem' }}
              >
                ← Volver a Nodos
              </button>
              <LiveConnectionsTable nodeId={selectedNodeForRadar} />
            </div>
          )}
        </div>
      ) : null}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Añadir Nodo de Red</h3>
            
            {formError && (
              <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateNode} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre del Nodo *</label>
                  <input type="text" placeholder="Ej: MikroTik Principal RB5009" value={name} onChange={e => setName(e.target.value)} required />
                </div>

                <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                  <div className="form-group col-span-2">
                    <label>IP / Host Pública o Local *</label>
                    <input type="text" placeholder="Ej: 190.111.45.12 o 192.168.88.1" value={host} onChange={e => setHost(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Puerto API *</label>
                    <input type="number" value={port} onChange={e => setPort(e.target.value)} required />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Usuario API RouterOS *</label>
                    <input type="text" placeholder="Ej: api_user" value={user} onChange={e => setUser(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Contraseña API *</label>
                    <input type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} required />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem' }} />
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Configuración de OLT FTH (Opcional)</h4>

                <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                  <div className="form-group col-span-2">
                    <label>IP Host de OLT V-SOL</label>
                    <input type="text" placeholder="Ej: 192.168.10.10" value={oltHost} onChange={e => setOltHost(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Tipo de OLT</label>
                    <select value={oltType} onChange={e => setOltType(e.target.value as any)}>
                      <option value="NONE">Sin OLT</option>
                      <option value="VSOL_GPON">V-SOL GPON (V1600G0)</option>
                      <option value="VSOL_EPON">V-SOL EPON (V1600D4)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Notas de Infraestructura (Ubicación física, rack, alimentación)</label>
                  <textarea rows={2} placeholder="Ej: Ubicado en torre centro. Alimentación backup 24V UPS." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Guardando...
                    </>
                  ) : 'Añadir Nodo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Custom Confirmation Modal for Node Deletion */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setDeleteTarget(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Eliminar Nodo de Red</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              ¿Está seguro de eliminar el nodo <strong>{deleteTarget.name}</strong>? Se eliminarán todas las configuraciones asociadas de forma permanente.
            </p>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  const targetId = deleteTarget.id;
                  setDeleteTarget(null);
                  handleDeleteNode(targetId);
                }}
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Nodes;
