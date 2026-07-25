// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Wifi, 
  WifiOff, 
  Plus, 
  FileText, 
  DollarSign, 
  Cpu,
  X,
  RefreshCw,
  MoreVertical,
  Radio,
  Printer,
  MessageSquare,
  Activity,
  MessageCircle,
  CheckCircle, Info, AlertTriangle, Unplug, Shuffle, Copy, Send, ShieldCheck, Edit, Trash2
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { Map, MapMarker, MarkerContent } from '../components/Map';
import MapPicker from '../components/MapPicker';
import FormAlert from '../components/FormAlert';

interface Plan { id: string; name: string; price: number; downloadSpeed: number; uploadSpeed: number; }
interface Node { id: string; name: string; mikrotikHost: string; }

interface Contract {
  id: string;
  planId: string;
  nodeId: string;
  billingDay: number;
  graceDays: number;
  pppoeUsername: string | null;
  pppoePassword: string | null;
  staticIp: string | null;
  macAddress: string | null;
  onuSerial: string | null;
  onuModel: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  plan: Plan;
  node: Node;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  debtInfo?: any;
  dueDate: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference: string | null;
}

const parseMigrationNotes = (notes: string | null) => {
  if (!notes) return null;
  const match = notes.match(/\[MIGRATION_METADATA\](.*?)\[MIGRATION_METADATA\]/);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      const cleanNotes = notes.replace(/\[MIGRATION_METADATA\].*?\[MIGRATION_METADATA\]/, '').trim();
      return { data, cleanNotes };
    } catch (e) {
      console.error('Error parsing migration metadata:', e);
    }
  }
  return null;
};

const getMetadataHeader = (notes: string | null): string => {
  if (!notes) return '';
  const match = notes.match(/^\[MIGRATION_METADATA\].*?\[MIGRATION_METADATA\]/);
  return match ? match[0] : '';
};

interface ClientDetailData {
  id: string;
  fullName: string;
  dni: string;
  clientCode: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  installationDate: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELINQUENT' | 'CANCELLED';
  notes: string | null;
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs?: any[];
}

interface ClientDetailProps {
  token: string;
  userRole: string;
}

const getClientDetailedStatus = (client: any) => {
  if (!client) return { label: 'Cargando...', sublabel: '', badgeClass: '', color: 'var(--text-muted)', iconColor: 'var(--text-muted)', description: '' };
  const isSuspended = client.contracts?.some((c: any) => c.status === 'SUSPENDED') || client.status === 'SUSPENDED';
  const hasUnpaidInvoices = client.invoices?.some((inv: any) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(inv.status));
  const hasOverdueInvoices = client.invoices?.some((inv: any) => inv.status === 'OVERDUE');

  if (isSuspended) {
    if (!hasUnpaidInvoices) {
      return {
        label: 'Suspendido - Pago al Día',
        sublabel: 'Pendiente reactivación',
        badgeClass: 'badge-suspended',
        color: '#f87171',
        iconColor: '#f87171',
        description: 'El cliente abonó sus facturas pero su servicio en MikroTik aún no fue reactivado. Requiere reactivación manual.'
      };
    } else {
      return {
        label: 'Suspendido - Con Deuda',
        sublabel: 'Corte por mora',
        badgeClass: 'badge-suspended',
        color: 'var(--accent)',
        iconColor: 'var(--accent)',
        description: 'Servicio suspendido en MikroTik y posee facturas vencidas o pendientes de pago.'
      };
    }
  } else {
    if (hasOverdueInvoices) {
      return {
        label: 'Activo - Vencido',
        sublabel: 'Tol. expirada',
        badgeClass: 'badge-warning',
        color: '#fbbf24',
        iconColor: '#fbbf24',
        description: 'El servicio está activo, pero posee facturas vencidas fuera de tolerancia. Apto para suspensión.'
      };
    } else if (hasUnpaidInvoices) {
      return {
        label: 'Activo - Pendiente',
        sublabel: 'Factura emitida',
        badgeClass: 'badge-delinquent',
        color: '#60a5fa',
        iconColor: '#60a5fa',
        description: 'El servicio está activo y posee una factura pendiente dentro del plazo de vencimiento.'
      };
    } else {
      return {
        label: 'Activo - Al Día',
        sublabel: 'Servicio normal',
        badgeClass: 'badge-active',
        color: 'var(--color-success)',
        iconColor: 'var(--color-success)',
        description: 'El servicio está activo y no posee deudas registradas.'
      };
    }
  }
};

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
  return diffs.length > 0 ? `Cambios: ${diffs.join(', ')}` : 'Sin cambios en campos principales';
};

