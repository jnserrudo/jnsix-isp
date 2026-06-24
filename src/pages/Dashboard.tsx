import React, { useEffect, useState } from 'react';
import { 
  Users, 
  WifiOff, 
  TrendingUp, 
  AlertCircle, 
  RefreshCw,
  Play,
  X
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { fetchWithRetry } from '../utils/apiFetch';
import { useBilling } from '../contexts/BillingContext';
import TopProgressBar from '../components/TopProgressBar';
import {
  BarChart, Bar, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

interface DashboardStats {
  clients: {
    total: number;
    active: number;
    suspended: number;
    delinquent: number;
  };
  billingMonth: {
    invoiced: number;
    collected: number;
    pending: number;
  };
  overdue: {
    count: number;
    amount: number;
  };
  recentActions: Array<{
    id: string;
    clientName: string;
    nodeName: string;
    actionType: string;
    status: string;
    executedAt: string;
    errorMessage: string | null;
  }>;
  nodesCount: number;
}

interface DashboardProps {
  token: string;
  userRole: string;
}

const Dashboard: React.FC<DashboardProps> = ({ token, userRole }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isBillingRunning, billingProgress, startBilling } = useBilling();
  const [actionLoading, setActionLoading] = useState<'cuts' | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const [confirmAction, setConfirmAction] = useState<{
    type: 'billing' | 'cuts' | null;
    message: string;
  }>({ type: null, message: '' });

  // Nodes list and selection state
  const [nodes, setNodes] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  const fetchStats = async (nodeId?: string) => {
    setLoading(true);
    try {
      setError('');
      const url = nodeId ? `/api/dashboard/stats?nodeId=${nodeId}` : '/api/dashboard/stats';
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  // Fetch nodes list on mount
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetchWithRetry('/api/nodes', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setNodes(data);
      } catch (err) {
        console.error('Error fetching nodes for dashboard selector:', err);
      }
    };
    fetchNodes();
  }, [token]);

  // Refetch stats when node selection changes
  useEffect(() => {
    fetchStats(selectedNodeId);
  }, [token, selectedNodeId]);

  const triggerBilling = () => {
    let msg = '¿Está seguro de forzar la generación de facturas mensuales hoy para TODOS los clientes del sistema?';
    if (selectedNodeId) {
      const nodeName = nodes.find(n => n.id === selectedNodeId)?.name || 'el Nodo Seleccionado';
      msg = `¿Está seguro de forzar la generación de facturas EXCLUSIVAMENTE para los clientes del MikroTik: ${nodeName}?`;
    }
    setConfirmAction({
      type: 'billing',
      message: msg
    });
  };
  const triggerCuts = () => {
    setConfirmAction({
      type: 'cuts',
      message: '¿Está seguro de iniciar el proceso de corte automático en MikroTik para los morosos?'
    });
  };

  useEffect(() => {
    const handleBillingCompleted = () => fetchStats(selectedNodeId);
    window.addEventListener('billing-completed', handleBillingCompleted);
    return () => window.removeEventListener('billing-completed', handleBillingCompleted);
  }, [selectedNodeId]);

  const runBillingAction = async () => {
    setConfirmAction({ type: null, message: '' });
    startBilling(token, selectedNodeId || undefined);
  };

  const runCutsAction = async () => {
    setActionLoading('cuts');
    setActionMessage('');
    showToast('Ejecutando cortes en MikroTik...', 'info');
    try {
      const response = await fetch('/api/invoices/trigger-cuts', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al ejecutar cortes');
      setActionMessage(`Proceso de cortes automáticos ejecutado con éxito. Se suspendieron ${data.cutsExecuted || 0} clientes.`);
      showToast(`Proceso de cortes automáticos ejecutado con éxito. Se suspendieron ${data.cutsExecuted || 0} clientes.`, 'success');
      fetchStats(selectedNodeId);
    } catch (err: any) {
      const errMsg = err.message || 'Fallo de cortes manual';
      setError(errMsg);
      showToast(errMsg, 'warning');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !stats) {
    return (
      <div className="page-container">
        <TopProgressBar loading={true} />
        <div className="page-loader">
          <div className="ring-spinner ring-spinner-lg" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>Panel de Control</div>
            <div className="page-loader-label">Cargando métricas del sistema...</div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate percentage of collection
  const collectedPct = stats?.billingMonth.invoiced && stats.billingMonth.invoiced > 0 
    ? Math.round((stats.billingMonth.collected / stats.billingMonth.invoiced) * 100)
    : 0;

  return (
    <div className="page-container">
      <TopProgressBar loading={loading} />
      {/* Title block */}
      <div className="title-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Panel de Control</h2>
          <span style={{ color: 'var(--text-muted)' }}>Métricas e infraestructura en tiempo real</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Filtrar por MikroTik:</label>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              disabled={loading}
              style={{
                width: 'auto',
                minWidth: '250px',
                padding: '0.4rem 0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                borderRadius: '0px'
              }}
            >
              <option value=""> Todos </option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchStats(selectedNodeId)} disabled={loading} style={{ height: '38px', borderRadius: '0px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Educational description box */}
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Información del Sistema</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Este panel consolida el estado de la red y las finanzas. 
          Las facturas del mes se generan de manera automática todos los días a las 00:05 hs para los contratos programados para el día actual. 
          Los cortes automatizados por falta de pago se procesan diariamente a las 09:00 hs para aquellos clientes cuya fecha de vencimiento y días de gracia hayan expirado.
        </p>
      </div>

      {error || !stats ? (
        <div className="card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '3rem 2rem', 
          textAlign: 'center', 
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)',
          marginTop: '1.5rem'
        }}>
          <AlertCircle size={48} style={{ color: 'var(--color-warning)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Conexión Demorada o Interrumpida</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '500px', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            {error && error.includes('Too many database connections') 
              ? 'La base de datos está experimentando una alta demanda de conexiones en este momento. Esto suele normalizarse automáticamente en unos segundos.' 
              : 'No pudimos conectar con el servidor para obtener las métricas actuales de la red. Por favor, verifica tu conexión o reintenta.'}
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => fetchStats(selectedNodeId)} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Reintentar Conexión
          </button>
        </div>
      ) : (
        <>
          {actionMessage && (
            <div style={{
              backgroundColor: 'var(--color-success-bg)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: 'var(--color-success)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.5rem',
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{actionMessage}</span>
              <button 
                onClick={() => setActionMessage('')} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'inherit', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center',
                  opacity: 0.8
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {billingProgress && isBillingRunning && (
            <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Procesando clientes (Analizando y Facturando)...</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{billingProgress.percentage}% ({billingProgress.current}/{billingProgress.total})</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${billingProgress.percentage}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s ease-in-out' }}></div>
              </div>
            </div>
          )}

          {/* Admin Quick Action Run Triggers */}
          {userRole === 'ADMIN' && (
            <div className="card" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Acciones de Administrador</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={triggerBilling}
                  disabled={actionLoading !== null || isBillingRunning}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Play size={16} />
                  {isBillingRunning ? 'Procesando en 2do Plano...' : 'Generar Facturas del Mes'}
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={triggerCuts}
                  disabled={actionLoading !== null || isBillingRunning}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <WifiOff size={16} />
                  {actionLoading === 'cuts' ? 'Ejecutando...' : 'Ejecutar Cortes Automáticos'}
                </button>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Facturación Mensual</span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: '1.4' }}>
                    Genera facturas para contratos activos cuyo Día de Cobro coincide con el día del mes actual (ej: si hoy es 31, busca contratos con día de cobro 31).
                  </p>
                </div>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Motor de Cortes</span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: '1.4' }}>
                    Suspende en MikroTik a los abonados con facturas vencidas fuera de plazo (Fecha Vencimiento + Días de Gracia del Contrato menor al día de hoy).
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* KPI Cards Grid */}
          <div className={`grid ${selectedNodeId === '' ? 'grid-cols-4' : 'grid-cols-3'} kpi-grid`} style={{ marginBottom: '2rem' }}>
            <div className="card kpi-card-dashboard" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div className="icon-wrapper" style={{ border: '1px solid var(--border-color)', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', display: 'flex' }}>
                <Users size={28} color="var(--accent)" />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clientes Activos</span>
                <h4 className="kpi-value">{stats.clients.active}</h4>
              </div>
            </div>

            <div className="card kpi-card-dashboard" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div className="icon-wrapper" style={{ border: '1px solid var(--color-danger-border)', padding: '0.75rem', backgroundColor: 'var(--color-danger-bg)', display: 'flex' }}>
                <WifiOff size={28} color="var(--color-danger)" />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clientes Suspendidos</span>
                <h4 className="kpi-value" style={{ color: 'var(--color-danger)' }}>{stats.clients.suspended}</h4>
              </div>
            </div>

            {selectedNodeId === '' && (
              <div className="card kpi-card-dashboard" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div className="icon-wrapper" style={{ border: '1px solid var(--border-color)', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', display: 'flex' }}>
                  <TrendingUp size={28} color="var(--accent)" />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Equipos MikroTik</span>
                  <h4 className="kpi-value">{stats.nodesCount}</h4>
                </div>
              </div>
            )}

            <div className="card kpi-card-dashboard" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div className="icon-wrapper" style={{ border: '1px solid var(--color-warning-border)', padding: '0.75rem', backgroundColor: 'var(--color-warning-bg)', display: 'flex' }}>
                <AlertCircle size={28} color="var(--color-warning)" />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Deuda Morosa</span>
                <h4 className="kpi-value" style={{ color: 'var(--color-warning)' }}>
                  ${stats.overdue.amount.toLocaleString('es-AR')}
                </h4>
              </div>
            </div>
          </div>

          {/* Invoicing Progress Section */}
          <div className="grid grid-cols-2" style={{ marginBottom: '2rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Recaudación Mensual</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Progreso de Cobranza ({collectedPct}%)</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  ${stats.billingMonth.collected.toLocaleString('es-AR')} / ${stats.billingMonth.invoiced.toLocaleString('es-AR')}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '5px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ width: `${collectedPct}%`, height: '100%', backgroundColor: 'var(--accent)', borderRadius: '5px', transition: 'width 0.5s ease' }} />
              </div>

              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Cobrado', amount: stats.billingMonth.collected, fill: '#10b981' },
                      { name: 'Pendiente', amount: stats.billingMonth.pending, fill: '#f59e0b' }
                    ]}
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="name" stroke="#888" tick={{fill: '#888'}} />
                    <RechartsTooltip 
                      cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(value: any) => [`$${value.toLocaleString('es-AR')}`, 'Monto']}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Por Cobrar</span>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                    ${stats.billingMonth.pending.toLocaleString('es-AR')}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facturas Vencidas</span>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                    {stats.overdue.count}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Actions Logs */}
            <div className="card">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Últimas acciones MikroTik</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {stats.recentActions.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                    No hay acciones registradas en el router.
                  </div>
                ) : (
                  stats.recentActions.map((action) => (
                    <div 
                      key={action.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: action.status === 'SUCCESS' 
                          ? '3px solid var(--color-success)' 
                          : '3px solid var(--color-danger)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                          {action.clientName}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          MikroTik: {action.nodeName} • {new Date(action.executedAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <span className={`badge ${action.actionType === 'BLOCK' ? 'badge-suspended' : 'badge-active'}`}>
                          {action.actionType === 'BLOCK' ? 'Corte' : 'Reactivación'}
                        </span>
                        {action.status === 'FAILED' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-danger)' }}>
                            Fallo
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
            </div>
          </div>
        </div>
      </>
    )}

      {/* Custom Confirmation Modal */}
      {confirmAction.type && (
        <div className="modal-backdrop" onClick={() => setConfirmAction({ type: null, message: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setConfirmAction({ type: null, message: '' })} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Confirmar Acción</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              {confirmAction.message}
            </p>
             <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmAction({ type: null, message: '' })}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  const type = confirmAction.type;
                  setConfirmAction({ type: null, message: '' });
                  if (type === 'billing') {
                    runBillingAction();
                  } else if (type === 'cuts') {
                    runCutsAction();
                  }
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
