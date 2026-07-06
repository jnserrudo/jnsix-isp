import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, RefreshCw, Eye, Calendar, User, DollarSign, Tag, Info } from 'lucide-react';
import { fetchWithRetry } from '../utils/apiFetch';
import { showToast } from '../utils/toast';
import SkeletonTable from '../components/SkeletonTable';
import TopProgressBar from '../components/TopProgressBar';

interface PaymentDetail {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  client: {
    id: string;
    fullName: string;
    clientCode: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  };
}

interface Rectification {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  deletedAt: string;
  deletedBy: string | null;
  voidReason: 'ERROR_TIPEO' | 'ANULACION' | 'EDICION_MONTO' | 'OTRO';
  voidNotes: string | null;
  client: {
    id: string;
    fullName: string;
    clientCode: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  };
  replacedBy: PaymentDetail | null;
  receivedBy: {
    fullName: string;
    email: string;
  } | null;
}

interface RectificationsProps {
  token: string | null;
}

const getDiffDescription = (oldPay: any, newPay: any) => {
  if (!oldPay || !newPay) return '';
  const diffs: string[] = [];
  if (Number(oldPay.amount) !== Number(newPay.amount)) {
    diffs.push(`Monto: $${Number(oldPay.amount).toLocaleString()} por $${Number(newPay.amount).toLocaleString()}`);
  }
  if (oldPay.paymentMethod !== newPay.paymentMethod) {
    const getMethodLabel = (m: string) => m === 'TRANSFER' ? 'Transferencia' : m === 'MERCADO_PAGO' ? 'Mercado Pago' : m === 'CASH' ? 'Efectivo' : m;
    diffs.push(`Método: ${getMethodLabel(oldPay.paymentMethod)} por ${getMethodLabel(newPay.paymentMethod)}`);
  }
  const oldDate = new Date(oldPay.paymentDate).toLocaleDateString();
  const newDate = new Date(newPay.paymentDate).toLocaleDateString();
  if (oldDate !== newDate) {
    diffs.push(`Fecha: ${oldDate} por ${newDate}`);
  }
  if ((oldPay.reference || '') !== (newPay.reference || '')) {
    diffs.push(`Ref: "${oldPay.reference || 'Ninguna'}" por "${newPay.reference || 'Ninguna'}"`);
  }
  if ((oldPay.notes || '') !== (newPay.notes || '')) {
    diffs.push(`Notas: "${oldPay.notes || 'Ninguna'}" por "${newPay.notes || 'Ninguna'}"`);
  }
  return diffs.length > 0 ? `Cambios: ${diffs.join(', ')}` : 'Sin cambios';
};