const ClientDetail: React.FC<ClientDetailProps> = ({ token, userRole }) => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [client, setClient] = useState<ClientDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [routerActionLoading, setRouterActionLoading] = useState<'block' | 'unblock' | null>(null);
  
  // Modals / forms states
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');

  // Payment Annulment / Rectification / Invoice Edit Modal States
  const [isVoidPaymentModalOpen, setIsVoidPaymentModalOpen] = useState(false);
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('ERROR_TIPEO');
  const [voidNotes, setVoidNotes] = useState('');

  const [isRectifyPaymentModalOpen, setIsRectifyPaymentModalOpen] = useState(false);
  const [selectedPaymentForRectify, setSelectedPaymentForRectify] = useState<any | null>(null);
  const [rectifyAmount, setRectifyAmount] = useState('');
  const [rectifyMethod, setRectifyMethod] = useState('TRANSFER');
  const [rectifyDate, setRectifyDate] = useState('');
  const [rectifyReference, setRectifyReference] = useState('');
  const [rectifyNotes, setRectifyNotes] = useState('');
  const [rectifyInvoiceId, setRectifyInvoiceId] = useState('');
  const [rectifyReason, setRectifyReason] = useState('ERROR_TIPEO');
  const [rectifyObservaciones, setRectifyObservaciones] = useState('');

  const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<any | null>(null);
  const [editInvoiceDueDate, setEditInvoiceDueDate] = useState('');
  const [editInvoiceGraceDays, setEditInvoiceGraceDays] = useState('3');
  const [editInvoiceNotes, setEditInvoiceNotes] = useState('');
  const [editInvoiceReason, setEditInvoiceReason] = useState('ERROR_TIPEO');
  const [editInvoiceObservaciones, setEditInvoiceObservaciones] = useState('');
  const [editInvoiceItems, setEditInvoiceItems] = useState<any[]>([]);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemType, setNewItemType] = useState('ADJUSTMENT');

  // Edit client form fields
  const [editDni, setEditDni] = useState('');
  const [editClientCode, setEditClientCode] = useState('');
  const [generatingDni, setGeneratingDni] = useState(false);
  const generateTempDni = async () => {
    try {
      setGeneratingDni(true);
      const res = await fetch('/api/clients/generate-temp-dni', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEditDni(data.dni);
        if (editFormError) setEditFormError('');
      }
    } catch (e) {
      showToast('No se pudo generar el DNI temporal', 'warning');
    } finally {
      setGeneratingDni(false);
    }
  };
  const [editPhone1, setEditPhone1] = useState('');
  const [editPhone2, setEditPhone2] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editNotes, setEditNotes] = useState('');

  // Available plans and nodes lists for dropdowns
  const [plans, setPlans] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);

  // Contract modal form fields
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [graceDays, setGraceDays] = useState('3');
  const [pppoeUser, setPppoeUser] = useState('');
  const [pppoePass, setPppoePass] = useState('');
  const [staticIp, setStaticIp] = useState('');
  const [macAddr, setMacAddr] = useState('');
  const [onuSerial, setOnuSerial] = useState('');
  const [onuModel, setOnuModel] = useState('');

  const [editFormError, setEditFormError] = useState('');
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const generateClientCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await fetch('/api/clients/generate-code', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEditClientCode(data.code);
        if (editFormError) setEditFormError('');
      }
    } catch (e) {
      showToast('No se pudo generar el codigo', 'warning');
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyClientCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const shareCodeWhatsApp = (clientName: string, code: string, phone?: string | null) => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const msg = `Hola ${clientName}, te informamos que tu Codigo de Cliente para acceder al Portal de Autogestion es: *${code}*. Guardalo porque lo vas a necesitar para iniciar sesion y consultar tus facturas.`;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const [contractFormError, setContractFormError] = useState('');
  const [paymentFormError, setPaymentFormError] = useState('');
  const [confirmModalType, setConfirmModalType] = useState<'block' | 'unblock' | 'unblock-pay' | 'expire' | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Reactivation with debt flow
  const [reactivatedWithDebt, setReactivatedWithDebt] = useState(false);
  const [reactivateOnPay, setReactivateOnPay] = useState(false);
  // Sync status for detecting desface
  const [syncStatus, setSyncStatus] = useState<'SYNCED' | 'DELINQUENT_BUT_ACTIVE' | 'ACTIVE_BUT_SUSPENDED' | 'NO_CONTRACT' | null>(null);

  // Invoice pagination states
  const [invCurrentPage, setInvCurrentPage] = useState(1);
  const invRowsPerPage = 5;

  // WhatsApp Template Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [waInvoice, setWaInvoice] = useState<any | null>(null);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');

  // Invoice Print Preview Modal State
  const [isSyncInfoModalOpen, setIsSyncInfoModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);

  const [mobileTab, setMobileTab] = useState<'info' | 'network' | 'billing'>('info');

  // Diagnostics State
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<{
    mode?: string;
    onuSignal: number;
    onuStatus: string;
    txPower?: number;
    laserTemp?: number;
    voltage?: number;
    biasCurrent?: number;
    trafficRx: number;
    trafficTx: number;
    packetsRx?: number;
    packetsTx?: number;
    totalBytesRx?: number;
    totalBytesTx?: number;
    planLimitRx?: number;
    planLimitTx?: number;
    pppoeStatus: string;
    uptime: string;
    clientIp?: string;
    clientMac?: string;
    interfaceName?: string;
    queueName?: string;
    pingLatency?: number;
    pingLoss?: number;
    pingStatus?: string;
    firewallStatus?: string;
    onuSerial?: string;
    onuModel?: string;
    isMock: boolean;
  } | null>(null);
  const [isDiagActive, setIsDiagActive] = useState(false);

  const fetchSyncStatus = async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/clients/${id}/sync-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      setSyncStatus(data.syncStatus || null);
    } catch {
      setSyncStatus(null);
    }
  };

  const fetchClientData = async (_delayMs = 0, silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      setError('');
      const [clientRes, plansRes, nodesRes] = await Promise.all([
        fetch(`/api/clients/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/plans', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/nodes', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      if (!clientRes.ok) {
        const data = await clientRes.json().catch(() => ({}));
        throw new Error(data.error || 'Error cargando cliente');
      }

      setClient(await clientRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
      if (nodesRes.ok) setNodes(await nodesRes.json());
      await fetchSyncStatus();
    } catch (err: any) {
      setError(err.message || 'Error cargando cliente');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const startDiagnostics = async () => {
    if (!id) return;
    setIsDiagnosticsLoading(true);
    setIsDiagActive(true);
    try {
      const response = await fetch(`/api/clients/${id}/diagnostics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error obteniendo diagnostico');
      setDiagnosticsData(data);
    } catch (err: any) {
      showToast(err.message || 'No se pudo obtener el diagnostico', 'warning');
      setIsDiagActive(false);
    } finally {
      setIsDiagnosticsLoading(false);
    }
  };

  const stopDiagnostics = () => {
    setIsDiagActive(false);
  };

  const handleOpenWhatsAppModal = (invoice: Invoice) => {
    const balance = invoice.debtInfo?.balance || invoice.amount;
    const phone = client?.phone1?.replace(/[^0-9]/g, '') || '';
    setWaInvoice(invoice);
    setWaPhone(phone);
    setWaMessage(`Hola ${client?.fullName || ''}, te recordamos que tenes pendiente la factura ${invoice.invoiceNumber} por $${Number(balance).toLocaleString()} ARS. Podes regularizarla para mantener el servicio activo.`);
    setIsWhatsAppModalOpen(true);
  };

  const handleSendWhatsApp = () => {
    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
    setIsWhatsAppModalOpen(false);
  };

  useEffect(() => {
    fetchClientData();
  }, [id, token]);

  useEffect(() => {
    const editParam = new URLSearchParams(location.search).get('edit');
    if (!client || (editParam !== '1' && editParam !== 'true')) return;

    // Remove the query param to prevent re-opening on manual close
    navigate(`/clients/${id}`, { replace: true });

    if (userRole !== 'READONLY') {
      setEditFullName(client.fullName);
      setEditDni(client.dni);
      setEditClientCode(client.clientCode || '');
      setEditPhone1(client.phone1 || '');
      setEditPhone2(client.phone2 || '');
      setEditEmail(client.email || '');
      setEditAddress(client.address);
      setEditLatitude(client.latitude ? client.latitude.toString() : '');
      setEditLongitude(client.longitude ? client.longitude.toString() : '');
      setEditStatus(client.status);
      const migrationInfo = parseMigrationNotes(client.notes);
      setEditNotes(migrationInfo ? migrationInfo.cleanNotes : (client.notes || ''));
      setIsEditModalOpen(true);
    }
  }, [client, location.search, id, navigate, userRole]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setContractFormError('');
    if (!selectedPlanId || !selectedNodeId) {
      setContractFormError('Debe seleccionar un plan y un nodo para guardar el contrato.');
      return;
    }

    setSubmitting(true);
    showToast(editingContractId ? 'Actualizando contrato...' : 'Asignando contrato...', 'info');
    try {
      const url = editingContractId ? `/api/contracts/${editingContractId}` : '/api/contracts';
      const method = editingContractId ? 'PUT' : 'POST';
      const bodyData: any = {
        planId: selectedPlanId,
        nodeId: selectedNodeId,
        billingDay: parseInt(billingDay),
        graceDays: parseInt(graceDays),
        pppoeUsername: pppoeUser || null,
        pppoePassword: pppoePass || null,
        staticIp: staticIp || null,
        macAddress: macAddr || null,
        onuSerial: onuSerial || null,
        onuModel: onuModel || null,
      };

      if (!editingContractId) {
        bodyData.clientId = id;
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar contrato');
      }

      showToast(editingContractId ? 'Contrato actualizado con éxito' : 'Contrato guardado con éxito', 'success');
      setIsContractModalOpen(false);
      setEditingContractId(null);
      fetchClientData(0, true);
    } catch (err: any) {
      const errMsg = err.message || 'Error al guardar contrato';
      showToast(errMsg, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentFormError('');
    if (!selectedInvoice) {
      setPaymentFormError('Debe seleccionar una factura para pagar.');
      return;
    }
    if (!payAmount || parseFloat(payAmount) <= 0) {
      setPaymentFormError('Debe ingresar un monto válido a pagar.');
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
          invoiceId: selectedInvoice.id,
          amount: parseFloat(payAmount),
          paymentMethod: payMethod,
          reference: payRef || null,
          notes: payNotes || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar el pago');
      }

      // Si el usuario eligió reactivar al pagar, llamar al endpoint de desbloqueo
      if (reactivateOnPay) {
        try {
          await fetch(`/api/clients/${id}/unblock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          showToast('Pago registrado y servicio reactivado con éxito', 'success');
        } catch {
          showToast('Pago registrado. No se pudo reactivar automáticamente — hacelo manualmente.', 'warning');
        }
        setReactivateOnPay(false);
        setReactivatedWithDebt(false);
      } else {
        showToast('Pago registrado con éxito', 'success');
      }

      await fetchClientData(0, true);
      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
    } catch (err: any) {
      const errMsg = err.message || 'Error al registrar el pago';
      showToast(errMsg, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForVoid) return;
    if (!voidReason) {
      showToast('Debe ingresar un motivo para anular el cobro.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${selectedPaymentForVoid.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: voidReason,
          observaciones: voidNotes
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al anular pago');
      }
      showToast('Pago anulado con éxito', 'success');
      await fetchClientData(0, true);
      setIsVoidPaymentModalOpen(false);
      setSelectedPaymentForVoid(null);
      setVoidNotes('');
    } catch (err: any) {
      showToast(err.message, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRectifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForRectify) return;
    if (!rectifyReason) {
      showToast('Debe ingresar un motivo para rectificar el cobro.', 'warning');
      return;
    }
    if (!rectifyAmount || parseFloat(rectifyAmount) <= 0) {
      showToast('Debe ingresar un monto válido.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${selectedPaymentForRectify.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(rectifyAmount),
          paymentMethod: rectifyMethod,
          paymentDate: rectifyDate,
          reference: rectifyReference || null,
          notes: rectifyNotes || null,
          reason: rectifyReason,
          observaciones: rectifyObservaciones
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al rectificar pago');
      }
      showToast('Pago rectificado con éxito. Se generó un nuevo registro de reemplazo.', 'success');
      await fetchClientData(0, true);
      setIsRectifyPaymentModalOpen(false);
      setSelectedPaymentForRectify(null);
      setRectifyObservaciones('');
    } catch (err: any) {
      showToast(err.message, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForEdit) return;
    if (!editInvoiceReason) {
      showToast('Debe ingresar un motivo para modificar la factura.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceForEdit.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dueDate: editInvoiceDueDate,
          graceDays: parseInt(editInvoiceGraceDays),
          notes: editInvoiceNotes || null,
          reason: editInvoiceReason,
          observaciones: editInvoiceObservaciones
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al editar factura');
      }
      showToast('Factura modificada con éxito', 'success');
      await fetchClientData(0, true);
      setIsEditInvoiceModalOpen(false);
      setSelectedInvoiceForEdit(null);
      setEditInvoiceObservaciones('');
    } catch (err: any) {
      showToast(err.message, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddInvoiceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForEdit) return;
    if (!newItemDescription || !newItemAmount) {
      showToast('Complete la descripción y monto del concepto.', 'warning');
      return;
    }
    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceForEdit.id}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: newItemDescription,
          amount: parseFloat(newItemAmount),
          type: newItemType
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al agregar concepto');
      }
      showToast('Concepto agregado', 'success');
      setNewItemDescription('');
      setNewItemAmount('');
      
      const dataJson = await res.json();
      setEditInvoiceItems(prev => [...prev, dataJson.item]);
      
      await fetchClientData(0, true);
    } catch (err: any) {
      showToast(err.message, 'warning');
    }
  };

  const handleDeleteInvoiceItem = async (itemId: string) => {
    if (!selectedInvoiceForEdit) return;
    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceForEdit.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar concepto');
      }
      showToast('Concepto eliminado', 'success');
      setEditInvoiceItems(prev => prev.filter(item => item.id !== itemId));
      await fetchClientData(0, true);
    } catch (err: any) {
      showToast(err.message, 'warning');
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
      await fetchClientData(0, true);
    } catch (err: any) {
      showToast(err.message || 'Error al vencer factura', 'warning');
    } finally {
      setSelectedInvoice(null);
    }
  };

  const handleBlockAction = () => {
    setConfirmModalType('block');
  };

  const handleUnblockAction = () => {
    setConfirmModalType('unblock');
  };

  const runBlockAction = async () => {
    setRouterActionLoading('block');
    showToast('Enviando comando de bloqueo a MikroTik...', 'info');
    try {
      const response = await fetch(`/api/clients/${id}/block`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fallo de bloqueo');
      showToast('Servicio suspendido con éxito en MikroTik', 'success');
      await fetchClientData(0, true);
    } catch (err: any) {
      const errMsg = err.message || 'Error al suspender servicio';
      showToast(errMsg, 'warning');
    } finally {
      setRouterActionLoading(null);
    }
  };

  const runUnblockAction = async (openPaymentAfter = false) => {
    setRouterActionLoading('unblock');
    showToast('Enviando comando de reactivación a MikroTik...', 'info');
    try {
      const response = await fetch(`/api/clients/${id}/unblock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fallo de reactivación');
      showToast('Servicio reactivado con éxito en MikroTik', 'success');
      if (openPaymentAfter) {
        // Reactivar y Registrar Pago: abrir modal de pago con la primera factura impaga
        const freshRes = await fetch(`/api/clients/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          const unpaid = freshData.invoices?.find((inv: any) => ['PENDING','PARTIAL','OVERDUE'].includes(inv.status));
          if (unpaid) {
            setSelectedInvoice(unpaid);
            setPayAmount(String(unpaid.amount));
            setPayMethod('TRANSFER');
            setPayRef('');
            setPayNotes('');
            setReactivateOnPay(false);
            setIsPaymentModalOpen(true);
          }
        }
        setReactivatedWithDebt(false);
      } else {
        // Reactivar sin cobrar — activar banner persistente
        setReactivatedWithDebt(true);
      }
      await fetchClientData(0, true);
    } catch (err: any) {
      const errMsg = err.message || 'Error al reactivar servicio';
      showToast(errMsg, 'warning');
    } finally {
      setRouterActionLoading(null);
    }
  };
  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');

    const missing: string[] = [];
    if (!editFullName) missing.push('Nombre Completo');
    if (!editDni) missing.push('DNI');
    if (!editAddress) missing.push('Dirección');
    if (!editClientCode || !editClientCode.trim()) missing.push('Código de Cliente');

    if (missing.length > 0) {
      setEditFormError(`Los siguientes campos son requeridos: ${missing.join(', ')}. El Código de Cliente permite al cliente acceder al Portal de Autogestión — usá el botón "Generar" si no tenés uno a mano.`);
      return;
    }

    const latNum = editLatitude ? parseFloat(editLatitude) : null;
    const lngNum = editLongitude ? parseFloat(editLongitude) : null;

    if (latNum !== null && (isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setEditFormError('La latitud debe estar entre -90 y 90');
      return;
    }
    if (lngNum !== null && (isNaN(lngNum) || lngNum < -180 || lngNum > 180)) {
      setEditFormError('La longitud debe estar entre -180 y 180');
      return;
    }

    setSubmitting(true);
    showToast('Actualizando cliente...', 'info');
    try {
      const metaHeader = getMetadataHeader(client?.notes || '');
      const finalNotes = metaHeader ? `${metaHeader}${editNotes}` : editNotes;

      const response = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: editFullName,
          dni: editDni,
          clientCode: editClientCode,
          phone1: editPhone1 || null,
          phone2: editPhone2 || null,
          email: editEmail || null,
          address: editAddress,
          latitude: latNum,
          longitude: lngNum,
          status: editStatus,
          notes: finalNotes || null
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al actualizar cliente');

      // Optimistic UI Update: apply changes instantly
      setClient(prev => prev ? { ...prev, ...data } : null);

      showToast('Cliente actualizado con éxito', 'success');
      setIsEditModalOpen(false);
      fetchClientData(0, true);
    } catch (err: any) {
      const errMsg = err.message || 'Error actualizando cliente';
      setEditFormError(errMsg);
      showToast(errMsg, 'warning');
    } finally {
      setSubmitting(false);
    }
  };
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', color: 'var(--accent)', gap: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
      <RefreshCw size={48} className="animate-spin" style={{ filter: 'drop-shadow(0 0 8px var(--accent))' }} />
      <div style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '1px' }}>Cargando ficha del cliente...</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Obteniendo historial, contratos y pagos</div>
    </div>
  );

  if (error || !client) return (
    <div style={{ color: 'var(--color-danger)', padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <div>{error || 'Cliente no encontrado'}</div>
      <button className="btn btn-secondary" onClick={() => fetchClientData(0)} style={{ width: 'fit-content' }}>
        <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> Reintentar
      </button>
    </div>
  );

  const tieneUbicacion = client && client.latitude !== null && client.longitude !== null;
  const mapsUrl = client
    ? tieneUbicacion
      ? `https://www.google.com/maps?q=${client.latitude},${client.longitude}`
      : client.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`
      : null
    : null;

  // Pagination logic for invoices
  const totalInvoices = client?.invoices?.length || 0;
  const totalPagesInvoices = Math.ceil(totalInvoices / invRowsPerPage);
  const startIndexInvoices = (invCurrentPage - 1) * invRowsPerPage;
  const paginatedInvoices = client?.invoices?.slice(startIndexInvoices, startIndexInvoices + invRowsPerPage) || [];

  const hasUnpaidInvoices = client?.invoices?.some(inv => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(inv.status));
  const hasSuspendedContract = client?.contracts?.some(contract => contract.status === 'SUSPENDED');

  return (
    <div className="page-container">
      {/* Navigation */}
      <Link to="/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> Volver a Clientes
      </Link>

      {client && client.dni.startsWith('TEMP-') && (
        <div style={{
          backgroundColor: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid rgba(234, 179, 8, 0.45)',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertTriangle size={22} color="var(--color-warning)" />
          <div>
            <strong style={{ color: 'var(--color-warning)', display: 'block', marginBottom: '0.2rem', fontSize: '0.95rem' }}>Cliente con DNI Temporal</strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Este cliente fue registrado con un DNI temporal (<strong>{client.dni}</strong>) por falta de información. Recordá solicitarle el DNI definitivo y editar sus datos.
            </span>
          </div>
        </div>
      )}

      {reactivatedWithDebt && hasUnpaidInvoices && (
        <div style={{
          backgroundColor: 'rgba(249,115,22,0.12)',
          border: '1px solid rgba(249,115,22,0.4)',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={22} color="#f97316" />
            <div>
              <strong style={{ color: '#f97316', display: 'block', marginBottom: '0.2rem', fontSize: '0.95rem' }}><AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.3rem' }} /> Servicio Reactivado con Deuda Pendiente</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Se reactivó manualmente la navegación en MikroTik, pero el abonado tiene facturas impagas. Recordá cobrarle.
              </span>
            </div>
          </div>
          <button
            className="btn btn-warning btn-sm"
            style={{ backgroundColor: '#f97316', borderColor: '#f97316', color: '#fff', fontWeight: 600 }}
            onClick={() => {
              const unpaid = client?.invoices?.find(inv => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(inv.status));
              if (unpaid) {
                const balance = unpaid.debtInfo?.balance || unpaid.amount;
                setSelectedInvoice(unpaid);
                setPayAmount(String(balance));
                setPayMethod('TRANSFER');
                setPayRef('');
                setPayNotes('');
                setReactivateOnPay(false);
                setIsPaymentModalOpen(true);
              }
            }}
          >
            Registrar Pago Ahora
          </button>
        </div>
      )}

      {syncStatus === 'DELINQUENT_BUT_ACTIVE' && (
        <div style={{
          backgroundColor: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.45)',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={22} color="var(--color-warning)" />
            <div>
              <strong style={{ color: 'var(--color-warning)', display: 'block', marginBottom: '0.2rem', fontSize: '0.95rem' }}>Desfase de estado detectado</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                El cliente esta moroso en el sistema, pero sigue activo en MikroTik.
              </span>
            </div>
          </div>
          {userRole !== 'READONLY' && (
            <button
              className="btn btn-warning btn-sm"
              onClick={() => setConfirmModalType('unblock-pay')}
              disabled={routerActionLoading !== null}
            >
              Suspender Ahora
            </button>
          )}
        </div>
      )}

      {/* Educational description box */}
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Ficha del Abonado</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Esta sección detalla la ficha técnica del abonado. Aquí puede asignar planes de velocidad, 
          configurar las credenciales PPPoE o de IP fija del MikroTik, registrar datos físicos de la ONU 
          y registrar cobros de facturas. Use los botones de acción para forzar la suspensión o reactivación 
          del servicio del cliente en el router en tiempo real.
        </p>
      </div>

      {/* Mobile Tab Bar (Visible on mobile only, hidden on desktop) */}
      <div className="mobile-only" style={{ display: 'flex', border: '1px solid var(--border-color)', borderBottom: 'none', marginBottom: '1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
        <button 
          className="btn"
          onClick={() => setMobileTab('info')}
          style={{ 
            flex: 1, 
            padding: '0.85rem 0.5rem', 
            backgroundColor: mobileTab === 'info' ? 'var(--bg-tertiary)' : 'transparent', 
            border: 'none', 
            borderBottom: mobileTab === 'info' ? '3px solid var(--accent)' : '3px solid transparent', 
            color: mobileTab === 'info' ? '#ffffff' : 'var(--text-muted)', 
            fontSize: '0.78rem', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            borderRadius: 0, 
            transition: 'all 0.2s ease', 
            cursor: 'pointer' 
          }} 
        > 
          Ficha y Mapa 
        </button> 
        <button 
          className="btn" 
          onClick={() => setMobileTab('network')} 
          style={{
            flex: 1,
            padding: '0.85rem 0.5rem',
            backgroundColor: mobileTab === 'network' ? 'var(--bg-tertiary)' : 'transparent',
            border: 'none',
            borderBottom: mobileTab === 'network' ? '3px solid var(--accent)' : '3px solid transparent', 
            color: mobileTab === 'network' ? '#ffffff' : 'var(--text-muted)', 
            fontSize: '0.78rem', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            borderRadius: 0,
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
        >
          Contrato y Red
        </button>
        <button 
          className="btn"
          onClick={() => setMobileTab('billing')}
          style={{ 
            flex: 1, 
            padding: '0.85rem 0.5rem', 
            backgroundColor: mobileTab === 'billing' ? 'var(--bg-tertiary)' : 'transparent', 
            border: 'none', 
            borderBottom: mobileTab === 'billing' ? '3px solid var(--accent)' : '3px solid transparent', 
            color: mobileTab === 'billing' ? '#ffffff' : 'var(--text-muted)', 
            fontSize: '0.78rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            borderRadius: 0,
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
        >
          Facturas
        </button>
      </div>

      <div className={`grid grid-cols-3 ${mobileTab === 'info' ? '' : 'desktop-only'}`} style={{ gap: '2rem', marginBottom: '2rem', alignItems: 'start' }}>
        <div className="card col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="title-block" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Row 1: Name and ID */}
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{client.fullName}</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  DNI: {client.dni.startsWith('TEMP-') ? (
                    <span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>Temporal ({client.dni})</span>
                  ) : (
                    client.dni
                  )} • Código: {client.clientCode || 'N/A'} • ID: {client.id.slice(0,8)}
                </span>
              </div>
              
              {/* Row 2: Status Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className={`badge ${
                  client.status === 'ACTIVE' ? 'badge-active' :
                  client.status === 'SUSPENDED' ? 'badge-suspended' :
                  client.status === 'DELINQUENT' ? 'badge-delinquent' : 'badge-cancelled'
                }`}>
                  {client.status === 'ACTIVE' ? 'Activo' :
                   client.status === 'SUSPENDED' ? 'Suspendido' :
                   client.status === 'DELINQUENT' ? 'Moroso' : 'Cancelado'}
                </span>
                
                {(() => {
                  const contract = client.contracts?.find((c: any) => c.status !== 'CANCELLED');
                  if (!contract) return null;

                  const InfoButton = () => (
                    <button 
                      onClick={() => setIsSyncInfoModalOpen(true)}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.8, padding: 0, margin: 0 }}
                      title="¿Qué significa este estado?"
                    >
                      <Info size={14} />
                    </button>
                  );

                  const isUnconfigured = (!contract.pppoeUsername && !contract.staticIp && !contract.macAddress);

                  if (isUnconfigured) {
                    return (
                      <span className="badge badge-cancelled" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: 0.8 }}>
                        <Unplug size={14} /> Desvinculado del Router <InfoButton />
                      </span>
                    );
                  }

                  const isBlockedInMikrotik = contract.status === 'SUSPENDED';
                  const adminWantsBlocked = client.status === 'DELINQUENT' || client.status === 'SUSPENDED';

                  if (adminWantsBlocked && !isBlockedInMikrotik) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255, 193, 7, 0.15)', padding: '0 0.6rem', height: '24px', borderRadius: '4px', border: '1px solid var(--color-warning)', boxSizing: 'border-box' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textTransform: 'uppercase' }}><AlertTriangle size={14} /> Moroso pero ACTIVO en MikroTik <InfoButton /></span>
                        <button onClick={() => setConfirmModalType('unblock-pay')} className="btn btn-warning btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Suspender Ahora</button>
                      </div>
                    );
                  }
                  if (!adminWantsBlocked && isBlockedInMikrotik) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255, 152, 0, 0.15)', padding: '0 0.6rem', height: '24px', borderRadius: '4px', border: '1px solid #ff9800', boxSizing: 'border-box' }}>
                        <span style={{ fontSize: '0.72rem', color: '#ff9800', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textTransform: 'uppercase' }}><AlertTriangle size={14} /> Activo pero SUSPENDIDO en MikroTik <InfoButton /></span>
                        <button onClick={handleUnblockAction} className="btn btn-primary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Reactivar Ahora</button>
                      </div>
                    );
                  }

                  return (
                    <span className="badge badge-active" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'transparent', borderColor: 'var(--color-success)' }}>
                      <CheckCircle size={14} /> Sincronizado <InfoButton />
                    </span>
                  );
                })()}
              </div>

              {/* Row 3: Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {userRole !== 'READONLY' && (
                  <>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: '#25D366', color: '#25D366' }}
                      onClick={() => {
                        const portalUrl = window.location.origin + '/portal';
                        const message = `Hola ${client.fullName}, ya puedes ingresar a tu portal de autogestión para ver tus facturas y crear tickets técnicos en ${portalUrl}. Tu usuario es tu DNI y tu contraseña temporal también es tu DNI (${client.dni}).`;
                        const phone = client.phone1 ? client.phone1.replace(/\D/g, '') : '';
                        if (phone) {
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                        } else {
                          showToast('El cliente no tiene un teléfono registrado.', 'warning');
                        }
                      }}
                    >
                      <MessageCircle size={16} /> Enviar Accesos (WhatsApp)
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditFullName(client.fullName);
                        setEditDni(client.dni);
                        setEditClientCode(client.clientCode || '');
                        setEditPhone1(client.phone1 || '');
                        setEditPhone2(client.phone2 || '');
                        setEditEmail(client.email || '');
                        setEditAddress(client.address);
                        setEditLatitude(client.latitude ? client.latitude.toString() : '');
                        setEditLongitude(client.longitude ? client.longitude.toString() : '');
                        setEditStatus(client.status);
                        const migrationInfo = parseMigrationNotes(client.notes);
                        setEditNotes(migrationInfo ? migrationInfo.cleanNotes : (client.notes || ''));
                        setIsEditModalOpen(true);
                      }}
                    >
                      Editar Datos
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Teléfono principal:</span>
              <p style={{ fontWeight: 500 }}>{client.phone1 || 'No especificado'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Teléfono secundario:</span>
              <p style={{ fontWeight: 500 }}>{client.phone2 || 'No especificado'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email:</span>
              <p style={{ fontWeight: 500 }}>{client.email || 'No especificado'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fecha Instalación:</span>
              <p style={{ fontWeight: 500 }}>{client.installationDate ? new Date(client.installationDate).toLocaleDateString() : 'Desconocida'}</p>
            </div>
          </div>

          {/* ── Codigo de Cliente ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            background: 'var(--bg-secondary)', borderRadius: '10px', padding: '0.85rem 1rem',
            border: '1px solid var(--border-color)', gap: '1rem', flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Codigo de Cliente
                </span>
              </div>
              {client.clientCode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 800,
                    letterSpacing: '0.08em', color: 'var(--accent)',
                  }}>
                    {client.clientCode}
                  </span>
                  {/* Copy button */}
                  <button
                    onClick={() => copyClientCode(client.clientCode!)}
                    title={copiedCode ? 'Copiado!' : 'Copiar codigo'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                      background: copiedCode ? 'var(--color-success)' : 'var(--accent)',
                      color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 600,
                      transition: 'background 0.2s',
                    }}
                  >
                    <Copy size={13} />
                    {copiedCode ? 'Copiado!' : 'Copiar'}
                  </button>
                  {/* WhatsApp share button */}
                  <button
                    onClick={() => shareCodeWhatsApp(client.fullName, client.clientCode!, client.phone1)}
                    title="Enviar codigo al cliente por WhatsApp"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                      background: '#25D366', color: '#fff', border: 'none',
                      fontSize: '0.75rem', fontWeight: 600,
                    }}
                  >
                    <Send size={13} />
                    Enviar al cliente
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.9rem' }}>Sin codigo asignado</span>
                  {userRole !== 'READONLY' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditFullName(client.fullName); setEditDni(client.dni);
                        setEditClientCode(''); setEditPhone1(client.phone1 || '');
                        setEditPhone2(client.phone2 || ''); setEditEmail(client.email || '');
                        setEditAddress(client.address); setEditStatus(client.status);
                        setIsEditModalOpen(true);
                      }}
                      style={{ fontSize: '0.75rem' }}
                    >
                      Asignar codigo
                    </button>
                  )}
                </div>
              )}
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                El cliente usa este codigo para acceder al <strong>Portal de Autogestion</strong> y consultar sus facturas. Compartilo por WhatsApp para que lo guarde.
              </p>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dirección y Referencias:</span>
            <p style={{ fontWeight: 500 }}>{client.address}</p>
          </div>

          {(() => {
            const migrationInfo = parseMigrationNotes(client.notes);
            const displayNotes = migrationInfo ? migrationInfo.cleanNotes : client.notes;
            const activeContract = client.contracts && client.contracts[0];
            const showMigrationCard = migrationInfo && (
              !activeContract || 
              (activeContract.staticIp && activeContract.staticIp === migrationInfo.data.name) ||
              (activeContract.pppoeUsername && activeContract.pppoeUsername === migrationInfo.data.name)
            );
            
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 1. Normal client notes */}
                {displayNotes && (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '0px', borderLeft: '3px solid var(--accent)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      Observaciones / Notas del campo:
                    </span>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', margin: 0 }}>{displayNotes}</p>
                  </div>
                )}
                
                {/* 2. Graphical Match History Card */}
                {showMigrationCard && (
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderLeft: migrationInfo.data.matched ? '3px solid var(--color-success)' : '3px solid var(--accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    borderRadius: '0px'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Historial de Comparación de Migración (MikroTik Handshake)
                    </span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`badge ${migrationInfo.data.matched ? 'badge-active' : 'badge-suspended'}`} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                        {migrationInfo.data.matched 
                          ? `Coincidencia Auto-Detectada (${migrationInfo.data.confidence}%)` 
                          : 'Sin Coincidencia en MikroTik (0%)'
                        }
                      </span>
                    </div>

                    {migrationInfo.data.matched ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Método de Red:</span>
                          <div style={{ color: '#ffffff', fontWeight: 600 }}>{migrationInfo.data.type}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Identificador en Router:</span>
                          <div style={{ color: '#ffffff', fontWeight: 600 }}>
                            {migrationInfo.data.name}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 'normal', fontFamily: 'sans-serif', marginTop: '0.1rem' }}>
                              ({migrationInfo.data.type === 'StaticIP' ? 'IP' : 'Usuario'} de importacion historica, sin impacto tecnico)
                            </span>
                          </div>
                        </div>
                        {migrationInfo.data.comment && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Comentario en Router:</span>
                            <div style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{migrationInfo.data.comment}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                        Este abonado fue migrado sin una vinculación automática inicial con colas simples o sesiones MikroTik activas. La configuración técnica (IP/MAC o usuario PPPoE) se asignó manualmente o se configuró desde cero.
                      </p>
                    )}

                    <div style={{ 
                      fontSize: '0.72rem', 
                      color: 'var(--text-muted)', 
                      borderTop: '1px solid var(--border-color)', 
                      paddingTop: '0.5rem',
                      marginTop: '0.25rem',
                      lineHeight: 1.4
                    }}>
                      <strong>Nota de Auditoría:</strong> Los datos superiores indican la comparación inicial hecha al importar. Si el porcentaje era erróneo o "falso positivo", puedes reconfigurar las credenciales de red del contrato en la pestaña de Contratos.
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* MikroTik Manual Control Actions */}
          {userRole !== 'READONLY' && (
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={handleUnblockAction} 
                disabled={routerActionLoading !== null}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
              >
                {routerActionLoading === 'unblock' ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Wifi size={14} />
                )} 
                Reactivar en MikroTik
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={handleBlockAction} 
                disabled={routerActionLoading !== null}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
              >
                {routerActionLoading === 'block' ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <WifiOff size={14} />
                )} 
                Cortar Servicio
              </button>
            </div>
          )}
        </div>

        {/* GPS Location Map */}
        <div className="col-span-1" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Resumen de Situación y Movimientos */}
          <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={18} color="var(--accent)" /> Resumen de Situación
            </h3>

            {/* Estado de Situación */}
            {(() => {
              const detStatus = getClientDetailedStatus(client);
              return (
                <div style={{
                  padding: '1rem',
                  border: `1px solid ${detStatus.color}`,
                  borderRadius: '6px',
                  backgroundColor: `${detStatus.color}0a`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Situación Actual:
                    </span>
                    <span className={`badge ${detStatus.badgeClass}`} style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}>
                      {detStatus.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-main)', lineHeight: '1.4' }}>
                    {detStatus.description}
                  </p>
                </div>
              );
            })()}

            {/* Últimos Movimientos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Movimientos Recientes:
              </span>
              {client?.auditLogs && client.auditLogs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {client.auditLogs.map((log: any) => (
                    <div key={log.id} style={{
                      padding: '0.6rem 0.75rem',
                      borderLeft: '2px solid var(--border-color)',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      fontSize: '0.78rem',
                      lineHeight: '1.3'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '0.15rem' }}>
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                        <span style={{ fontWeight: 600 }}>{log.user?.fullName || 'Sistema'}</span>
                      </div>
                      <div style={{ color: 'var(--text-main)' }}>{log.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', border: '1px dashed var(--border-color)' }}>
                  No hay movimientos registrados recientemente.
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={18} color="var(--accent)" /> Ubicación Geográfica
            </h3>
            {client.latitude && client.longitude && !isNaN(Number(client.latitude)) && !isNaN(Number(client.longitude)) ? (
              <div className="map-container" style={{ flex: 1, minHeight: '300px', position: 'relative' }}>
                <Map
                  center={[Number(client.longitude), Number(client.latitude)]}
                  zoom={15}
                  className="w-full h-full"
                >
                  <MapMarker
                    longitude={Number(client.longitude)}
                    latitude={Number(client.latitude)}
                  >
                    <MarkerContent>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          backgroundColor: 'var(--accent)',
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                    </MarkerContent>
                  </MapMarker>
                </Map>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', padding: '2rem', textAlign: 'center', minHeight: '300px' }}>
                No hay coordenadas GPS guardadas para este cliente. Edite el cliente para agregar su ubicación.
              </div>
            )}
            
            {mapsUrl && (
              <a 
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                <MapPin size={14} /> Abrir en Google Maps
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Contracts Section */}
      <div className={`card ${mobileTab === 'network' ? '' : 'desktop-only'}`} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Contrato y Servicio Técnico</h3>
          {userRole !== 'READONLY' && (
            client.contracts.length === 0 ? (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => {
                  setEditingContractId(null);
                  setSelectedPlanId('');
                  setSelectedNodeId('');
                  setBillingDay('5');
                  setGraceDays('5');
                  setPppoeUser('');
                  setPppoePass('');
                  setStaticIp('');
                  setMacAddr('');
                  setOnuSerial('');
                  setOnuModel('VSOL XPON');
                  setIsContractModalOpen(true);
                }}
              >
                <Plus size={14} /> Asignar Contrato/Plan
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => {
                    const contract = client.contracts[0];
                    setEditingContractId(contract.id);
                    setSelectedPlanId(contract.planId);
                    setSelectedNodeId(contract.nodeId);
                    setBillingDay(contract.billingDay.toString());
                    setGraceDays(contract.graceDays.toString());
                    setPppoeUser(contract.pppoeUsername || '');
                    setPppoePass(contract.pppoePassword || '');
                    setStaticIp(contract.staticIp || '');
                    setMacAddr(contract.macAddress || '');
                    setOnuSerial(contract.onuSerial || '');
                    setOnuModel(contract.onuModel || 'VSOL XPON');
                    setIsContractModalOpen(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Edit size={14} /> Modificar Contrato
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={async () => {
                    const contract = client.contracts[0];
                    if (window.confirm('¿Está seguro de que desea eliminar el contrato de este cliente? Esta acción también detendrá la automatización en MikroTik.')) {
                      setSubmitting(true);
                      showToast('Eliminando contrato...', 'info');
                      try {
                        const response = await fetch(`/api/contracts/${contract.id}`, {
                          method: 'DELETE',
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });
                        if (!response.ok) {
                          const data = await response.json();
                          throw new Error(data.error || 'Error al eliminar contrato');
                        }
                        showToast('Contrato eliminado con éxito', 'success');
                        fetchClientData(0, true);
                      } catch (err: any) {
                        showToast(err.message || 'Error al eliminar contrato', 'warning');
                      } finally {
                        setSubmitting(false);
                      }
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                >
                  <Trash2 size={14} /> Eliminar Contrato
                </button>
              </div>
            )
          )}
        </div>

        {client.contracts.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '1.5rem', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
            Este cliente no tiene ningún servicio contratado asignado.
          </div>
        ) : (
          client.contracts.map((contract) => (
            <div key={contract.id} className="grid grid-cols-3" style={{ gap: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '8px' }}>
              <div>
                <h4 style={{ color: 'var(--accent)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Plan: {contract.plan.name}</h4>
                <p style={{ fontSize: '0.9rem' }}>Precio mensual: <strong>${Number(contract.plan.price).toLocaleString()} ARS</strong></p>
                <p style={{ fontSize: '0.9rem' }}>Velocidad: Bajada: {contract.plan.downloadSpeed} Mbps / Subida: {contract.plan.uploadSpeed} Mbps</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Día de cobro: <strong>Día {contract.billingDay} de cada mes</strong></p>
                <p style={{ fontSize: '0.9rem' }}>Días de gracia: {contract.graceDays} días</p>
              </div>

              <div>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Cpu size={16} /> Router y Red (MikroTik)
                </h4>
                <p style={{ fontSize: '0.9rem' }}>Nodo asignado: {contract.node.name}</p>
                {contract.pppoeUsername ? (
                  <>
                    <p style={{ fontSize: '0.9rem' }}>Modo: <strong>PPPoE Secret</strong></p>
                    <p style={{ fontSize: '0.9rem' }}>
                      Usuario: <code style={{ color: 'var(--accent)' }}>{contract.pppoeUsername}</code>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.1rem' }}>
                        (Usuario operativo activo utilizado para cortes y reconexiones)
                      </span>
                    </p>
                    <p style={{ fontSize: '0.9rem' }}>Contraseña: <code>{contract.pppoePassword}</code></p>
                  </>
                ) : contract.staticIp ? (
                  <>
                    <p style={{ fontSize: '0.9rem' }}>Modo: <strong>IP Estática / Address List</strong></p>
                    <p style={{ fontSize: '0.9rem' }}>
                      IP: <code style={{ color: 'var(--accent)' }}>{contract.staticIp}</code>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.1rem' }}>
                        (IP operativa activa utilizada para cortes y reconexiones)
                      </span>
                    </p>
                    {contract.macAddress && <p style={{ fontSize: '0.9rem' }}>MAC: <code>{contract.macAddress}</code></p>}
                  </>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-warning)' }}>Advertencia: Sin configurar en el router</p>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Equipamiento FTH (ONU V-SOL)</h4>
                <p style={{ fontSize: '0.9rem' }}>Modelo ONU: {contract.onuModel || 'XPON ONU Standard'}</p>
                <p style={{ fontSize: '0.9rem' }}>Número Serial: <code>{contract.onuSerial || 'Sin registrar'}</code></p>
                <div style={{ marginTop: '1rem' }}>
                  <span className={`badge ${contract.status === 'ACTIVE' ? 'badge-active' : 'badge-suspended'}`}>
                    Línea: {contract.status === 'ACTIVE' ? 'Habilitada' : 'Suspendida'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Network Diagnostics Panel */}
      <div className={`card ${mobileTab === 'network' ? '' : 'desktop-only'}`} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Radio size={18} color="var(--accent)" /> Diagnóstico Técnico Avanzado en Vivo
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isDiagActive ? (
              <button 
                className="btn btn-primary btn-sm"
                onClick={startDiagnostics}
                disabled={isDiagnosticsLoading}
              >
                {isDiagnosticsLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Conectando...
                  </>
                ) : (
                  'Iniciar Diagnóstico Técnico'
                )}
              </button>
            ) : (
              <button 
                className="btn btn-danger btn-sm"
                onClick={stopDiagnostics}
              >
                Detener Monitoreo
              </button>
            )}
          </div>
        </div>

        {!diagnosticsData && !isDiagnosticsLoading && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Haga clic en el botón para iniciar un barrido completo de diagnóstico. El sistema establecerá una conexión directa con el router MikroTik y OLT para interrogar parámetros físicos de fibra óptica, volumen de transferencia, estado de la sesión lógica, configuración del Firewall y pruebas de latencia ICMP.
          </p>
        )}

        {isDiagnosticsLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2.5rem 0' }}>
            <RefreshCw size={28} className="animate-spin" color="var(--accent)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              [apiROS] Estableciendo socket API... Consultando interfaces activas y registros GPON...
            </span>
          </div>
        )}

        {diagnosticsData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            {/* Top row: 3 technical columns */}
            <div className="grid grid-cols-3" style={{ gap: '1.5rem' }}>
              
              {/* OLT Optical Signal Card */}
              <div style={{ border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Atenuación Óptica (OLT GPON)
                  </span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.4rem', border: '1px solid var(--border-color)' }}>
                    Rx Power
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <span style={{ 
                    fontSize: '2.25rem', 
                    fontWeight: 700, 
                    fontFamily: 'monospace', 
                    color: diagnosticsData.onuStatus === 'GOOD' 
                      ? 'var(--color-success)' 
                      : diagnosticsData.onuStatus === 'WARNING'
                      ? 'var(--color-warning)'
                      : 'var(--accent)' 
                  }}>
                    {diagnosticsData.onuSignal}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>dBm</span>
                </div>

                {/* Micro visual indicator */}
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${Math.max(5, Math.min(100, ((diagnosticsData.onuSignal + 40) / 25) * 100))}%`, 
                    height: '100%', 
                    backgroundColor: diagnosticsData.onuStatus === 'GOOD' 
                      ? 'var(--color-success)' 
                      : diagnosticsData.onuStatus === 'WARNING'
                      ? 'var(--color-warning)'
                      : 'var(--accent)',
                    transition: 'width 0.5s ease' 
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600 }}>
                  <span style={{ 
                    color: diagnosticsData.onuStatus === 'GOOD' 
                      ? 'var(--color-success)' 
                      : diagnosticsData.onuStatus === 'WARNING'
                      ? 'var(--color-warning)'
                      : 'var(--accent)',
                    textTransform: 'uppercase' 
                  }}>
                    {diagnosticsData.onuStatus === 'GOOD' 
                      ? 'Enlace Óptimo' 
                      : diagnosticsData.onuStatus === 'WARNING'
                      ? 'Atenuación Alta' 
                      : diagnosticsData.onuStatus === 'CRITICAL'
                      ? 'Crítico / Fibra Rota'
                      : 'No Aprovisionado'}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>Márgenes: -15 a -25 dBm</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>ONU Serial:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{diagnosticsData.onuSerial || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Modelo ONU:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{diagnosticsData.onuModel || 'XPON Standard'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Potencia TX ONU:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>{diagnosticsData.txPower !== undefined ? `${diagnosticsData.txPower} dBm` : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Temp. Láser:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>{diagnosticsData.laserTemp !== undefined ? `${diagnosticsData.laserTemp} °C` : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Voltaje ONU:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>{diagnosticsData.voltage !== undefined ? `${diagnosticsData.voltage} V` : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Corriente Bias:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>{diagnosticsData.biasCurrent !== undefined ? `${diagnosticsData.biasCurrent} mA` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* PPPoE / Static Session Card */}
              <div style={{ border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sesión Lógica (MikroTik)
                  </span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.4rem', border: '1px solid var(--border-color)' }}>
                    {diagnosticsData.mode || 'N/A'}
                  </span>
                </div>

                <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: diagnosticsData.pppoeStatus === 'CONNECTED' || diagnosticsData.pppoeStatus === 'ACTIVE_ARP' ? 'var(--color-success)' : 'var(--accent)', marginTop: '0.2rem' }}>
                  {diagnosticsData.pppoeStatus === 'CONNECTED' ? 'CONNECTED_PPPOE' :
                   diagnosticsData.pppoeStatus === 'ACTIVE_ARP' ? 'ACTIVE_ARP_ROUTING' :
                   diagnosticsData.pppoeStatus === 'BLOCKED_FIREWALL' ? 'BLOCKED_FIREWALL_ACL' : 'SESSION_DOWN'}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.48rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Uptime de Sesión:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>{diagnosticsData.uptime}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Dirección IP:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-success)' }}>{diagnosticsData.clientIp || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Dirección MAC:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>{diagnosticsData.clientMac || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Interfaz física/vlan:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{diagnosticsData.interfaceName || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nombre de Queue:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{diagnosticsData.queueName || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Estado Firewall:</span>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontWeight: 700, 
                      color: diagnosticsData.firewallStatus === 'CLEAN' ? 'var(--color-success)' : 'var(--accent)'
                    }}>{diagnosticsData.firewallStatus || 'CLEAN'}</span>
                  </div>
                </div>
              </div>

              {/* Bandwidth Monitor Card */}
              <div style={{ border: '1px solid var(--border-color)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tráfico / Simple Queue
                  </span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.4rem', border: '1px solid var(--border-color)' }}>
                    Bps Monitor
                  </span>
                </div>

                {/* Progress bars & speed limits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.1rem' }}>
                  
                  {/* Download */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Descarga (Rx):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                        {diagnosticsData.trafficRx} / {diagnosticsData.planLimitRx || 50} Mbps
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)' }}>
                      <div style={{ 
                        width: `${Math.min(100, (diagnosticsData.trafficRx / (diagnosticsData.planLimitRx || 50)) * 100)}%`, 
                        height: '100%', 
                        backgroundColor: 'var(--color-success)', 
                        transition: 'width 0.5s ease' 
                      }} />
                    </div>
                  </div>

                  {/* Upload */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Subida (Tx):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                        {diagnosticsData.trafficTx} / {diagnosticsData.planLimitTx || 10} Mbps
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)' }}>
                      <div style={{ 
                        width: `${Math.min(100, (diagnosticsData.trafficTx / (diagnosticsData.planLimitTx || 10)) * 100)}%`, 
                        height: '100%', 
                        backgroundColor: 'var(--accent)', 
                        transition: 'width 0.5s ease' 
                      }} />
                    </div>
                  </div>

                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Paquetes Bajada:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>
                      {diagnosticsData.packetsRx !== undefined ? `${diagnosticsData.packetsRx.toLocaleString()} p/s` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Paquetes Subida:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff' }}>
                      {diagnosticsData.packetsTx !== undefined ? `${diagnosticsData.packetsTx.toLocaleString()} p/s` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Volumen Total Rx:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-success)' }}>
                      {diagnosticsData.totalBytesRx !== undefined ? `${diagnosticsData.totalBytesRx.toLocaleString()} GB` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Volumen Total Tx:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>
                      {diagnosticsData.totalBytesTx !== undefined ? `${diagnosticsData.totalBytesTx.toLocaleString()} GB` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Ping test results */}
            <div style={{ border: '1px solid var(--border-color)', padding: '1rem 1.25rem', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Activity size={14} color="var(--accent)" /> Prueba de Latencia & Pérdida (Ping de Router a Cliente)
                </span>
                <span style={{ 
                  fontSize: '0.72rem', 
                  fontFamily: 'monospace', 
                  fontWeight: 700,
                  color: diagnosticsData.pingStatus === 'EXCELLENT' 
                    ? 'var(--color-success)' 
                    : diagnosticsData.pingStatus === 'WARNING' 
                    ? 'var(--color-warning)' 
                    : 'var(--accent)'
                }}>
                  {diagnosticsData.pingStatus || 'OFFLINE'}
                </span>
              </div>

              <div className="grid grid-cols-4 ping-grid" style={{ gap: '1.5rem', marginTop: '0.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Latencia Promedio</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: '#ffffff' }}>
                    {diagnosticsData.pingLatency !== undefined ? `${diagnosticsData.pingLatency} ms` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Pérdida de Paquetes</span>
                  <span style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 700, 
                    fontFamily: 'monospace', 
                    color: diagnosticsData.pingLoss === 0 ? 'var(--color-success)' : 'var(--accent)' 
                  }}>
                    {diagnosticsData.pingLoss !== undefined ? `${diagnosticsData.pingLoss} %` : 'N/A'}
                  </span>
                </div>
                <div className="col-span-2" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Estabilidad del Enlace</span>
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-tertiary)', position: 'relative' }}>
                    {diagnosticsData.pingLoss === 0 ? (
                      <div style={{ 
                        position: 'absolute', 
                        left: 0, 
                        width: `${Math.max(10, 100 - (diagnosticsData.pingLatency || 12))}%`, 
                        height: '100%', 
                        backgroundColor: 'var(--color-success)' 
                      }} />
                    ) : (
                      <div style={{ position: 'absolute', left: 0, width: `${100 - (diagnosticsData.pingLoss || 0)}%`, height: '100%', backgroundColor: 'var(--accent)' }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Diagnostics Step Guide */}
        <div style={{ marginTop: '1rem', backgroundColor: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent)', padding: '0.75rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Guía de Interpretación Operativa
          </span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            <strong>1. Capa Física (OLT):</strong> Inspeccione la atenuación en dBm. Valores entre -15 y -25 dBm aseguran transmisión de datos libre de errores. Si la señal excede los -27 dBm, la fibra sufre atenuación severa por curvatura excesiva o conectores sucios.<br />
            <strong>2. Capa de Red (MikroTik):</strong> Confirme que el estado sea <code>CONNECTED_PPPOE</code> o <code>ACTIVE_ARP_ROUTING</code>. Si el cliente está pagado pero no establece sesión, el problema está localizado en el router del domicilio (falta de corriente o desconfiguración).<br />
            <strong>3. Calidad e Inyección ICMP:</strong> La prueba de latencia (Ping) mide la estabilidad del enlace inalámbrico/cableado final. Latencias menores a 20ms garantizan excelente experiencia en llamadas y juegos. La pérdida de paquetes indica saturación física o interferencias.
          </p>
        </div>
      </div>

      {/* Cuenta Corriente (Ledger) section */}
      <div className={`grid grid-cols-1 ${mobileTab === 'billing' ? '' : 'desktop-only'}`} style={{ gap: '2rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileText size={18} color="var(--accent)" /> Cuenta Corriente (Mes a Mes)
          </h3>
          {client.invoices.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
              No hay movimientos en la cuenta corriente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {paginatedInvoices.map((invoice) => {
                const debtInfo = invoice.debtInfo;
                if (!debtInfo) return null;
                return (
                <div key={invoice.id} style={{ display: 'flex', flexDirection: 'column', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  
                  {/* Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block', color: 'var(--text-main)' }}>Período: {new Date(invoice.periodStart).toLocaleDateString(undefined, {month: 'long', year: 'numeric'}).toUpperCase()}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Factura: {invoice.invoiceNumber} | Vence: {new Date(invoice.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${
                        invoice.status === 'PAID' ? 'badge-active' :
                        invoice.status === 'PARTIAL' ? 'badge-warning' :
                        invoice.status === 'PENDING' ? 'badge-delinquent' : 'badge-suspended'
                      }`}>
                        {invoice.status === 'PAID' ? 'Pagada' :
                         invoice.status === 'PARTIAL' ? 'Pago Parcial' :
                         invoice.status === 'PENDING' ? 'Pendiente' : 'Vencida'}
                      </span>
                    </div>
                  </div>

                  {/* Ledger Breakdown */}
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                    
                    {/* Cargos */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                      <span>Abono Base</span>
                      <span>${Number(debtInfo.activeTotal).toLocaleString()}</span>
                    </div>
                    
                    {debtInfo.moraAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--color-warning)' }}>
                        <span>Mora por atraso ({debtInfo.daysLate} días)</span>
                        <span>+ ${Number(debtInfo.moraAmount).toLocaleString()}</span>
                      </div>
                    )}

                    {/* Pagos */}
                    {debtInfo.totalPayments > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--color-success)' }}>
                        <span>Pagos Registrados</span>
                        <span>- ${Number(debtInfo.totalPayments).toLocaleString()}</span>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }}></div>

                    {/* Saldo Final */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: debtInfo.balance > 0 ? 'var(--accent)' : 'var(--color-success)' }}>
                      <span>Saldo Pendiente del Mes</span>
                      <span>${Number(debtInfo.balance).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => handleOpenWhatsAppModal(invoice)}
                    >
                      WhatsApp
                    </button>
                    {userRole !== 'READONLY' && (
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        onClick={() => {
                          setSelectedInvoiceForEdit(invoice);
                          setEditInvoiceDueDate(new Date(invoice.dueDate).toISOString().split('T')[0]);
                          setEditInvoiceGraceDays(invoice.contract?.graceDays?.toString() || '3');
                          setEditInvoiceNotes(invoice.notes || '');
                          setEditInvoiceReason('ERROR_TIPEO');
                          setEditInvoiceObservaciones('');
                          setEditInvoiceItems(invoice.items || []);
                          setIsEditInvoiceModalOpen(true);
                        }}
                      >
                        Modificar Factura
                      </button>
                    )}
                    {invoice.status !== 'PAID' && (
                      <>
                        {(invoice.status === 'PENDING' || invoice.status === 'PARTIAL') && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setConfirmModalType('expire');
                            }}
                          >
                            Vencer
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setPayAmount(debtInfo.balance.toString());
                            setReactivateOnPay(false);
                            setIsPaymentModalOpen(true);
                          }}
                        >
                          Registrar Pago
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )})}
              
              {/* Pagination */}
              {totalInvoices > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{startIndexInvoices + 1}-{Math.min(startIndexInvoices + invRowsPerPage, totalInvoices)} de {totalInvoices}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setInvCurrentPage(prev => Math.max(prev - 1, 1))} disabled={invCurrentPage === 1}>Ant.</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setInvCurrentPage(prev => Math.min(prev + 1, totalPagesInvoices))} disabled={invCurrentPage === totalPagesInvoices}>Sig.</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payments Card */}
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <DollarSign size={18} color="var(--color-success)" /> Pagos Recibidos
          </h3>
          {client.payments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
              No se han registrado pagos para este cliente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {client.payments.map((pay) => {
                const isVoided = pay.deletedAt !== null;
                const isReplacement = client.payments.find(p => p.replacedById === pay.id);

                const getReasonLabelLocal = (reason: string) => {
                  switch (reason) {
                    case 'ERROR_TIPEO': return 'Error de Tipeo';
                    case 'ANULACION': return 'Anulación';
                    case 'EDICION_MONTO': return 'Edición de Monto';
                    case 'OTRO': return 'Otro';
                    default: return reason;
                  }
                };

                return (
                  <div 
                    key={pay.id} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '0.5rem',
                      padding: '0.75rem', 
                      backgroundColor: isVoided ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', 
                      borderRadius: '6px',
                      border: isVoided ? '1px dashed var(--border-color)' : '1px solid transparent',
                      opacity: isVoided ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isVoided ? 'var(--text-muted)' : 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          Pago registrado • {new Date(pay.paymentDate).toLocaleDateString()}
                          {isVoided && (
                            <span className="badge badge-delinquent" style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>
                              {pay.replacedById ? 'RECTIFICADO' : 'ANULADO'}
                            </span>
                          )}
                          {!isVoided && isReplacement && (
                            <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: 'var(--color-success)', color: '#fff' }}>
                              CORREGIDO
                            </span>
                          )}
                        </span>
                        
                        {/* Info details */}
                        {(pay.reference || pay.notes) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {pay.reference && <div style={{ marginBottom: '0.1rem' }}><strong style={{ color: '#aaa' }}>Ref/Comprobante:</strong> {pay.reference}</div>}
                            {pay.notes && <div><strong style={{ color: '#aaa' }}>Notas:</strong> {pay.notes}</div>}
                          </div>
                        )}

                        {/* Audit Details for Voided or Replaced Payments */}
                        {isVoided && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', padding: '0.3rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                            <div><strong style={{ color: '#ccc' }}>Motivo:</strong> {getReasonLabelLocal(pay.voidReason)}</div>
                            {pay.voidNotes && <div><strong style={{ color: '#ccc' }}>Observaciones:</strong> {pay.voidNotes}</div>}
                            {pay.replacedBy && (
                              <div style={{ color: 'var(--color-success)', marginTop: '0.1rem' }}>
                                - Reemplazado por nuevo cobro de ${Number(pay.replacedBy.amount).toLocaleString()} (N° Factura: {pay.replacedBy.invoice?.invoiceNumber})
                                <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.15rem', fontStyle: 'italic' }}>
                                  {getDiffDescription(pay, pay.replacedBy)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Link to Predecessor if this is a Correction */}
                        {!isVoided && isReplacement && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', padding: '0.3rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                            <span style={{ color: 'var(--accent)' }}>
                              Corrige cobro anterior anulado de ${Number(isReplacement.amount).toLocaleString()} (Motivo: {getReasonLabelLocal(isReplacement.voidReason)})
                              <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.15rem', fontStyle: 'italic' }}>
                                {getDiffDescription(isReplacement, pay)}
                              </div>
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: isVoided ? 'var(--text-muted)' : 'var(--color-success)', textDecoration: isVoided ? 'line-through' : 'none' }}>
                          + ${Number(pay.amount).toLocaleString()}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {pay.paymentMethod === 'TRANSFER' ? 'Transferencia' : 
                           pay.paymentMethod === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Efectivo'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons for active payments */}
                    {!isVoided && userRole !== 'READONLY' && (
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.25rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedPaymentForRectify(pay);
                            setRectifyAmount(pay.amount.toString());
                            setRectifyMethod(pay.paymentMethod);
                            setRectifyDate(pay.paymentDate.split('T')[0]);
                            setRectifyReference(pay.reference || '');
                            setRectifyNotes(pay.notes || '');
                            setRectifyInvoiceId(pay.invoiceId);
                            setRectifyReason('ERROR_TIPEO');
                            setRectifyObservaciones('');
                            setIsRectifyPaymentModalOpen(true);
                          }}
                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderColor: 'var(--accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Edit size={10} /> Rectificar
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedPaymentForVoid(pay);
                            setVoidReason('ANULACION');
                            setVoidNotes('');
                            setIsVoidPaymentModalOpen(true);
                          }}
                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Trash2 size={10} /> Anular
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contract Creation Modal */}
      {isContractModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsContractModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsContractModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Asignar Plan y Configuración MikroTik</h3>
            <form onSubmit={handleCreateContract} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body">
                <FormAlert message={contractFormError} />
                <div className="form-group">
                  <label>Plan Contratado *</label>
                  <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} required>
                    <option value="">Seleccione un plan</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} - ${Number(p.price).toLocaleString()} ARS</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Nodo MikroTik de Conexión *</label>
                  <select value={selectedNodeId} onChange={e => setSelectedNodeId(e.target.value)} required>
                    <option value="">Seleccione un nodo</option>
                    {nodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.mikrotikHost})</option>)}
                  </select>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem' }} />
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Configuración de Bloqueo (Rellene solo una de las dos)</h4>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent)' }}>Opción A: Autenticación PPPoE</div>
                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label>Usuario PPPoE</label>
                      <input type="text" placeholder="Ej: nahuel_pppoe" value={pppoeUser} onChange={e => setPppoeUser(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Contraseña PPPoE</label>
                      <input type="text" placeholder="Ej: secret123" value={pppoePass} onChange={e => setPppoePass(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent)' }}>Opción B: IP Estática (Address List)</div>
                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label>Dirección IP Fija</label>
                      <input type="text" placeholder="Ej: 192.168.10.45" value={staticIp} onChange={e => setStaticIp(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Dirección MAC</label>
                      <input type="text" placeholder="Ej: 00:1A:2B:3C:4D:5E" value={macAddr} onChange={e => setMacAddr(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem' }} />
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Ficha de Instalación Física</h4>

                <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label>Número de Serie ONU (VSOL/BT)</label>
                    <input type="text" placeholder="Serial GPON/EPON" value={onuSerial} onChange={e => setOnuSerial(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Modelo ONU</label>
                    <select value={onuModel} onChange={e => setOnuModel(e.target.value)}>
                      <option value="VSOL XPON">VSOL XPON (4GE+WiFi)</option>
                      <option value="BT-226XR 1GE">BT-226XR 1GE XPON</option>
                      <option value="Otro / Bridge">Otro / Genérico</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label>Día de Cobro Mensual (1-31)</label>
                    <input type="number" min="1" max="31" value={billingDay} onChange={e => setBillingDay(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Días de Gracia de Corte</label>
                    <input type="number" min="0" max="30" value={graceDays} onChange={e => setGraceDays(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsContractModalOpen(false)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Guardando...
                    </>
                  ) : 'Guardar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="modal-backdrop" onClick={() => { setIsPaymentModalOpen(false); setSelectedInvoice(null); setReactivateOnPay(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => { setIsPaymentModalOpen(false); setSelectedInvoice(null); setReactivateOnPay(false); }} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Registrar Cobro Manual</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Registrando cobro para la factura <strong>{selectedInvoice.invoiceNumber}</strong> por un total de ${Number(selectedInvoice.amount).toLocaleString()} ARS.
            </p>

            <form onSubmit={handleRegisterPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body">
                {selectedInvoice?.debtInfo && (selectedInvoice.debtInfo.moraAmount > 0 || selectedInvoice.debtInfo.totalPayments > 0) && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', borderLeft: '3px solid var(--accent)' }}>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Desglose de Deuda</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <span>Monto Original:</span>
                      <span>${selectedInvoice.debtInfo.activeTotal} ARS</span>
                    </div>
                    {selectedInvoice.debtInfo.moraAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        <span>Interés por Mora ({selectedInvoice.debtInfo.daysLate} días):</span>
                        <span>${selectedInvoice.debtInfo.moraAmount} ARS</span>
                      </div>
                    )}
                    {selectedInvoice.debtInfo.totalPayments > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        <span>Pagos Anteriores:</span>
                        <span style={{ color: 'var(--color-success)' }}>-${selectedInvoice.debtInfo.totalPayments} ARS</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <span>Saldo a Pagar:</span>
                      <span>${selectedInvoice.debtInfo.balance} ARS</span>
                    </div>
                  </div>
                )}
                <FormAlert message={paymentFormError} />
                <div className="form-group">
                  <label>Monto Recibido ($ ARS) *</label>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
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
                  <input type="text" placeholder="Ej: Transferencia 981242" value={payRef} onChange={e => setPayRef(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>Notas de Cobro</label>
                  <textarea rows={2} placeholder="Comentarios adicionales" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                </div>

                {hasSuspendedContract && !reactivatedWithDebt && (
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
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={reactivateOnPay}
                      onChange={(e) => setReactivateOnPay(e.target.checked)}
                    />
                    Reactivar servicio en MikroTik al registrar este pago
                  </label>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setIsPaymentModalOpen(false); setSelectedInvoice(null); setReactivateOnPay(false); }} disabled={submitting}>
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

      {/* Edit Client Modal */}
      {isEditModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsEditModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Editar Datos del Cliente</h3>
            
            <form onSubmit={handleEditClient} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body">
                <FormAlert message={editFormError} />
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input type="text" className={!editFullName && editFormError ? "input-error" : ""} placeholder="Ej: Nahuel Dev" value={editFullName} onChange={e => { setEditFullName(e.target.value); if (editFormError) setEditFormError(""); }} />
                </div>
                
                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>DNI *</label>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        className={!editDni && editFormError ? "input-error" : ""} 
                        placeholder="DNI (o temporal)" 
                        value={editDni} 
                        onChange={e => { setEditDni(e.target.value); if (editFormError) setEditFormError(""); }} 
                        style={{ flex: 1, minWidth: '0' }}
                      />
                      <button
                        type="button"
                        onClick={generateTempDni}
                        disabled={generatingDni}
                        title="Generar DNI temporal"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.5rem 0.6rem', borderRadius: '8px', cursor: 'pointer',
                          background: 'var(--accent)', color: '#fff', border: 'none',
                          fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
                          opacity: generatingDni ? 0.7 : 1,
                        }}
                      >
                        {generatingDni ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Shuffle size={12} />
                        )}
                        {generatingDni ? 'Generando...' : 'Temp'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Código de Cliente *</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className={!editClientCode && editFormError ? 'input-error' : ''}
                        placeholder="Ej: CLI-4A2X"
                        value={editClientCode}
                        onChange={e => { setEditClientCode(e.target.value); if (editFormError) setEditFormError(''); }}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={generateClientCode}
                        disabled={generatingCode}
                        title="Generar codigo aleatorio"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.5rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                          background: 'var(--accent)', color: '#fff', border: 'none',
                          fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
                          opacity: generatingCode ? 0.7 : 1,
                        }}
                      >
                        <Shuffle size={14} />
                        {generatingCode ? 'Generando...' : 'Generar'}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                      El Codigo de Cliente es un identificador corto unico que el abonado usa para acceder al Portal de Autogestión y para ser identificado rapidamente. Ejemplo: <strong>CLI-4A2X</strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Estado *</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value as any)}>
                      <option value="ACTIVE">Activo</option>
                      <option value="SUSPENDED">Suspendido</option>
                      <option value="DELINQUENT">Moroso</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Teléfono Principal</label>
                    <input type="text" placeholder="Teléfono" value={editPhone1} onChange={e => setEditPhone1(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Teléfono Secundario</label>
                    <input type="text" placeholder="Alternativo" value={editPhone2} onChange={e => setEditPhone2(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input type="email" placeholder="ejemplo@correo.com" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>Dirección Completa *</label>
                  <input type="text" className={!editAddress && editFormError ? "input-error" : ""} placeholder="Dirección completa" value={editAddress} onChange={e => { setEditAddress(e.target.value); if (editFormError) setEditFormError(""); }} />
                </div>

                <div className="form-group">
                  <label>Ubicación Geográfica (Haga clic en el mapa o arrastre el marcador)</label>
                  <div style={{ height: '220px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                    <MapPicker
                      lat={editLatitude}
                      lng={editLongitude}
                      onLocationSelect={(lat, lng) => {
                        setEditLatitude(lat.toFixed(6));
                        setEditLongitude(lng.toFixed(6));
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Latitud GPS (Solo Lectura)</label>
                    <input type="text" value={editLatitude} readOnly placeholder="Seleccione en el mapa..." style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }} />
                  </div>
                  <div className="form-group">
                    <label>Longitud GPS (Solo Lectura)</label>
                    <input type="text" value={editLongitude} readOnly placeholder="Seleccione en el mapa..." style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notas de Campo / Observaciones</label>
                  <textarea rows={2} placeholder="Comentarios del técnico, tendido de cable, árboles..." value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Guardando...
                    </>
                  ) : 'Guardar Cambios'}
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
            
            <div className="modal-body invoice-print-container" id="invoice-print-area">
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
                  <span style={{ fontSize: '0.75rem', color: '#666666', display: 'block' }}>Fecha de Emisión: {new Date(previewInvoice.periodStart).toLocaleDateString()}</span>
                  <span style={{ fontSize: '0.75rem', color: '#666666', display: 'block' }}>Vencimiento: {new Date(previewInvoice.dueDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Client & Billing info */}
              <div className="grid invoice-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', fontSize: '0.82rem', borderBottom: '1px solid #dddddd', paddingBottom: '1rem' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', color: '#555555', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Cliente / Abonado</strong>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{client?.fullName}</span>
                  <span>DNI: {client?.dni}</span><br />
                  <span>Dirección: {client?.address}</span>
                </div>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', color: '#555555', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Detalles del Servicio</strong>
                  <span>Plan de Internet: {client?.contracts[0]?.plan.name}</span><br />
                  <span>Velocidad: {client?.contracts[0]?.plan.downloadSpeed} Mbps / {client?.contracts[0]?.plan.uploadSpeed} Mbps</span><br />
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
                        Abono Mensual de Internet de Banda Ancha - Período {new Date(previewInvoice.periodStart).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
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
                  const printContent = document.getElementById('invoice-print-area')?.innerHTML;
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

      {/* Custom Confirmation Modal for Block/Unblock Actions */}
      {confirmModalType && (
        <div className="modal-backdrop" onClick={() => setConfirmModalType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: confirmModalType === 'unblock' ? '500px' : '450px' }}>
            <button type="button" className="modal-close-btn" onClick={() => setConfirmModalType(null)} aria-label="Cerrar">
              <X size={18} />
            </button>

            {confirmModalType === 'unblock' ? (
              <>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wifi size={20} color="var(--color-success)" /> Reactivar Servicio en MikroTik
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                  Se removerá la IP de la lista de bloqueo <code>cortados</code> para restablecer la navegación.
                </p>

                {client?.invoices?.some(inv => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(inv.status)) ? (
                  <>
                    <div style={{ 
                      backgroundColor: 'rgba(249,115,22,0.08)', 
                      border: '1px solid rgba(249,115,22,0.3)', 
                      borderRadius: '6px', 
                      padding: '0.85rem', 
                      fontSize: '0.85rem', 
                      color: 'var(--color-warning)', 
                      lineHeight: 1.5,
                      marginBottom: '1.5rem'
                    }}>
                      <strong><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.3rem' }} /> El abonado posee facturas impagas.</strong>
                      <div style={{ marginTop: '0.35rem' }}>
                        Elegí cómo proceder con la reactivación técnica:
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-success"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem', fontWeight: 600 }}
                        onClick={() => {
                          setConfirmModalType(null);
                          runUnblockAction(true);
                        }}
                      >
                        <DollarSign size={16} /> Reactivar y Registrar Pago
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem', backgroundColor: '#e28743', borderColor: '#e28743', fontWeight: 600 }}
                        onClick={() => {
                          setConfirmModalType(null);
                          runUnblockAction(false);
                        }}
                      >
                        <Wifi size={16} /> Reactivar sin Cobrar (Recordatorio Activo)
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '0.65rem' }}
                        onClick={() => setConfirmModalType(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                      ¿Está seguro de reactivar el servicio de este cliente en MikroTik?
                    </p>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setConfirmModalType(null)}>Cancelar</button>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        onClick={() => {
                          setConfirmModalType(null);
                          runUnblockAction(false);
                        }}
                      >
                        Reactivar Servicio
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : confirmModalType === 'block' ? (
              <>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <WifiOff size={20} color="var(--color-danger)" /> Cortar Servicio (Manual)
                </h3>
                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                  ¿Está seguro de suspender manualmente el servicio de este cliente en MikroTik de forma directa? Esta acción se ejecutará de forma deliberada independientemente del estado de facturación.
                </p>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmModalType(null)}>Cancelar</button>
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={() => {
                      setConfirmModalType(null);
                      runBlockAction();
                    }}
                  >
                    Confirmar Corte Manual
                  </button>
                </div>
              </>
            ) : confirmModalType === 'unblock-pay' ? (
              <>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} color="var(--color-warning)" /> Suspender por Mora
                </h3>
                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                  ¿Está seguro de suspender el servicio en MikroTik debido a que el cliente posee deuda vencida registrada administrativamente?
                </p>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmModalType(null)}>Cancelar</button>
                  <button 
                    type="button" 
                    className="btn btn-warning" 
                    onClick={() => {
                      setConfirmModalType(null);
                      runBlockAction();
                    }}
                  >
                    Suspender Servicio
                  </button>
                </div>
              </>
            ) : confirmModalType === 'expire' ? (
              <>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} color="var(--color-danger)" /> Vencer Factura
                </h3>
                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                  ¿Está seguro de forzar el vencimiento de la factura <strong>{selectedInvoice?.invoiceNumber}</strong>? Esta acción cambiará su estado a Vencida administrativamente.
                </p>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setConfirmModalType(null); setSelectedInvoice(null); }}>Cancelar</button>
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={() => {
                      setConfirmModalType(null);
                      if (selectedInvoice) {
                        handleForceExpire(selectedInvoice.id);
                      }
                    }}
                  >
                    Confirmar Vencimiento
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
          {/* Sync Info Modal */}
      {isSyncInfoModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSyncInfoModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button type="button" className="modal-close-btn" onClick={() => setIsSyncInfoModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Estados de Sincronización</h3>
            
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
                El indicador de sincronización compara el <strong>estado administrativo</strong> del cliente (su deuda y fichas) con el <strong>estado técnico</strong> real en el Router MikroTik. Aquí explicamos los posibles valores:
              </p>
              
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none', padding: 0 }}>
                <li style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', borderLeft: '3px solid var(--color-success)' }}>
                  <strong style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><CheckCircle size={16} /> Sincronizado</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Todo está correcto. Si el cliente está Activo, tiene internet. Si el cliente está Moroso, su internet está suspendido en el MikroTik.</span>
                </li>
                
                <li style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: '6px', borderLeft: '3px solid var(--color-warning)' }}>
                  <strong style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><AlertTriangle size={16} /> Moroso pero ACTIVO</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>El cliente ha sido marcado como MOROSO (o Suspendido) en su ficha administrativa, pero <strong>todavía tiene acceso a Internet</strong> porque no se le ha bloqueado en el router.</span>
                </li>
                
                <li style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 152, 0, 0.1)', borderRadius: '6px', borderLeft: '3px solid #ff9800' }}>
                  <strong style={{ color: '#ff9800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><AlertTriangle size={16} /> Activo pero SUSPENDIDO</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>El cliente está al día y ACTIVO administrativamente (ej. recién pagó su factura), pero <strong>su internet sigue bloqueado</strong> en el router.</span>
                </li>
                
                <li style={{ padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', borderLeft: '3px solid var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><Unplug size={16} /> Desvinculado del Router</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ocurre en clientes recién creados o <strong>importados por migración</strong>. El cliente existe administrativamente, pero no tiene una IP, usuario PPPoE ni equipo asignado, por lo que el sistema no puede controlar su conexión.</span>
                </li>
              </ul>
            </div>

            <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => setIsSyncInfoModalOpen(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Anular Pago */}
      {isVoidPaymentModalOpen && selectedPaymentForVoid && (
        <div className="modal-backdrop" onClick={() => { setIsVoidPaymentModalOpen(false); setSelectedPaymentForVoid(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <button type="button" className="modal-close-btn" onClick={() => { setIsVoidPaymentModalOpen(false); setSelectedPaymentForVoid(null); }} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={20} color="var(--color-danger)" /> Confirmar Anulación de Pago
            </h3>
            
            <form onSubmit={handleVoidPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body">
                {/* Impact analysis */}
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.82rem', color: '#ffb3b3', marginBottom: '1rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>ANÁLISIS DE IMPACTO COMERCIAL Y TÉCNICO:</strong>
                  - Se anulará el cobro de <strong>${Number(selectedPaymentForVoid.amount).toLocaleString()} ARS</strong>.<br />
                  - La factura correspondiente aumentará su saldo pendiente en <strong>${Number(selectedPaymentForVoid.amount).toLocaleString()} ARS</strong>.<br />
                  - Si la factura queda con deuda vencida, el estado del cliente cambiará a <strong>Moroso</strong> y el sistema advertirá para suspender su servicio en MikroTik.
                </div>

                <div className="form-group">
                  <label>Motivo de Auditoría *</label>
                  <select
                    className="form-control"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    required
                  >
                    <option value="ERROR_TIPEO">Error de tipeo</option>
                    <option value="ANULACION">Anulación</option>
                    <option value="EDICION_MONTO">Edición de monto</option>
                    <option value="OTRO">Otro (especificar abajo)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Observaciones / Aclaración *</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Escriba la justificación detallada..."
                    value={voidNotes}
                    onChange={(e) => setVoidNotes(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setIsVoidPaymentModalOpen(false); setSelectedPaymentForVoid(null); }} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rectificar Pago */}
      {isRectifyPaymentModalOpen && selectedPaymentForRectify && (
        <div className="modal-backdrop" onClick={() => { setIsRectifyPaymentModalOpen(false); setSelectedPaymentForRectify(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button type="button" className="modal-close-btn" onClick={() => { setIsRectifyPaymentModalOpen(false); setSelectedPaymentForRectify(null); }} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit size={20} color="var(--accent)" /> Rectificar Cobro Manual
            </h3>
            
            <form onSubmit={handleRectifyPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                
                {/* Impact analysis */}
                <div style={{ backgroundColor: 'rgba(230, 92, 0, 0.1)', border: '1px solid var(--accent)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.82rem', color: '#ffcc99', marginBottom: '1rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>ANÁLISIS DE IMPACTO DE RECTIFICACIÓN:</strong>
                  - El cobro original de <strong>${Number(selectedPaymentForRectify.amount).toLocaleString()} ARS</strong> se marcará como deshabilitado/anulado.<br />
                  - Se registrará un nuevo cobro por <strong>${Number(rectifyAmount || 0).toLocaleString()} ARS</strong> asignado a este cliente.<br />
                  - Los saldos de las facturas se recalcularán de forma automática.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Monto Corregido ($ ARS) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={rectifyAmount}
                      onChange={(e) => setRectifyAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Canal/Método *</label>
                    <select
                      className="form-control"
                      value={rectifyMethod}
                      onChange={(e) => setRectifyMethod(e.target.value)}
                    >
                      <option value="TRANSFER">Transferencia</option>
                      <option value="MERCADO_PAGO">Mercado Pago</option>
                      <option value="CASH">Efectivo</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Fecha de Pago *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={rectifyDate}
                      onChange={(e) => setRectifyDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Referencia/N° Comp.</label>
                    <input
                      type="text"
                      className="form-control"
                      value={rectifyReference}
                      onChange={(e) => setRectifyReference(e.target.value)}
                      placeholder="Ej. N° de transferencia"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Asignar a Factura</label>
                  <select
                    className="form-control"
                    value={rectifyInvoiceId}
                    onChange={(e) => setRectifyInvoiceId(e.target.value)}
                  >
                    {client.invoices?.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        Factura N° {inv.invoiceNumber} - Período: {new Date(inv.periodStart).toLocaleDateString(undefined, {month: 'long', year: 'numeric'}).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Notas de Cobro (Aparecen en ficha)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={rectifyNotes}
                    onChange={(e) => setRectifyNotes(e.target.value)}
                    placeholder="Notas internas del cobro..."
                  />
                </div>

                <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <label>Motivo de Rectificación (Auditoría) *</label>
                  <select
                    className="form-control"
                    value={rectifyReason}
                    onChange={(e) => setRectifyReason(e.target.value)}
                    required
                  >
                    <option value="ERROR_TIPEO">Error de tipeo</option>
                    <option value="EDICION_MONTO">Edición de monto</option>
                    <option value="OTRO">Otro (especificar abajo)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Aclaraciones / Observaciones de Rectificación *</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Justifique el motivo de este cambio..."
                    value={rectifyObservaciones}
                    onChange={(e) => setRectifyObservaciones(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setIsRectifyPaymentModalOpen(false); setSelectedPaymentForRectify(null); }} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Procesando...' : 'Aplicar Rectificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Modificar Factura (Plazos y Conceptos) */}
      {isEditInvoiceModalOpen && selectedInvoiceForEdit && (
        <div className="modal-backdrop" onClick={() => { setIsEditInvoiceModalOpen(false); setSelectedInvoiceForEdit(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <button type="button" className="modal-close-btn" onClick={() => { setIsEditInvoiceModalOpen(false); setSelectedInvoiceForEdit(null); }} aria-label="Cerrar">
              <X size={18} />
            </button>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="var(--accent)" /> Modificar Factura N° {selectedInvoiceForEdit.invoiceNumber}
            </h3>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Dynamic items management section */}
              <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Gestión de Ítems / Conceptos Facturados</strong>
                
                {/* Current Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  {editInvoiceItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.8rem' }}>
                      <div>
                        <span>{item.description}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Tipo: {item.type}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>${Number(item.amount).toLocaleString()}</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeleteInvoiceItem(item.id)}
                          style={{ padding: '0.1rem 0.3rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new Item Form */}
                <form onSubmit={handleAddInvoiceItem} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Descripción</label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      placeholder="Concepto..."
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Monto ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                      value={newItemAmount}
                      onChange={(e) => setNewItemAmount(e.target.value)}
                      placeholder="Monto"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Tipo</label>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value)}
                    >
                      <option value="BASE">Abono Base</option>
                      <option value="MORA">Mora/Interés</option>
                      <option value="ADJUSTMENT">Ajuste/Descuento</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    style={{ padding: '0.35rem 0.6rem' }}
                  >
                    + Agregar
                  </button>
                </form>
              </div>

              {/* Plazos Form */}
              <form onSubmit={handleEditInvoice}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Fecha de Vencimiento *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editInvoiceDueDate}
                      onChange={(e) => setEditInvoiceDueDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Días de Gracia del Contrato *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={editInvoiceGraceDays}
                      onChange={(e) => setEditInvoiceGraceDays(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notas de Factura (Internas)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={editInvoiceNotes}
                    onChange={(e) => setEditInvoiceNotes(e.target.value)}
                    placeholder="Notas internas..."
                  />
                </div>

                <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <label>Motivo del Ajuste (Auditoría) *</label>
                  <select
                    className="form-control"
                    value={editInvoiceReason}
                    onChange={(e) => setEditInvoiceReason(e.target.value)}
                    required
                  >
                    <option value="ERROR_TIPEO">Error de tipeo</option>
                    <option value="EDICION_MONTO">Edición de monto</option>
                    <option value="ANULACION">Anulación comercial</option>
                    <option value="OTRO">Otro (especificar abajo)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Aclaraciones / Observaciones de Auditoría *</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Justificación detallada..."
                    value={editInvoiceObservaciones}
                    onChange={(e) => setEditInvoiceObservaciones(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-footer" style={{ padding: '1rem 0 0 0', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setIsEditInvoiceModalOpen(false); setSelectedInvoiceForEdit(null); }} disabled={submitting}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Guardando...' : 'Aplicar Modificaciones'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClientDetail;






