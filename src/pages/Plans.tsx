import React, { useEffect, useState } from 'react';
import { Plus, X, RefreshCw, History, Edit, Trash2, WifiOff } from 'lucide-react';
import { showToast } from '../utils/toast';
import { fetchWithRetry } from '../utils/apiFetch';
import TablePagination from '../components/mikrotik/TablePagination';
import SkeletonTable from '../components/SkeletonTable';
import TopProgressBar from '../components/TopProgressBar';
import FormAlert from '../components/FormAlert';

interface Plan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  price: number;
  mikrotikProfile: string | null;
  description: string | null;
  isActive: boolean;
  _count?: {
    contracts: number;
  };
  nodesBreakdown?: {
    id: string;
    name: string;
    count: number;
  }[];
}

interface AuditLog {
  id: string;
  action: string;
  description: string;
  userEmail: string | null;
  createdAt: string;
}

interface PlansProps {
  token: string;
  userRole: string;
}

const Plans: React.FC<PlansProps> = ({ token, userRole }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeFilter, setNodeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form states
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [price, setPrice] = useState('');
  const [profile, setProfile] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithRetry('/api/plans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPlans(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error cargando planes');
      showToast('Error al obtener la lista de planes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [token]);

  const handleOpenCreateModal = () => {
    setEditingPlanId(null);
    setName('');
    setDownloadSpeed('');
    setUploadSpeed('');
    setPrice('');
    setProfile('');
    setDescription('');
    setIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setName(plan.name);
    setDownloadSpeed(plan.downloadSpeed.toString());
    setUploadSpeed(plan.uploadSpeed.toString());
    setPrice(plan.price.toString());
    setProfile(plan.mikrotikProfile || '');
    setDescription(plan.description || '');
    setIsActive(plan.isActive);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenHistoryModal = async (plan: Plan) => {
    setSelectedPlan(plan);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    setHistoryLogs([]);
    try {
      const response = await fetchWithRetry(`/api/audit/entity/PLAN/${plan.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar historial');
      const data = await response.json();
      setHistoryLogs(data);
    } catch (err: any) {
      console.error(err);
      showToast('Error al obtener historial de aumentos', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || !downloadSpeed || !uploadSpeed || !price) {
      setFormError('Todos los campos obligatorios son requeridos');
      return;
    }

    setSubmitting(true);
    const method = editingPlanId ? 'PUT' : 'POST';
    const url = editingPlanId ? `/api/plans/${editingPlanId}` : '/api/plans';
    
    showToast(editingPlanId ? 'Actualizando plan...' : 'Creando plan...', 'info');

    try {
      const response = await fetchWithRetry(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          downloadSpeed: parseInt(downloadSpeed),
          uploadSpeed: parseInt(uploadSpeed),
          price: parseFloat(price),
          mikrotikProfile: profile || null,
          description: description || null,
          isActive
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar el plan');
      }

      showToast(editingPlanId ? 'Plan actualizado con éxito' : 'Plan creado con éxito', 'success');
      setIsModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      setFormError(err.message);
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    showToast('Eliminando plan...', 'info');
    try {
      const response = await fetchWithRetry(`/api/plans/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar plan');
      }
      showToast('Plan eliminado con éxito', 'success');
      setDeleteTarget(null);
      fetchPlans();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Pagination and filtering calculations
  const uniqueNodes = Array.from(new Set(plans.flatMap(p => p.nodesBreakdown?.map(n => n.name) || []).filter(Boolean))).sort();

  const filteredPlans = plans.filter(p => {
    if (nodeFilter !== '') {
      return p.nodesBreakdown?.some(n => n.name === nodeFilter) ?? false;
    }
    return true;
  });

  const totalItems = filteredPlans.length;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedPlans = filteredPlans.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="page-container">
      <TopProgressBar loading={loading} />
      {/* Header */}
      <div className="title-block">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Planes de Internet</h2>
          <span style={{ color: 'var(--text-muted)' }}>Gestión de tarifas y perfiles de velocidad de banda ancha</span>
        </div>
        {userRole === 'ADMIN' && (
          <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ borderRadius: '0px' }}>
            <Plus size={16} />
            Nuevo Plan
          </button>
        )}
      </div>

      {/* Description Box */}
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Administración de Tarifas</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Desde esta sección puede definir los planes de acceso de bajada y subida. 
          Al actualizar el precio mensual de un plan, este quedará registrado en el historial de auditoría y se verá reflejado en las futuras facturaciones de los clientes asociados. 
          Haga clic en "Historial" para auditar los cambios de tarifas aplicados a lo largo del tiempo.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: '200px' }}>
          <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)}>
            <option value="">Nodos: Todos</option>
            {uniqueNodes.map(n => (
              <option key={n as string} value={n as string}>{n as string}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Plans List */}
      {loading ? (
        <SkeletonTable rows={6} columns={['22%', '18%', '15%', '20%', '15%', '5%', '5%']} />
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <WifiOff size={48} style={{ marginBottom: '1rem', opacity: 0.5, margin: '0 auto' }} />
          <h3>Error de conexión</h3>
          <p style={{ marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchPlans}>
            <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
            Reintentar
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No hay planes de internet registrados en el sistema.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre del Plan</th>
                <th>Velocidad (B/S)</th>
                <th>Precio Mensual</th>
                <th>MikroTik Profile</th>
                <th>Abonados Activos</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPlans.map((plan) => (
                <tr key={plan.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div>{plan.name}</div>
                    {plan.description && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 'normal', marginTop: '0.15rem' }}>
                        {plan.description}
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>
                    {plan.downloadSpeed} Mbps / {plan.uploadSpeed} Mbps
                  </td>
                  <td style={{ fontWeight: 700, color: '#ffffff' }}>
                    ${Number(plan.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                  </td>
                  <td>
                    {plan.mikrotikProfile ? (
                      <code style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{plan.mikrotikProfile}</code>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Default / Dinámico</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ color: (plan._count?.contracts || 0) > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                      {plan._count?.contracts || 0} clientes totales
                    </span>
                    {plan.nodesBreakdown && plan.nodesBreakdown.length > 0 && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {plan.nodesBreakdown.map(n => (
                          <div key={n.id}>- {n.name}: {n.count}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${plan.isActive ? 'badge-active' : 'badge-suspended'}`}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button
                        title="Historial de Aumentos"
                        onClick={() => handleOpenHistoryModal(plan)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem', borderRadius: '0px' }}
                      >
                        <History size={14} />
                      </button>
                      {userRole === 'ADMIN' && (
                        <>
                          <button
                            title="Editar"
                            onClick={() => handleOpenEditModal(plan)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.4rem', borderRadius: '0px' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            title="Eliminar"
                            disabled={(plan._count?.contracts || 0) > 0}
                            onClick={() => setDeleteTarget(plan)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.4rem', borderRadius: '0px', opacity: (plan._count?.contracts || 0) > 0 ? 0.3 : 1 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <TablePagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setRowsPerPage}
          />
        </div>
      )}

      {/* Creation / Edition Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              {editingPlanId ? 'Editar Plan de Internet' : 'Crear Nuevo Plan de Internet'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <FormAlert message={formError} />
                <div className="form-group">
                  <label>Nombre del Plan *</label>
                  <input type="text" placeholder="Ej: Residencial 50 Megas" value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Bajada (Mbps) *</label>
                    <input type="number" placeholder="50" value={downloadSpeed} onChange={e => setDownloadSpeed(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Subida (Mbps) *</label>
                    <input type="number" placeholder="10" value={uploadSpeed} onChange={e => setUploadSpeed(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Precio Mensual ($ ARS) *</label>
                    <input type="number" placeholder="15000" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>MikroTik Profile Name</label>
                    <input
                      type="text"
                      placeholder="Ej: profile_100m"
                      value={profile}
                      onChange={(e) => setProfile(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Descripción / Observaciones</label>
                  <textarea
                    rows={2}
                    placeholder="Detalles sobre zona de cobertura o promociones..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
                      padding: '0.8rem 1.1rem',
                      fontFamily: 'var(--font-sans)',
                      width: '100%',
                      outline: 'none'
                    }}
                  />
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="isActive" style={{ cursor: 'pointer', userSelect: 'none' }}>Plan Activo (Disponible para contratación)</label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Plan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Price Increase Modal */}
      {isHistoryModalOpen && selectedPlan && (
        <div className="modal-backdrop" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsHistoryModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Historial de Aumentos y Modificaciones
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1.5rem' }}>
              Plan: <strong>{selectedPlan.name}</strong> • Tarifa Actual: ${Number(selectedPlan.price).toLocaleString()} ARS
            </span>

            <div className="modal-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 0.5rem' }} />
                  Cargando logs de auditoría...
                </div>
              ) : historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No se registraron modificaciones de precio o aumentos en el historial de este plan.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
                  {historyLogs.map((log) => (
                    <div 
                      key={log.id} 
                      style={{ 
                        borderLeft: '2px solid var(--accent)', 
                        paddingLeft: '1rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.25rem' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>{new Date(log.createdAt).toLocaleString('es-AR')}</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{log.action}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#ffffff', margin: 0, lineHeight: 1.4 }}>
                        {log.description}
                      </p>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Ejecutado por: {log.userEmail || 'SYSTEM'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setDeleteTarget(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Confirmar Eliminación</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              ¿Está seguro de que desea eliminar el plan de internet <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={submitting}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeletePlan} disabled={submitting}>
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : null}
                Eliminar Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plans;
