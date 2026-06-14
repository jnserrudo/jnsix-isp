import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw, Calendar, User, Activity, Database, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
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

const Audit: React.FC<AuditProps> = ({ token, userRole }) => {
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
        ...(filterAction && { action: filterAction })
      });

      const response = await fetchWithRetry(`/api/audit?${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
      showToast('Error cargando auditoría', 'error');
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
            <table className="mobile-card-list">
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
                            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 700 }}>Inspección Profunda de Datos</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem' }}>
                                <div>
                                  <span style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--accent)' }}>Valores Anteriores:</span>
                                  <pre style={{ backgroundColor: '#0a0a0a', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid #222', color: '#888', whiteSpace: 'pre-wrap' }}>
                                    {log.oldValues && Object.keys(log.oldValues).length > 0 
                                      ? JSON.stringify(log.oldValues, null, 2) 
                                      : 'No aplicable (Ninguno)'}
                                  </pre>
                                </div>
                                <div>
                                  <span style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--color-success)' }}>Nuevos Valores Aplicados:</span>
                                  <pre style={{ backgroundColor: '#0a0a0a', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid #222', color: '#ddd', whiteSpace: 'pre-wrap' }}>
                                    {log.newValues && Object.keys(log.newValues).length > 0 
                                      ? JSON.stringify(log.newValues, null, 2) 
                                      : 'No aplicable (Ninguno)'}
                                  </pre>
                                </div>
                              </div>
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
