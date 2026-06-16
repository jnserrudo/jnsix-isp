import React, { useEffect, useState } from 'react';
import { ShieldCheck, Filter, RefreshCw, Calendar, User, Activity, Database, AlertCircle, ChevronDown, ChevronUp, ArrowRight, Plus, Minus } from 'lucide-react';
import { fetchWithRetry } from '../utils/apiFetch';
import { showToast } from '../utils/toast';
import TopProgressBar from '../components/TopProgressBar';
import SkeletonTable from '../components/SkeletonTable';
import TablePagination from '../components/mikrotik/TablePagination';

interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  userId: string;
  oldValues: any;
  newValues: any;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    fullName: string;
    email: string;
  };
}

const entityTranslations: Record<string, string> = {
  USER: 'Usuario',
  CLIENT: 'Abonado',
  PLAN: 'Plan de Internet',
  NODE: 'Router MikroTik',
  CONTRACT: 'Servicio/Contrato',
  INVOICE: 'Factura',
  PAYMENT: 'Pago',
  MIKROTIK: 'Config. MikroTik',
  SYSTEM: 'Sistema',
  IMPORT: 'Importación Excel'
};

const actionTranslations: Record<string, string> = {
  CREATE: 'Creó Nuevo',
  UPDATE: 'Modificó',
  DELETE: 'Eliminó',
  RESTORE: 'Restauró',
  LOGIN: 'Inició Sesión',
  LOGOUT: 'Cerró Sesión',
  BLOCK: 'Cortó Servicio',
  UNBLOCK: 'Reactivó Servicio',
  PROVISION: 'Sincronizó',
  SYNC_SPEED: 'Cambió Velocidad',
  TERMINATE: 'Dio de Baja',
  IMPORT_EXCEL: 'Importó Excel',
  EXPORT: 'Exportó Datos'
};

interface AuditProps {
  token: string;
  userRole: string;
}

// Map for common key translations
const keyTranslations: Record<string, string> = {
  fullName: 'Nombre Completo',
  phone: 'Teléfono',
  address: 'Dirección',
  documentId: 'DNI/Documento',
  status: 'Estado',
  planId: 'Plan',
  nodeId: 'Nodo',
  pppoeUsername: 'Usuario PPPoE',
  pppoePassword: 'Password PPPoE',
  staticIp: 'IP Estática',
  macAddress: 'Dirección MAC',
  onuSerial: 'Serial ONU',
  onuModel: 'Modelo ONU',
  dueDate: 'Fecha de Vencimiento',
  amount: 'Monto',
  paymentMethod: 'Método de Pago',
  reference: 'Referencia',
  notes: 'Notas',
  description: 'Descripción',
  priority: 'Prioridad',
  assignedTo: 'Asignado a',
  quantity: 'Cantidad',
  type: 'Tipo',
  serialNumber: 'Número de Serie',
};

const translateKey = (key: string) => keyTranslations[key] || key;

