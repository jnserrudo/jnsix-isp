import React, { useEffect, useState } from 'react';
import { Calendar, Search, X, RefreshCw, MoreVertical, Printer, MessageSquare, WifiOff, AlertTriangle } from 'lucide-react';
import { showToast } from '../utils/toast';
import { fetchWithRetry } from '../utils/apiFetch';
import TablePagination from '../components/mikrotik/TablePagination';
import SkeletonTable from '../components/SkeletonTable';
import TopProgressBar from '../components/TopProgressBar';
import FormAlert from '../components/FormAlert';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'PARTIAL';
  dueDate: string;
  issuedAt: string;
  client: {
    id: string;
    fullName: string;
    dni: string;
  };
  contract: {
    status?: string;
    graceDays: number;
    plan: {
      name: string;
    };
    node?: {
      name: string;
    };
  };
}

interface BillingProps {
  token: string;
  userRole: string;
}

const Billing: React.FC<BillingProps> = ({ token, userRole }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [nodeFilter, setNodeFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // WhatsApp Template Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [waInvoice, setWaInvoice] = useState<Invoice | null>(null);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');

  // Invoice Print Preview Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const handleOpenWhatsAppModal = (invoice: Invoice) => {
    setWaInvoice(invoice);
    setWaPhone('');
    
    const dueDateStr = new Date(invoice.dueDate).toLocaleDateString();
    const amountStr = Number(invoice.amount).toLocaleString();
    const graceDays = invoice.contract?.graceDays || 0;
    const graceLimitDate = new Date(invoice.dueDate);
    graceLimitDate.setDate(graceLimitDate.getDate() + graceDays);
    const limitDateStr = graceLimitDate.toLocaleDateString();

    let msg = '';
    if (invoice.status === 'PAID') {
      msg = `Estimado/a ${invoice.client.fullName}, le agradecemos el pago de su factura ${invoice.invoiceNumber} por un monto de $${amountStr} ARS. Su servicio se encuentra activo y al día. ¡Muchas gracias por elegirnos!`;
    } else {
      msg = `Estimado/a ${invoice.client.fullName}, le recordamos que su factura ${invoice.invoiceNumber} por un monto de $${amountStr} ARS venció el ${dueDateStr}.`;
      if (new Date() > graceLimitDate) {
        msg += ` Su tolerancia de pago expiró el ${limitDateStr} y el servicio se encuentra apto para suspensión automática.`;
      } else {
        msg += ` Cuenta con plazo de tolerancia de pago hasta el ${limitDateStr} para evitar la suspensión.`;
      }
      msg += ` Puede abonar mediante transferencia al CBU: 0000003100012345678901 (Banco JNSIX) y enviar su comprobante. ¡Muchas gracias!`;
    }
    
    setWaMessage(msg);
    setIsWhatsAppModalOpen(true);
  };

  const handleSendWhatsApp = () => {
    if (!waPhone) {
      showToast('Por favor ingrese un número de teléfono', 'warning');
      return;
    }
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
    setIsWhatsAppModalOpen(false);
  };

  const handleOpenInvoiceModal = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setIsInvoiceModalOpen(true);
  };

  // Reset page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, nodeFilter, planFilter, periodFilter]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Register payment modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState('');
  const [invoiceToExpire, setInvoiceToExpire] = useState<Invoice | null>(null);
  const [reactivateOnPay, setReactivateOnPay] = useState(false);
  const [debtInfo, setDebtInfo] = useState<any>(null);
  const [loadingDebt, setLoadingDebt] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = '/api/invoices';
      if (statusFilter) {
        url += `?status=${statusFilter}`;
      }
      
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setInvoices(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al obtener facturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [token, statusFilter]);

    const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentFormError('');

    const missingFields = [];
    if (!selectedInvoice) missingFields.push('Factura Seleccionada');
    if (!payAmount || parseFloat(payAmount) <= 0) missingFields.push('Monto a Pagar (debe ser mayor a 0)');

    if (missingFields.length > 0) {
      setPaymentFormError(`Atención, revisa lo siguiente: ${missingFields.join(', ')}`);
      return;
    }

    setSubmitting(true);
    showToast('Registrando pago...', 'info');
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice?.id,
          amount: parseFloat(payAmount),
          paymentMethod: payMethod,
          reference: payRef || null,
          notes: payNotes || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error registrando el pago');
      }

      if (reactivateOnPay && selectedInvoice) {
        try {
          await fetch(`/api/clients/${selectedInvoice.client.id}/unblock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          showToast('Pago registrado y servicio reactivado con éxito', 'success');
        } catch {
          showToast('Pago registrado. No se pudo reactivar automáticamente — hacelo manualmente.', 'warning');
        }
        setReactivateOnPay(false);
      } else {
        showToast('Pago registrado con éxito', 'success');
      }
      
      await fetchInvoices();
      
      setSelectedInvoice(null);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      setDebtInfo(null);
    } catch (err: any) {
      setPaymentFormError(err.message || 'Error registrando el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceExpire = async (invoiceId: string) => {
    showToast('Marcando factura como vencida...', 'info');
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/expire`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al vencer factura');
      showToast('Factura vencida con éxito', 'success');
      fetchInvoices();
    } catch (err: any) {
      showToast(err.message || 'Error al vencer factura', 'warning');
    }
  };

  const uniqueNodes = Array.from(new Set(invoices.map(inv => inv.contract?.node?.name).filter(Boolean))).sort();
  const uniquePlans = Array.from(new Set(invoices.map(inv => inv.contract?.plan?.name).filter(Boolean))).sort();
  const uniquePeriods = Array.from(new Set(invoices.map(inv => {
    const d = new Date(inv.issuedAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }))).sort().reverse();

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.client.fullName.toLowerCase().includes(search.toLowerCase()) || 
                          inv.client.dni.includes(search) ||
                          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());

    let matchesNode = true;
    if (nodeFilter !== '') {
      matchesNode = inv.contract?.node?.name === nodeFilter;
    }

    let matchesPlan = true;
    if (planFilter !== '') {
      matchesPlan = inv.contract?.plan?.name === planFilter;
    }

    let matchesPeriod = true;
    if (periodFilter !== '') {
      const d = new Date(inv.issuedAt);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      matchesPeriod = period === periodFilter;
    }

    return matchesSearch && matchesNode && matchesPlan && matchesPeriod;
  });

  const totalItems = filteredInvoices.length;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="page-container">
      <TopProgressBar loading={loading} />
      {/* Title */}
      <div className="title-block">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Facturación y Cobros</h2>
          <span style={{ color: 'var(--text-muted)' }}>Historial general de emisión y cobranza</span>
        </div>
      </div>

      {/* Educational description box */}
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Registro de Facturación</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Desde este panel puede consultar y filtrar el estado de todas las facturas emitidas por el sistema. 
          Al registrar el cobro de una factura pendiente o vencida, el sistema asentará el ingreso y, 
          si el abonado no posee más deudas de contratos suspendidos, se restablecerá el servicio de internet de forma automática en el router MikroTik correspondiente.
        </p>
      </div>

      {/* Filter panel */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Buscar por cliente, DNI o N° factura..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
        <div style={{ width: '160px' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Estado: Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="PAID">Pagadas</option>
            <option value="OVERDUE">Vencidas</option>
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)}>
            <option value="">Nodos: Todos</option>
            {uniqueNodes.map(n => (
              <option key={n as string} value={n as string}>{n as string}</option>
            ))}
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="">Planes: Todos</option>
            {uniquePlans.map(p => (
              <option key={p as string} value={p as string}>{p as string}</option>
            ))}
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
            <option value="">Periodos: Todos</option>
            {uniquePeriods.map(p => {
              const [y, m] = (p as string).split('-');
              return <option key={p as string} value={p as string}>{m}/{y}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={7} columns={['15%', '25%', '18%', '12%', '15%', '10%', '5%']} />
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <WifiOff size={48} style={{ marginBottom: '1rem', opacity: 0.5, margin: '0 auto' }} />
          <h3>Error de conexión</h3>
          <p style={{ marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchInvoices}>
            <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
            Reintentar
          </button>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No se encontraron facturas emitidas.
        </div>
      ) : (
        <div>
        <div className="table-wrapper desktop-only">
          <table>
            <thead>
              <tr>
                <th className="desktop-only" style={{ width: '13%' }}>N° Factura</th>
                <th style={{ width: '22%' }}>Cliente</th>
                <th className="desktop-only" style={{ width: '18%' }}>Plan Contratado</th>
                <th style={{ width: '12%' }}>Monto</th>
                <th className="desktop-only" style={{ width: '15%' }}>F. Vencimiento</th>
                <th className="desktop-only" style={{ width: '15%' }}>Estado</th>
                {userRole !== 'READONLY' && <th style={{ width: '5%', textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className="table-row-hover">
                  <td data-label="Nº Factura" className="desktop-only" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {inv.invoiceNumber}
                  </td>
                  <td data-label="Cliente">
                    <div style={{ fontWeight: 600 }}>{inv.client.fullName}</div>
                    <div className="mobile-only" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'monospace', lineHeight: 1.3 }}>
                      N°: {inv.invoiceNumber} <br />
                      Plan: {inv.contract.plan.name}
                    </div>
                  </td>
                  <td data-label="Plan Contratado" className="desktop-only">{inv.contract.plan.name}</td>
                  <td data-label="Monto">
                    <div style={{ fontWeight: 700 }}>${Number(inv.amount).toLocaleString()} ARS</div>
                    <div className="mobile-only" style={{ marginTop: '0.25rem' }}>
                      {(() => {
                        const graceLimitDate = new Date(inv.dueDate);
                        graceLimitDate.setDate(graceLimitDate.getDate() + inv.contract.graceDays);
                        const isGraceExpired = new Date() > graceLimitDate;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <div>
                              <span className={`badge ${
                                inv.status === 'PAID' ? 'badge-active' :
                                inv.status === 'PARTIAL' ? 'badge-delinquent' :
                                isGraceExpired ? 'badge-suspended' : 'badge-delinquent'
                              }`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                                {inv.status === 'PAID' ? 'Pagada' :
                                 inv.status === 'PARTIAL' ? 'Pago Parcial' :
                                 isGraceExpired ? 'Vencida' : 'Pendiente'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: inv.status === 'PAID' ? 'var(--color-success)' : inv.status === 'PARTIAL' ? 'var(--color-warning)' : isGraceExpired ? 'var(--accent)' : 'var(--color-warning)', fontWeight: 600 }}>
                              Vence: {new Date(inv.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td data-label="F. Vencimiento" className="desktop-only">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={14} color="var(--text-muted)" />
                      <span>{new Date(inv.dueDate).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td data-label="Estado" className="desktop-only">
                    {(() => {
                      const graceLimitDate = new Date(inv.dueDate);
                      graceLimitDate.setDate(graceLimitDate.getDate() + inv.contract.graceDays);
                      const isGraceExpired = new Date() > graceLimitDate;

                      if (inv.status === 'PAID') {
                        return <span className="badge badge-active">Pagada</span>;
                      }
                      
                      if (inv.status === 'PARTIAL') {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div>
                              <span className="badge badge-delinquent" style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)' }}>Pago Parcial</span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#eab308', fontWeight: 600 }}>
                              Deuda Pendiente
                            </span>
                          </div>
                        );
                      }

                      if (isGraceExpired) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div>
                              <span className="badge badge-suspended">Vencida</span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>
                              Tolerancia de pago vencida: {graceLimitDate.toLocaleDateString()}
                            </span>
                          </div>
                        );
                      } else {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div>
                              <span className="badge badge-delinquent">Pendiente</span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                              Tolerancia de pago: {graceLimitDate.toLocaleDateString()}
                            </span>
                          </div>
                        );
                      }
                    })()}
                  </td>
                  {userRole !== 'READONLY' && (
                    <td data-label="Acciones" style={{ textAlign: 'right', position: 'relative' }}>
                      <div style={{ display: 'inline-flex', position: 'relative' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem', minWidth: '32px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(activeDropdown === inv.id ? null : inv.id);
                          }}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {activeDropdown === inv.id && (
                          <div 
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              zIndex: 100,
                              minWidth: '150px',
                              display: 'flex',
                              flexDirection: 'column',
                              textAlign: 'left'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.6rem 1rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-main)',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-color)'
                              }}
                              onClick={() => {
                                setActiveDropdown(null);
                                handleOpenInvoiceModal(inv);
                              }}
                            >
                              Ver Factura
                            </button>
                            <button
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.6rem 1rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-main)',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderBottom: inv.status !== 'PAID' ? '1px solid var(--border-color)' : 'none'
                              }}
                              onClick={() => {
                                setActiveDropdown(null);
                                handleOpenWhatsAppModal(inv);
                              }}
                            >
                              Notificar WhatsApp
                            </button>
                            {inv.status !== 'PAID' && (
                              <button
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '0.6rem 1rem',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-main)',
                                  fontSize: '0.85rem',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  borderBottom: inv.status === 'PENDING' ? '1px solid var(--border-color)' : 'none'
                                }}
                                onClick={async () => {
                                  setActiveDropdown(null);
                                  setSelectedInvoice(inv);
                                  setPayAmount('');
                                  setReactivateOnPay(false);
                                  setDebtInfo(null);
                                  setLoadingDebt(true);
                                  try {
                                    const res = await fetch(`/api/invoices/${inv.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                                    if (res.ok) {
                                      const data = await res.json();
                                      setDebtInfo(data);
                                      setPayAmount(data.balance.toString());
                                    } else {
                                      setPayAmount(inv.amount.toString());
                                    }
                                  } catch (err) {
                                    setPayAmount(inv.amount.toString());
                                  } finally {
                                    setLoadingDebt(false);
                                  }
                                }}
                              >
                                Registrar Cobro
                              </button>
                            )}
                            {inv.status === 'PENDING' && (
                              <button
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '0.6rem 1rem',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent)',
                                  fontSize: '0.85rem',
                                  textAlign: 'left',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  setActiveDropdown(null);
                                  setInvoiceToExpire(inv);
                                }}
                              >
                                Vencer
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

        </div>
        
        {/* Mobile View */}
        <div className="mobile-only mobile-card-list">
          {paginatedInvoices.map((inv) => (
            <div key={inv.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <div className="mobile-card-title" style={{fontFamily: 'monospace'}}>{inv.invoiceNumber}</div>
                <span className={`badge ${
                  inv.status === 'PAID' ? 'badge-active' :
                  inv.status === 'PENDING' ? 'badge-warning' :
                  inv.status === 'OVERDUE' ? 'badge-delinquent' : 'badge-cancelled'
                }`}>
                  {inv.status === 'PAID' ? 'Pagada' :
                   inv.status === 'PENDING' ? 'Pendiente' :
                   inv.status === 'OVERDUE' ? 'Vencida' : 'Anulada'}
                </span>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-row">
                  <div className="mobile-card-label">Cliente</div>
                  <div className="mobile-card-value" style={{fontWeight: 600}}>{inv.client.fullName}</div>
                </div>
                <div className="mobile-card-row">
                  <div className="mobile-card-label">Plan</div>
                  <div className="mobile-card-value">{inv.contract?.plan?.name || 'N/A'}</div>
                </div>
                <div className="mobile-card-row">
                  <div className="mobile-card-label">Monto</div>
                  <div className="mobile-card-value" style={{fontWeight: 'bold'}}>${Number(inv.amount).toLocaleString()} ARS</div>
                </div>
                <div className="mobile-card-row">
                  <div className="mobile-card-label">Vencimiento</div>
                  <div className="mobile-card-value">{new Date(inv.dueDate).toLocaleDateString('es-AR')}</div>
                </div>
              </div>
              <div className="mobile-card-footer" style={{flexWrap: 'wrap'}}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{flex: '1 1 auto', textAlign: 'center'}}
                  onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                >
                  Ver PDF
                </button>
                {userRole !== 'READONLY' && inv.status === 'PENDING' && (
                  <button 
                    className="btn btn-success btn-sm" 
                    style={{flex: '1 1 auto', textAlign: 'center', marginLeft: '0.5rem'}}
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setPayAmount(inv.amount.toString());
                      setReactivateOnPay(false);
                    }}
                  >
                    Pagada
                  </button>
                )}
                {userRole !== 'READONLY' && inv.status === 'PENDING' && (
                  <button 
                    className="btn btn-danger btn-sm" 
                    style={{flex: '1 1 auto', textAlign: 'center', marginLeft: '0.5rem'}}
                    onClick={() => setInvoiceToExpire(inv)}
                  >
                    Vencer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>


          <TablePagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setRowsPerPage}
          />
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setSelectedInvoice(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Registrar Cobro Manual</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Registrando cobro para la factura <strong>{selectedInvoice.invoiceNumber}</strong> de <strong>{selectedInvoice.client.fullName}</strong>.
            </p>

            <form onSubmit={handleRegisterPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body">
                {loadingDebt ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent)', margin: '0 auto' }} />
                    <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>Calculando saldo y recargos...</p>
                  </div>
                ) : (
                  <>
                    {debtInfo && (debtInfo.moraAmount > 0 || debtInfo.totalPayments > 0) && (
                      <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', borderLeft: '3px solid var(--accent)' }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Desglose de Deuda</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          <span>Monto Original:</span>
                          <span>${debtInfo.activeTotal} ARS</span>
                        </div>
                        {debtInfo.moraAmount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            <span>Interés por Mora ({debtInfo.daysLate} días):</span>
                            <span>${debtInfo.moraAmount} ARS</span>
                          </div>
                        )}
                        {debtInfo.totalPayments > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            <span>Pagos Anteriores:</span>
                            <span style={{ color: 'var(--color-success)' }}>-${debtInfo.totalPayments} ARS</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                          <span>Saldo a Pagar:</span>
                          <span>${debtInfo.balance} ARS</span>
                        </div>
                      </div>
                    )}
                    <FormAlert message={paymentFormError} />
                    <div className="form-group">
                      <label>Monto Recibido ($ ARS) *</label>
                  <input type="number" className={(!payAmount || parseFloat(payAmount) <= 0) && paymentFormError ? "input-error" : ""} value={payAmount} onChange={e => { setPayAmount(e.target.value); if (paymentFormError) setPaymentFormError(""); }} />
                </div>

                <div className="form-group">
                  <label>Método de Pago *</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} required>
                    <option value="TRANSFER">Transferencia Bancaria / CBU</option>
                    <option value="CASH">Efectivo</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Referencia / N° de Comprobante</label>
                  <input type="text" placeholder="Ej: Transf. 981242" value={payRef} onChange={e => setPayRef(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>Notas de Cobro</label>
                  <textarea rows={2} placeholder="Comentarios adicionales" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                </div>

                {selectedInvoice.contract?.status === 'SUSPENDED' && (
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.75rem',
                    border: '1px solid rgba(34,197,94,0.35)',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(34,197,94,0.08)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginBottom: '1rem'
                  }}>
                    <input
                      type="checkbox"
                      checked={reactivateOnPay}
                      onChange={(e) => setReactivateOnPay(e.target.checked)}
                    />
                    Reactivar servicio en MikroTik al registrar este pago
                  </label>
                )}
              </>
              )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedInvoice(null)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Procesando...
                    </>
                  ) : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* WhatsApp Onboarding Template Modal */}
      {isWhatsAppModalOpen && waInvoice && (
        <div className="modal-backdrop" onClick={() => setIsWhatsAppModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsWhatsAppModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Enviar Recordatorio por WhatsApp</h3>
            
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Revise y edite la plantilla de recordatorio y el número de contacto antes de abrir WhatsApp Web.
              </p>
              
              <div className="form-group">
                <label>Número de Destino (Formato Internacional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: 5491154567890" 
                  value={waPhone} 
                  onChange={e => setWaPhone(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Mensaje Personalizado</label>
                <textarea 
                  rows={6} 
                  value={waMessage} 
                  onChange={e => setWaMessage(e.target.value)} 
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ backgroundColor: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent)', padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                <strong>¿Cómo funciona?</strong> Al presionar "Enviar Mensaje", se abrirá una nueva pestaña redirigiendo a WhatsApp Web con el texto precargado para que el operador solo tenga que hacer clic en Enviar.
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsWhatsAppModalOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleSendWhatsApp}>
                <MessageSquare size={14} /> Enviar Mensaje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Digital Print Friendly Preview Modal */}
      {isInvoiceModalOpen && previewInvoice && (
        <div className="modal-backdrop" onClick={() => setIsInvoiceModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '750px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsInvoiceModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            
            <div className="modal-body invoice-print-container" id="invoice-print-area-billing">
              {/* Invoice Header */}
              <div className="grid invoice-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #000000', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', color: '#000000', fontSize: '1.75rem', fontWeight: 800 }}>JNSIX ISP</h2>
                  <span style={{ fontSize: '0.75rem', color: '#666666', display: 'block' }}>Red de Fibra Óptica FTTH</span>
                  <span style={{ fontSize: '0.75rem', color: '#666666', display: 'block' }}>CABA, Argentina • CUIT: 30-74125896-9</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ color: '#000000', fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Factura Digital</h4>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block' }}>{previewInvoice.invoiceNumber}</span>
                  <span style={{ fontSize: '0.75rem', color: '#666666', display: 'block' }}>Fecha de Emisión: {new Date(previewInvoice.issuedAt).toLocaleDateString()}</span>
                  <span style={{ fontSize: '0.75rem', color: '#666666', display: 'block' }}>Vencimiento: {new Date(previewInvoice.dueDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Client & Billing info */}
              <div className="grid invoice-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', fontSize: '0.82rem', borderBottom: '1px solid #dddddd', paddingBottom: '1rem' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', color: '#555555', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Cliente / Abonado</strong>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{previewInvoice.client.fullName}</span>
                  <span>DNI: {previewInvoice.client.dni}</span>
                </div>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', color: '#555555', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Detalles del Servicio</strong>
                  <span>Plan de Internet: {previewInvoice.contract?.plan?.name || 'Abono de Internet'}</span><br />
                  <span>Tecnología: FTTH (Fibra Óptica)</span>
                </div>
              </div>

              {/* Itemized Table */}
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#000000' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #000000' }}>
                      <th style={{ color: '#000000', backgroundColor: '#f5f5f5', fontSize: '0.72rem', padding: '0.5rem 1rem', fontWeight: 700 }}>Descripción del Concepto</th>
                      <th style={{ color: '#000000', backgroundColor: '#f5f5f5', fontSize: '0.72rem', padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 700 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #eeeeee' }}>
                      <td style={{ color: '#333333', padding: '1rem', fontSize: '0.85rem' }}>
                        Abono Mensual de Internet de Banda Ancha - Período Facturado
                      </td>
                      <td style={{ color: '#000000', padding: '1rem', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>
                        ${Number(previewInvoice.amount).toLocaleString()} ARS
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary and Payment instructions */}
              <div className="grid invoice-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', borderTop: '2px solid #000000', paddingTop: '1rem', fontSize: '0.8rem' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#555555' }}>Instrucciones de Pago:</strong>
                  <span>Realizar transferencia bancaria al CBU: <strong>0000003100012345678901</strong></span><br />
                  <span>Alias CBU: <strong>jnsix.isp.transfer</strong> • Banco: JNSIX S.A.</span><br />
                  <span style={{ fontSize: '0.72rem', color: '#666666', display: 'block', marginTop: '0.5rem' }}>
                    * Envíe el comprobante de transferencia al soporte administrativo para acreditar su cobro y mantener el estado activo en MikroTik.
                  </span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Subtotal:</span>
                    <span>${Number(previewInvoice.amount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>IVA (0% Exento):</span>
                    <span>$0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000000', paddingTop: '0.25rem', fontSize: '1.05rem', fontWeight: 800 }}>
                    <span>Total A Pagar:</span>
                    <span>${Number(previewInvoice.amount).toLocaleString()} ARS</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsInvoiceModalOpen(false)}>Cerrar</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  const printContent = document.getElementById('invoice-print-area-billing')?.innerHTML;
                  if (printContent) {
                    const style = document.createElement('style');
                    style.innerHTML = `
                      @media print {
                        body * { visibility: hidden; }
                        #print-container, #print-container * { visibility: visible; }
                        #print-container { position: absolute; left: 0; top: 0; width: 100%; }
                      }
                    `;
                    document.head.appendChild(style);
                    const container = document.createElement('div');
                    container.id = 'print-container';
                    container.innerHTML = printContent;
                    document.body.appendChild(container);
                    window.print();
                    document.body.removeChild(container);
                    document.head.removeChild(style);
                  }
                }}
              >
                <Printer size={14} /> Imprimir Recibo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Vencer Modal */}
      {invoiceToExpire && (
        <div className="modal-backdrop" onClick={() => setInvoiceToExpire(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button type="button" className="modal-close-btn" onClick={() => setInvoiceToExpire(null)} aria-label="Cerrar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="modal-body">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color="var(--color-danger)" /> Vencer Factura
              </h3>
              <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                ¿Está seguro de forzar el vencimiento de la factura <strong>{invoiceToExpire.invoiceNumber}</strong> del cliente <strong>{invoiceToExpire.client?.fullName}</strong>? Esta acción cambiará su estado a Vencida administrativamente.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setInvoiceToExpire(null)}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={() => {
                  const id = invoiceToExpire.id;
                  setInvoiceToExpire(null);
                  handleForceExpire(id);
                }}
              >
                Confirmar Vencimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