export default function Rectifications({ token }: RectificationsProps) {
  const [rectifications, setRectifications] = useState<Rectification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [selectedReplacement, setSelectedReplacement] = useState<PaymentDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRectifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchWithRetry('/api/payments/rectifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('No se pudo obtener la respuesta del servidor');
      }
      const data = await response.json() as Rectification[];
      setRectifications(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast('Error al cargar el historial de rectificaciones', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRectifications();
  }, [token]);

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'ERROR_TIPEO':
        return 'Error de Tipeo';
      case 'ANULACION':
        return 'Anulación';
      case 'EDICION_MONTO':
        return 'Edición de Monto';
      case 'OTRO':
        return 'Otro';
      default:
        return reason;
    }
  };

  const getReasonColorClass = (reason: string) => {
    switch (reason) {
      case 'ERROR_TIPEO':
        return 'badge-info';
      case 'ANULACION':
        return 'badge-delinquent';
      case 'EDICION_MONTO':
        return 'badge-warning';
      case 'OTRO':
      default:
        return 'badge-suspended';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'TRANSFER':
        return 'Transferencia';
      case 'MERCADO_PAGO':
        return 'Mercado Pago';
      case 'CASH':
        return 'Efectivo';
      default:
        return method;
    }
  };

  const filteredData = rectifications.filter(item => {
    const matchesSearch = 
      item.client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.invoice.invoiceNumber && item.invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesReason = reasonFilter === '' || item.voidReason === reasonFilter;

    return matchesSearch && matchesReason;
  });

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      <TopProgressBar loading={loading} />

      {/* Header */}
      <div className="title-block">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <FileText size={28} color="var(--accent)" /> Historial de Rectificaciones
          </h2>
          <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
            Historial de auditoría para cobros que fueron anulados o reemplazados por correcciones.
          </span>
        </div>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={fetchRectifications}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ 
        display: 'flex', 
        gap: '1rem', 
        padding: '1rem', 
        marginBottom: '1.5rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por abonado o factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {/* Reason Filter */}
        <div style={{ width: '200px' }}>
          <select
            className="form-control"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
          >
            <option value="">Todos los Motivos</option>
            <option value="ERROR_TIPEO">Error de Tipeo</option>
            <option value="ANULACION">Anulación</option>
            <option value="EDICION_MONTO">Edición de Monto</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
      </div>

      {/* Main List / Table */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : filteredData.length === 0 ? (
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px dashed var(--border-color)', 
          borderRadius: '8px', 
          padding: '3rem', 
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <Info size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <p>No se encontraron registros de rectificación o anulación con los filtros aplicados.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-responsive desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha Anulación</th>
                  <th>Abonado</th>
                  <th>Factura</th>
                  <th>Monto Original</th>
                  <th>Motivo</th>
                  <th>Observaciones</th>
                  <th style={{ textAlign: 'center' }}>Operación</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {new Date(item.deletedAt).toLocaleDateString()}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(item.deletedAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td>
                      <Link 
                        to={`/clients/${item.client.id}`}
                        style={{ fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                      >
                        {item.client.fullName}
                      </Link>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Código: {item.client.clientCode}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        N° {item.invoice.invoiceNumber}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontWeight: 600 }}>
                        ${Number(item.amount).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getReasonColorClass(item.voidReason)}`}>
                        {getReasonLabel(item.voidReason)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontStyle: item.voidNotes ? 'normal' : 'italic' }}>
                        {item.voidNotes || 'Sin observaciones'}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Por: {item.deletedBy || 'Sistema'}
                      </span>
                      {item.replacedBy && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                          {getDiffDescription(item, item.replacedBy)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.replacedBy ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedReplacement(item.replacedBy);
                            setIsModalOpen(true);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                        >
                          <Eye size={12} /> Ver Reemplazo
                        </button>
                      ) : (
                        <span className="badge badge-suspended">Anulación Simple</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredData.map((item) => (
              <div key={item.id} className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Anulado: {new Date(item.deletedAt).toLocaleDateString()} {new Date(item.deletedAt).toLocaleTimeString()}
                    </span>
                    <Link to={`/clients/${item.client.id}`} style={{ fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', fontSize: '0.95rem' }}>
                      {item.client.fullName}
                    </Link>
                  </div>
                  <span className={`badge ${getReasonColorClass(item.voidReason)}`}>
                    {getReasonLabel(item.voidReason)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.75rem 0', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Factura</span>
                    <strong>N° {item.invoice.invoiceNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Monto Original</span>
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                      ${Number(item.amount).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Observaciones de Auditoría</strong>
                  <span>{item.voidNotes || 'Sin observaciones'}</span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Responsable: {item.deletedBy || 'Sistema'}
                  </span>
                  {item.replacedBy && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                      {getDiffDescription(item, item.replacedBy)}
                    </div>
                  )}
                </div>

                {item.replacedBy ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedReplacement(item.replacedBy);
                      setIsModalOpen(true);
                    }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                  >
                    <Eye size={14} /> Ver Pago de Reemplazo
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', padding: '0.35rem', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Anulación Simple (Sin Reemplazo)
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Replacement Payment Info Modal */}
      {isModalOpen && selectedReplacement && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Cerrar">
              ✕
            </button>
            
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
              <DollarSign size={18} /> Detalle del Cobro Corregido
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Este cobro nació como reemplazo de la rectificación auditada.
              </p>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                {/* Client info */}
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={14} style={{ color: 'var(--accent)' }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>{selectedReplacement.client.fullName}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Código: {selectedReplacement.client.clientCode}</span>
                  </div>
                </div>

                {/* Body items */}
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FileText size={12} /> Factura:</span>
                    <strong>N° {selectedReplacement.invoice.invoiceNumber}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={12} /> Fecha Pago:</span>
                    <strong>{new Date(selectedReplacement.paymentDate).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Tag size={12} /> Canal/Método:</span>
                    <strong>{getPaymentMethodLabel(selectedReplacement.paymentMethod)}</strong>
                  </div>
                  {selectedReplacement.reference && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Referencia/Comprobante:</span>
                      <strong style={{ wordBreak: 'break-all', maxWidth: '200px' }}>{selectedReplacement.reference}</strong>
                    </div>
                  )}
                  {selectedReplacement.notes && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Anotaciones/Observaciones:</span>
                      <span style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>{selectedReplacement.notes}</span>
                    </div>
                  )}
                </div>

                {/* Amount Box */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Monto Cobrado</span>
                  <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-success)' }}>
                    ${Number(selectedReplacement.amount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cerrar Vista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