const formatValue = (val: any): string => {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const DiffViewer: React.FC<{ oldValues: any, newValues: any }> = ({ oldValues, newValues }) => {
  const o = oldValues || {};
  const n = newValues || {};
  const allKeys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));

  const changes = allKeys.map(key => {
    const oldVal = o[key];
    const newVal = n[key];
    const isAdded = oldVal === undefined && newVal !== undefined;
    const isRemoved = oldVal !== undefined && newVal === undefined;
    const isChanged = oldVal !== newVal && !isAdded && !isRemoved;

    return { key, oldVal, newVal, isAdded, isRemoved, isChanged };
  }).filter(c => c.isAdded || c.isRemoved || c.isChanged);

  if (changes.length === 0) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No se registraron cambios específicos en los datos.</div>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
            <th style={{ padding: '0.5rem', textAlign: 'left', width: '25%' }}>Campo</th>
            <th style={{ padding: '0.5rem', textAlign: 'left', width: '35%' }}>Valor Anterior</th>
            <th style={{ padding: '0.5rem', textAlign: 'center', width: '5%' }}></th>
            <th style={{ padding: '0.5rem', textAlign: 'left', width: '35%' }}>Valor Nuevo</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>{translateKey(change.key)}</td>
              <td style={{ padding: '0.5rem' }}>
                {!change.isAdded && (
                  <span style={{ 
                    color: change.isRemoved || change.isChanged ? '#fca5a5' : 'var(--text-muted)',
                    textDecoration: change.isRemoved || change.isChanged ? 'line-through' : 'none',
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                  }}>
                    {change.isRemoved && <Minus size={12} />}
                    {formatValue(change.oldVal)}
                  </span>
                )}
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {change.isChanged && <ArrowRight size={14} />}
              </td>
              <td style={{ padding: '0.5rem' }}>
                {!change.isRemoved && (
                  <span style={{ 
                    color: change.isAdded || change.isChanged ? '#86efac' : 'var(--text-muted)',
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                  }}>
                    {change.isAdded && <Plus size={12} />}
                    {formatValue(change.newVal)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Audit: React.FC<AuditProps> = ({ token }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);

  // Filter states
  const [filterEntity, setFilterEntity] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');
  
  // Expanded row
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const query = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(filterEntity && { entity: filterEntity }),
        ...(filterAction && { action: filterAction }),
        t: Date.now().toString() // Prevent caching
      });

      const response = await fetchWithRetry(`/api/audit?${query}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store'
      });
      const data = await response.json();
      
      if (data.logs) {
        setLogs(data.logs);
        setTotalItems(data.total);
      } else {
        setLogs([]);
        setTotalItems(0);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar el historial de auditoría');
      showToast('Error cargando auditoría', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, pageSize, filterEntity, filterAction]);

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'USER': return <User size={14} />;
      case 'CLIENT': return <User size={14} />;
      case 'NODE': return <Database size={14} />;
      default: return <Activity size={14} />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'var(--color-success)';
      case 'DELETE': return 'var(--accent)';
      case 'BLOCK': return 'var(--accent)';
      case 'UPDATE': return 'var(--color-warning)';
      case 'LOGIN': return '#38bdf8';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className="page-container">
      <TopProgressBar loading={loading} />
      
      <div className="title-block">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={28} color="var(--accent)" />
            Auditoría de Sistema
          </h2>
          <span style={{ color: 'var(--text-muted)' }}>Historial detallado de todas las operaciones realizadas por los operadores</span>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchLogs()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Filter size={16} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filtrar Historial:</span>
        </div>
        <select 
          className="form-control" 
          style={{ width: 'auto', minWidth: '200px' }}
          value={filterEntity}
          onChange={(e) => { setFilterEntity(e.target.value); setCurrentPage(1); }}
        >
          <option value="">Cualquier Módulo</option>
          {Object.entries(entityTranslations).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
          ))}
        </select>

        <select 
          className="form-control" 
          style={{ width: 'auto', minWidth: '200px' }}
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
        >
          <option value="">Cualquier Acción</option>
          {Object.entries(actionTranslations).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <SkeletonTable rows={8} columns={['15%', '20%', '20%', '35%', '10%']} />
          </div>
        ) : error ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3>Error de conexión</h3>
            <p>{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShieldCheck size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
            <p>No se encontraron registros de auditoría que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Operador / Usuario</th>
                  <th>Módulo</th>
                  <th>Acción Realizada</th>
                  <th style={{ textAlign: 'right' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  const actionColor = getActionColor(log.action);
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'rgba(56, 189, 248, 0.05)' : 'transparent' }}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td data-label="Fecha y Hora">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            <Calendar size={12} />
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td data-label="Operador / Usuario">
                          <div style={{ fontWeight: 600 }}>{log.user?.fullName || 'Sistema'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user?.email || 'Automático'}</div>
                        </td>
                        <td data-label="Módulo">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ color: 'var(--accent)', opacity: 0.8 }}>
                              {getEntityIcon(log.entity)}
                            </div>
                            <span style={{ fontWeight: 500 }}>{entityTranslations[log.entity] || log.entity}</span>
                          </div>
                        </td>
                        <td data-label="Acción Realizada">
                          <span style={{ color: actionColor, fontWeight: 700, fontSize: '0.85rem' }}>
                            {actionTranslations[log.action] || log.action}
                          </span>
                          <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                            {log.description}
                          </span>
                        </td>
                        <td data-label="Detalle" style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'rgba(56, 189, 248, 0.02)' }}>
                          <td colSpan={5} style={{ padding: '0' }}>
                            <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                              <DiffViewer oldValues={log.oldValues} newValues={log.newValues} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            
            {totalItems > 0 && (
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <TablePagination
                  currentPage={currentPage}
                  totalItems={totalItems}
                  itemsPerPage={pageSize}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setPageSize}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Audit;
