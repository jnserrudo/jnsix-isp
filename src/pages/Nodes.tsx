import React, { useEffect, useState } from 'react';
import { Plus, Radio, Check, X, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { showToast } from '../utils/toast';
import MikrotikDeviceScanner from '../components/MikrotikDeviceScanner';
import MikrotikTopologyScanner from '../components/mikrotik/MikrotikTopologyScanner';
import MikrotikDiagnosticTools from '../components/mikrotik/MikrotikDiagnosticTools';
import MikrotikActiveSessions from '../components/mikrotik/MikrotikActiveSessions';
import MikrotikSystemControl from '../components/mikrotik/MikrotikSystemControl';
import TablePagination from '../components/mikrotik/TablePagination';
import SkeletonTable from '../components/SkeletonTable';
import TopProgressBar from '../components/TopProgressBar';
import { fetchWithRetry } from '../utils/apiFetch';
import FormAlert from '../components/FormAlert';

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
  const [activeMainTab, setActiveMainTab] = useState<'nodes' | 'actions'>('nodes');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'radar' | 'topology' | 'ping' | 'sessions' | 'system' | 'history'>('radar');

  const [actions, setActions] = useState<Array<{
    id: string;
    clientName: string;
    nodeName: string;
    actionType: string;
    status: string;
    executedAt: string;
    errorMessage: string | null;
  }>>([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);

  // Pagination for actions states
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
      setError(null);
      const response = await fetchWithRetry('/api/nodes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setNodes(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error cargando nodos');
    } finally {
      setLoading(false);
    }
  };

  const fetchActions = async () => {
    try {
      setActionsLoading(true);
      setActionsError(null);
      const response = await fetchWithRetry('/api/nodes/actions/log', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setActions(data);
    } catch (err: any) {
      console.error(err);
      setActionsError(err.message || 'Error cargando historial de acciones');
    } finally {
      setActionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'actions' || activeDetailTab === 'history') {
      fetchActions();
      setEvtCurrentPage(1);
    } 
    if (activeMainTab === 'nodes' && !selectedNode) {
      fetchNodes();
    }
  }, [token, activeMainTab, activeDetailTab, selectedNode]);

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

  // View: Master or Detail
  if (selectedNode) {
    return (
      <div className="page-container">
        <TopProgressBar loading={loading} />
        
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => setSelectedNode(null)}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem' }}
          >
            <ArrowLeft size={16} />
            Volver a Nodos
          </button>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={20} color="var(--accent)" />
              {selectedNode.name}
            </h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {selectedNode.mikrotikHost}:{selectedNode.mikrotikPort}
            </span>
          </div>
        </div>

        {/* Detail Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2.5rem', gap: '0px', overflowX: 'auto' }}>
          {[
            { id: 'radar', label: 'Radar de Dispositivos' },
            { id: 'topology', label: 'Topología de Red' },
            { id: 'ping', label: 'Diagnóstico (Ping)' },
            { id: 'sessions', label: 'Equipos Conectados' },
            { id: 'system', label: 'Mantenimiento Sistema' },
            { id: 'history', label: 'Historial de Eventos' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveDetailTab(tab.id as any)}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeDetailTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                border: '1px solid var(--border-color)',
                borderBottom: activeDetailTab === tab.id ? '1px solid transparent' : '1px solid var(--border-color)',
                color: activeDetailTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                zIndex: activeDetailTab === tab.id ? 2 : 1,
                marginBottom: '-1px',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Detail Tab Content */}
        {activeDetailTab === 'radar' && <MikrotikDeviceScanner nodeId={selectedNode.id} />}
        {activeDetailTab === 'topology' && <MikrotikTopologyScanner nodeId={selectedNode.id} token={token} onImportNode={(ip, n) => { setHost(ip); setName(n); setIsModalOpen(true); }} />}
        {activeDetailTab === 'ping' && <MikrotikDiagnosticTools nodeId={selectedNode.id} token={token} />}
        {activeDetailTab === 'sessions' && <MikrotikActiveSessions nodeId={selectedNode.id} token={token} />}
        {activeDetailTab === 'system' && <MikrotikSystemControl nodeId={selectedNode.id} token={token} />}
        {activeDetailTab === 'history' && (
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 700, fontSize: '1.1rem' }}>Historial de Eventos del Router</h3>
            {actionsLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Cargando eventos...</div>
            ) : actions.filter(a => a.nodeName === selectedNode.name).length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>No hay eventos recientes para este nodo.</div>
            ) : (
              <div className="event-log-container">
                {actions.filter(a => a.nodeName === selectedNode.name).slice(0, 15).map((act) => {
                  const isSuccess = act.status === 'SUCCESS';
                  const isFailed = act.status === 'FAILED';
                  return (
                    <div key={act.id} className={`event-log-card ${isSuccess ? 'success' : isFailed ? 'failed' : 'pending'}`}>
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>{new Date(act.executedAt).toLocaleTimeString()}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(act.executedAt).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Abonado</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{act.clientName}</span>
                      </div>
                      <div>
                        <span className={`badge ${act.actionType === 'BLOCK' ? 'badge-suspended' : 'badge-active'}`} style={{ display: 'inline-block', marginBottom: '0.2rem' }}>
                          {act.actionType === 'BLOCK' ? 'Corte' : act.actionType === 'UNBLOCK' ? 'Reactivar' : act.actionType === 'SPEED_CHANGE' ? 'Velocidad' : 'Test'}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: isSuccess ? 'var(--color-success)' : 'var(--accent)' }}>
                          {isSuccess ? 'Exitoso' : 'Fallido'}
                        </div>
                      </div>
                      <div style={{ paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
                        <span className="event-system-log" style={{ color: isFailed ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {act.errorMessage || 'apiROS: command completed successfully'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // View: Master
  return (
    <div className="page-container">
      <TopProgressBar loading={loading || actionsLoading} />
      {/* Header */}
      <div className="title-block">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Infraestructura de Red</h2>
          <span style={{ color: 'var(--text-muted)' }}>Routers MikroTik core de distribución y OLTs de fibra</span>
        </div>
        {userRole === 'ADMIN' && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            Nuevo Nodo
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Administración de Equipos MikroTik</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Desde este panel puede dar de alta los equipos MikroTik. Seleccione un nodo de la lista para acceder a todas sus herramientas avanzadas de diagnóstico, control de sesiones y radar de red.
        </p>
      </div>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2.5rem', gap: '0px' }}>
        <button
          onClick={() => setActiveMainTab('nodes')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeMainTab === 'nodes' ? 'var(--bg-secondary)' : 'transparent',
            border: '1px solid var(--border-color)',
            borderBottom: activeMainTab === 'nodes' ? '1px solid transparent' : '1px solid var(--border-color)',
            color: activeMainTab === 'nodes' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
            zIndex: activeMainTab === 'nodes' ? 2 : 1,
            marginBottom: '-1px'
          }}
        >
          Equipos MikroTik
        </button>
        <button
          onClick={() => setActiveMainTab('actions')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeMainTab === 'actions' ? 'var(--bg-secondary)' : 'transparent',
            border: '1px solid var(--border-color)',
            borderBottom: activeMainTab === 'actions' ? '1px solid transparent' : '1px solid var(--border-color)',
            color: activeMainTab === 'actions' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
            zIndex: activeMainTab === 'actions' ? 2 : 1,
            marginBottom: '-1px'
          }}
        >
          Historial Global de Eventos
        </button>
      </div>

      {activeMainTab === 'nodes' ? (
        loading ? (
          <SkeletonTable rows={4} columns={['30%', '20%', '20%', '15%', '15%']} />
        ) : error ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <AlertCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5, margin: '0 auto' }} />
            <h3>Error de conexión</h3>
            <p style={{ marginBottom: '1.5rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={fetchNodes}>
              <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
              Reintentar
            </button>
          </div>
        ) : nodes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No hay nodos registrados en la red. Agregue su router MikroTik para comenzar a integrar los bloqueos.
          </div>
        ) : (
          <div className="grid grid-cols-2">
            {nodes.map((node) => {
              const status = testStatus[node.id];
              return (
                <div key={node.id} className="card hoverable-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
                  onClick={() => setSelectedNode(node)}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
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
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: node.id, name: node.name }); }}
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

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleTestConnection(node.id); }}
                      disabled={status === 'testing'}
                    >
                      Test API Router
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>
                      Administrar Nodo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeMainTab === 'actions' ? (
        actionsLoading ? (
          <div className="page-loader" style={{ minHeight: '30vh' }}>
            <div className="ring-spinner" />
            <span className="page-loader-label">Cargando historial de eventos...</span>
          </div>
        ) : actionsError ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <AlertCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5, margin: '0 auto' }} />
            <h3>Error de conexión</h3>
            <p style={{ marginBottom: '1.5rem' }}>{actionsError}</p>
            <button className="btn btn-primary" onClick={fetchActions}>
              <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
              Reintentar
            </button>
          </div>
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
                        Equipo MikroTik
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
      ) : null}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Agregar Nuevo Nodo (Router)</h3>
            
            <form onSubmit={handleCreateNode} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body">
                <FormAlert message={formError} />
                <div className="form-group">
                  <label>Nombre del Nodo / Identificador *</label>
                  <input type="text" placeholder="Ej: Nodo Principal Torre 1" value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                  <div className="form-group col-span-2">
                    <label>IP / Host Pública o Local *</label>
                    <input type="text" placeholder="Ej: 190.111.45.12 o 192.168.88.1" value={host} onChange={e => setHost(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Puerto API *</label>
                    <input type="number" value={port} onChange={e => setPort(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Usuario API *</label>
                    <input type="text" placeholder="admin" value={user} onChange={e => setUser(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Contraseña API *</label>
                    <input type="password" placeholder="***" value={pass} onChange={e => setPass(e.target.value)} />
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
                  ) : 'Añadir Equipo'}
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Eliminar Equipo MikroTik</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              ¿Está seguro de eliminar el equipo <strong>{deleteTarget.name}</strong>? Se eliminarán todas las configuraciones asociadas de forma permanente.
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
