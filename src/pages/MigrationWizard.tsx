import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TablePagination from '../components/mikrotik/TablePagination';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

interface Node {
  id: string;
  name: string;
  mikrotikHost: string;
  isActive: boolean;
}

interface DBPlan {
  id: string;
  name: string;
  price: number;
}

interface AnalyzedClient {
  id: number;
  fullName: string;
  address: string;
  phone: string;
  planStr: string;
  price: number;
  status: 'ACTIVE' | 'DELINQUENT';
  tempDni: string;
  paymentHistory: {
    febrero?: string;
    marzo?: string;
    abril?: string;
    mayo?: string;
  };
  suggestedPlanId: string;
  suggestedMatch?: {
    type: 'PPPoE' | 'StaticIP';
    name: string;
    comment?: string;
    confidence: number;
    details: any;
  };
}

const MigrationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [verifyingNode, setVerifyingNode] = useState(false);
  const [nodeVerifySuccess, setNodeVerifySuccess] = useState<boolean | null>(null);
  const [nodeVerifyError, setNodeVerifyError] = useState<string>('');
  
  // Loaded analysis data
  const [clients, setClients] = useState<AnalyzedClient[]>([]);
  const [availablePlans, setAvailablePlans] = useState<DBPlan[]>([]);
  const [mikrotikSecrets, setMikrotikSecrets] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 2 Plan mappings state: { [excelPlanStr]: dbPlanId }
  const [planMappings, setPlanMappings] = useState<Record<string, string>>({});
  const [uniqueExcelPlans, setUniqueExcelPlans] = useState<string[]>([]);

  // Step 3 Reconciled clients state (stores editable inputs)
  const [reconciledClients, setReconciledClients] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  
  // Local table pagination for Paso 3
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Step 4 execution state
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any | null>(null);
  const [loadingProceed, setLoadingProceed] = useState(false);

  const normalizePlanStr = (val: string): string => {
    if (!val) return '';
    const match = val.trim().match(/^(\d+)\s*(mb|mbps|megas|m|mb\/s)?$/i);
    if (match) {
      return `${match[1]}Mb`;
    }
    return val.trim();
  };

  const getToken = () => localStorage.getItem('token');

  // Load all nodes on mount
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/nodes`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        setNodes(res.data);
        if (res.data.length > 0) {
          setSelectedNodeId(res.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching nodes:', err);
        setErrorMsg('Error al consultar los nodos de red de la base de datos.');
      }
    };
    fetchNodes();
  }, []);

  // Step 1: Verify MikroTik connection
  const handleVerifyNode = async () => {
    setVerifyingNode(true);
    setNodeVerifySuccess(null);
    setNodeVerifyError('');
    
    try {
      const res = await axios.post(
        `${API_URL}/api/nodes/${selectedNodeId}/test-connection`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      
      if (res.data.success) {
        setNodeVerifySuccess(true);
      } else {
        setNodeVerifySuccess(false);
        setNodeVerifyError(res.data.message || 'El router rechazó la conexión.');
      }
    } catch (err: any) {
      setNodeVerifySuccess(false);
      setNodeVerifyError(err.response?.data?.message || err.message || 'Tiempo de espera agotado al conectar al puerto API (8728).');
    } finally {
      setVerifyingNode(false);
    }
  };

  // Step 2: Fetch and analyze excel data
  const handleProceedToStep2 = async () => {
    setErrorMsg('');
    setLoadingProceed(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/migration/analyze/${selectedNodeId}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      // Normalize client plan strings to group variations like 10mb, 10Mb, 10MB together
      const parsedClients: AnalyzedClient[] = (res.data.clients || []).map((c: any) => ({
        ...c,
        planStr: normalizePlanStr(c.planStr)
      }));
      
      setClients(parsedClients);
      setAvailablePlans(res.data.availablePlans);

      // Extract unique plan strings from Excel
      const excelPlans = Array.from(new Set(parsedClients.map(c => c.planStr)));
      setUniqueExcelPlans(excelPlans);

      // Setup initial mappings mapping
      const initialMappings: Record<string, string> = {};
      excelPlans.forEach(plan => {
        // Find a client with this plan string to see their suggested plan ID
        const sampleClient = parsedClients.find(c => c.planStr === plan);
        initialMappings[plan] = sampleClient?.suggestedPlanId || (res.data.availablePlans[0]?.id || '');
      });
      setPlanMappings(initialMappings);

      // Fetch raw secrets and leases from Node to populate dropdowns in step 3
      try {
        const pppData = await axios.get(`${API_URL}/api/nodes/${selectedNodeId}/mikrotik/ppp`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (pppData.data.success) {
          setMikrotikSecrets((pppData.data.data.secrets || []).map((s: any) => s.name));
        }
      } catch (e) {
        console.error('Error fetching ppp secrets for autocomplete:', e);
      }

      try {
        await axios.get(`${API_URL}/api/nodes/${selectedNodeId}/mikrotik/ip-dhcp`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
      } catch (e) {
        console.error('Error fetching dhcp leases for autocomplete:', e);
      }

      setStep(2);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || err.message || 'No se pudo cargar el análisis de los clientes.');
    } finally {
      setLoadingProceed(false);
    }
  };

  // Step 3: Populate client reconciliation list based on plan mappings
  const handleProceedToStep3 = () => {
    const list = clients.map(c => {
      const mappedPlanId = planMappings[c.planStr];
      const match = c.suggestedMatch;
      
      return {
        id: c.id,
        fullName: c.fullName,
        dni: c.tempDni,
        phone: c.phone,
        address: c.address,
        planId: mappedPlanId,
        planStr: c.planStr,
        price: c.price,
        status: c.status,
        connectionMode: match?.type || 'PPPoE',
        pppoeUsername: match?.type === 'PPPoE' ? match.name : '',
        pppoePassword: match?.type === 'PPPoE' ? (match.details?.password || '') : '',
        staticIp: match?.type === 'StaticIP' ? match.name : '',
        macAddress: match?.type === 'StaticIP' ? (match.details?.['mac-address'] || '') : '',
        onuSerial: '',
        onuModel: '',
        isMatched: !!match,
        suggestedMatch: match
      };
    });
    setReconciledClients(list);
    setStep(3);
  };

  // Inline edit handler inside Step 3 table row
  const updateClientField = (id: number, field: string, value: any) => {
    setReconciledClients(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  // Filter lists in Paso 3
  const getFilteredClients = () => {
    if (filterTab === 'matched') {
      return reconciledClients.filter(c => c.isMatched);
    }
    if (filterTab === 'unmatched') {
      return reconciledClients.filter(c => !c.isMatched);
    }
    return reconciledClients;
  };

  const filteredClients = getFilteredClients();

  // Paginated client list in Paso 3
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Step 4: Show summary
  const handleProceedToStep4 = () => {
    setStep(4);
  };

  // Execute bulk migration
  const handleExecuteMigration = async () => {
    setExecuting(true);
    setErrorMsg('');
    setExecResult(null);

    const mappingsPayload = reconciledClients.map(c => ({
      fullName: c.fullName,
      dni: c.dni,
      phone: c.phone || undefined,
      address: c.address,
      planId: c.planId,
      connectionMode: c.connectionMode,
      pppoeUsername: c.connectionMode === 'PPPoE' ? c.pppoeUsername || undefined : undefined,
      pppoePassword: c.connectionMode === 'PPPoE' ? c.pppoePassword || undefined : undefined,
      staticIp: c.connectionMode === 'StaticIP' ? c.staticIp || undefined : undefined,
      macAddress: c.connectionMode === 'StaticIP' ? c.macAddress || undefined : undefined,
      onuSerial: c.onuSerial || undefined,
      onuModel: c.onuModel || undefined,
      status: c.status,
      monto: c.price || undefined,
      suggestedMatch: c.suggestedMatch
    }));

    try {
      const res = await axios.post(
        `${API_URL}/api/migration/execute`,
        {
          nodeId: selectedNodeId,
          mappings: mappingsPayload
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      
      if (res.data.success) {
        setExecResult(res.data);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || err.message || 'Error al ejecutar la migración masiva.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header block */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <button onClick={() => navigate('/mikrotik-management')} className="btn btn-secondary" style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', borderRadius: '0px' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', margin: 0 }}>
            Asistente de Migración y Conciliación de Clientes
          </h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Migración guiada de planillas Excel / RouterOS
          </span>
        </div>
      </div>

      {/* Progress Steps Indicators */}
      <div className="wizard-stepper">
        {[
          { num: 1, name: 'Conexión MikroTik' },
          { num: 2, name: 'Mapeo de Planes' },
          { num: 3, name: 'Conciliación de Datos' },
          { num: 4, name: 'Confirmación y Carga' }
        ].map((s) => (
          <div 
            key={s.num} 
            className="wizard-step-item" 
            style={{ opacity: step >= s.num ? 1 : 0.4 }}
          >
            <span className={`wizard-step-badge ${step === s.num ? 'active' : step > s.num ? 'success' : 'inactive'}`}>
              {step > s.num ? <Check size={12} /> : s.num}
            </span>
            <span className={`wizard-step-label ${step === s.num ? 'active' : ''}`}>
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--accent)', padding: '0.85rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ==================== STEP 1: CONNECTIVITY ==================== */}
      {step === 1 && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#ffffff', margin: 0 }}>Paso 1: Conectividad y Handshake con el MikroTik del Cliente</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Seleccione el nodo del cliente registrado en el sistema. Realizaremos una consulta instantánea para extraer los secretos PPPoE, concesiones DHCP y colas simples del router para la conciliación.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '450px' }}>
            <div className="form-group">
              <label>Router MikroTik de Destino</label>
              <select
                value={selectedNodeId}
                onChange={(e) => {
                  setSelectedNodeId(e.target.value);
                  setNodeVerifySuccess(null);
                  setNodeVerifyError('');
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: '#ffffff',
                  fontWeight: 600,
                  borderRadius: '0px'
                }}
              >
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.mikrotikHost})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button 
                onClick={handleVerifyNode} 
                disabled={verifyingNode || !selectedNodeId}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0px' }}
              >
                {verifyingNode ? <RefreshCw size={14} className="animate-spin" /> : <Server size={14} />}
                Verificar Conexión API (8728)
              </button>

              {nodeVerifySuccess && (
                <button 
                  onClick={handleProceedToStep2}
                  disabled={loadingProceed}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0px' }}
                >
                  {loadingProceed ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Cargando Análisis...
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Handshake outcome displays */}
          {verifyingNode && (
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Verificando credenciales del administrador y abriendo socket en puerto 8728...
            </div>
          )}

          {nodeVerifySuccess === true && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '1rem', fontSize: '0.85rem' }}>
              <Check size={16} />
              <span>
                <strong>¡Conexión Exitosa!</strong> El router MikroTik responde correctamente en el puerto API. Listados de PPPoE Secrets y DHCP Leases recuperados listos para comparación.
              </span>
            </div>
          )}

          {nodeVerifySuccess === false && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger-border)', color: 'var(--accent)', padding: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                <AlertTriangle size={16} />
                <span>Error en el Handshake de API</span>
              </div>
              <p style={{ margin: '0.2rem 0', color: 'var(--text-main)' }}>{nodeVerifyError}</p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <strong>Checklist de Solución:</strong>
                <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', lineHeight: 1.4 }}>
                  <li>Verifica que `/ip service set api disabled=no` esté configurado en el router.</li>
                  <li>Asegura que las credenciales de usuario/contraseña guardadas para el nodo sean de grupo "full".</li>
                  <li>Revisa las reglas de firewall en `/ip firewall filter` que puedan bloquear la entrada al puerto TCP 8728.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== STEP 2: PLAN MAPPING ==================== */}
      {step === 2 && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#ffffff', margin: 0 }}>Paso 2: Asociación y Mapeo de Planes de Ancho de Banda</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Hemos detectado {uniqueExcelPlans.length} nombres de planes diferentes en la planilla de Excel. Vincúlelos con los planes del sistema para aplicar la facturación y velocidades correctas a los contratos de servicio.
            </p>
          </div>

          {/* Unification info banner */}
          <div 
            style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.08)', 
              border: '1px solid rgba(59, 130, 246, 0.2)', 
              color: '#93c5fd', 
              padding: '0.85rem 1.25rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.25rem',
              borderLeft: '4px solid #3b82f6'
            }}
          >
            <strong style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Unificación Automática de Planes
            </strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#93c5fd', lineHeight: '1.4' }}>
              El sistema ha normalizado los nombres de los planes del Excel (ej. agrupando "10mb", "10Mb" y "10MB" bajo un único nombre unificado <strong>"10Mb"</strong>) para simplificar y acelerar el proceso de mapeo, reduciendo la cantidad de configuraciones manuales requeridas.
            </p>
          </div>

          <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Nombre Plan en Excel</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Vinculación al Plan del Sistema</th>
                </tr>
              </thead>
              <tbody>
                {uniqueExcelPlans.map((excelPlan) => (
                  <tr key={excelPlan} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>"{excelPlan}"</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <select
                        value={planMappings[excelPlan] || ''}
                        onChange={(e) => setPlanMappings(prev => ({ ...prev, [excelPlan]: e.target.value }))}
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          borderRadius: '0px',
                          width: '100%',
                          maxWidth: '300px'
                        }}
                      >
                        {availablePlans.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (${Number(p.price).toLocaleString()} ARS)
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button 
              onClick={() => setStep(1)} 
              className="btn btn-secondary"
              style={{ borderRadius: '0px' }}
            >
              Atrás
            </button>
            <button 
              onClick={handleProceedToStep3} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0px' }}
            >
              Continuar a Conciliación
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 3: RECONCILIATION TABLE ==================== */}
      {step === 3 && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#ffffff', margin: 0 }}>Paso 3: Conciliación de Cuentas y Corrección de Datos Obligatorios</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              El sistema ha comparado los nombres del Excel con la información activa del MikroTik. Revise y complete los DNI temporales y el modo de conexión técnico de cada abonado.
            </p>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            {[
              { id: 'all' as const, label: `Todos los Abonados (${reconciledClients.length})` },
              { id: 'matched' as const, label: `Auto-Asociados (${reconciledClients.filter(c => c.isMatched).length})` },
              { id: 'unmatched' as const, label: `Por Resolver/Huérfanos (${reconciledClients.filter(c => !c.isMatched).length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterTab(tab.id);
                  setCurrentPage(1); // Reset to first page
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: filterTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: filterTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                  border: '1px solid',
                  borderColor: filterTab === tab.id ? 'var(--accent)' : 'transparent',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  borderRadius: '0px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table content */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Abonado (Excel)</th>
                  <th>DNI / Identificación (Editable)</th>
                  <th>Plan Facturación</th>
                  <th>Modo Conexión</th>
                  <th>Configuración Técnica (MikroTik)</th>
                  <th>Historial / Estado Inicial</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client) => {
                  return (
                    <tr key={client.id} style={{ 
                      backgroundColor: client.isMatched ? 'rgba(16, 185, 129, 0.03)' : undefined,
                      borderLeft: client.isMatched ? '3px solid var(--color-success)' : '3px solid var(--accent)'
                    }}>
                      {/* Name / Address / Phone */}
                      <td>
                        <div style={{ fontWeight: 'bold', color: '#ffffff' }}>{client.fullName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dir: {client.address}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tel: {client.phone || 'Sin teléfono'}</div>
                        
                        {client.suggestedMatch ? (
                          <div style={{ 
                            marginTop: '0.5rem', 
                            padding: '0.4rem 0.6rem', 
                            backgroundColor: 'rgba(16, 185, 129, 0.04)', 
                            border: '1px solid rgba(16, 185, 129, 0.12)', 
                            fontSize: '0.75rem', 
                            fontFamily: 'monospace'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                                Coincidencia: {client.suggestedMatch.confidence}%
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                {client.suggestedMatch.type}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              Router: <span style={{ color: '#ffffff', fontWeight: 600 }}>{client.suggestedMatch.name}</span>
                            </div>
                            {client.suggestedMatch.comment && (
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={client.suggestedMatch.comment}>
                                Comentario: <span style={{ color: 'var(--accent)' }}>{client.suggestedMatch.comment}</span>
                              </div>
                            )}
                          </div>
                        ) : client.isMatched ? (
                          <div style={{ 
                            marginTop: '0.5rem', 
                            padding: '0.4rem 0.6rem', 
                            backgroundColor: 'rgba(16, 185, 129, 0.04)', 
                            border: '1px solid rgba(16, 185, 129, 0.12)', 
                            fontSize: '0.75rem', 
                            fontFamily: 'monospace'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                                Coincidencia Manual
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                Validado
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              <span style={{ color: '#ffffff', fontWeight: 600 }}>Usuario/IP ingresado existe en el MikroTik</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ 
                            marginTop: '0.5rem', 
                            padding: '0.4rem 0.6rem', 
                            backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid var(--border-color)', 
                            fontSize: '0.75rem', 
                            color: 'var(--text-muted)'
                          }}>
                            Sin coincidencia en MikroTik (0%)
                          </div>
                        )}
                      </td>
                      
                      {/* DNI input */}
                      <td>
                        <input
                          type="text"
                          value={client.dni}
                          onChange={(e) => updateClientField(client.id, 'dni', e.target.value)}
                          style={{
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            color: '#ffffff',
                            width: '140px',
                            fontFamily: 'monospace',
                            borderRadius: '0px'
                          }}
                        />
                        {client.dni.startsWith('TEMP-') && (
                          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--accent)', marginTop: '0.2rem' }}>DNI Temporal</span>
                        )}
                      </td>
                      
                      {/* Plan */}
                      <td>
                        <select
                          value={client.planId}
                          onChange={(e) => updateClientField(client.id, 'planId', e.target.value)}
                          style={{
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            color: '#ffffff',
                            borderRadius: '0px',
                            width: '120px'
                          }}
                        >
                          {availablePlans.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Excel: "{client.planStr}"
                        </span>
                      </td>

                      {/* Connection Mode selector */}
                      <td>
                        <select
                          value={client.connectionMode}
                          onChange={(e) => updateClientField(client.id, 'connectionMode', e.target.value)}
                          style={{
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            color: '#ffffff',
                            borderRadius: '0px',
                            fontWeight: 'bold'
                          }}
                        >
                          <option value="PPPoE">Túnel PPPoE</option>
                          <option value="StaticIP">IP Estática / DHCP</option>
                        </select>
                      </td>

                      {/* Technical config fields */}
                      <td>
                        {client.connectionMode === 'PPPoE' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Usuario:</span>
                              <input
                                type="text"
                                value={client.pppoeUsername}
                                onChange={(e) => {
                                  updateClientField(client.id, 'pppoeUsername', e.target.value);
                                  // Mark matched if matched with an existing secret
                                  const matches = mikrotikSecrets.includes(e.target.value);
                                  updateClientField(client.id, 'isMatched', matches);
                                }}
                                placeholder="Usuario PPPoE"
                                style={{
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  color: '#ffffff',
                                  width: '130px',
                                  borderRadius: '0px'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Clave:</span>
                              <input
                                type="text"
                                value={client.pppoePassword}
                                onChange={(e) => updateClientField(client.id, 'pppoePassword', e.target.value)}
                                placeholder="Clave PPPoE"
                                style={{
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  color: '#ffffff',
                                  width: '130px',
                                  borderRadius: '0px'
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IP:</span>
                              <input
                                type="text"
                                value={client.staticIp}
                                onChange={(e) => updateClientField(client.id, 'staticIp', e.target.value)}
                                placeholder="10.10.x.x"
                                style={{
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  color: '#ffffff',
                                  width: '130px',
                                  borderRadius: '0px'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MAC:</span>
                              <input
                                type="text"
                                value={client.macAddress}
                                onChange={(e) => updateClientField(client.id, 'macAddress', e.target.value)}
                                placeholder="AA:BB:CC:DD:EE:FF"
                                style={{
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  color: '#ffffff',
                                  width: '130px',
                                  borderRadius: '0px'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Payment History / derived status */}
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
                          {['febrero', 'marzo', 'abril', 'mayo'].map(m => {
                            const val = client.status === 'DELINQUENT' && m === 'mayo' ? 'PENDIENTE' : 'PAGADO';
                            return (
                              <span 
                                key={m} 
                                style={{ 
                                  fontSize: '0.55rem', 
                                  padding: '0.05rem 0.25rem', 
                                  backgroundColor: val === 'PENDIENTE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  color: val === 'PENDIENTE' ? 'var(--accent)' : 'var(--color-success)',
                                  border: `1px solid ${val === 'PENDIENTE' ? 'var(--color-danger-border)' : 'var(--color-success)'}`
                                }}
                                title={`${m}: ${val}`}
                              >
                                {m.slice(0, 3)}
                              </span>
                            );
                          })}
                        </div>
                        {client.status === 'DELINQUENT' ? (
                          <span className="badge badge-suspended" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                            A cortar (Con Deuda)
                          </span>
                        ) : (
                          <span className="badge badge-active" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                            Activo (Al Día)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredClients.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button 
              onClick={() => setStep(2)} 
              className="btn btn-secondary"
              style={{ borderRadius: '0px' }}
            >
              Atrás
            </button>
            <button 
              onClick={handleProceedToStep4} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0px' }}
            >
              Continuar a Confirmación
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 4: MASS CONFIRMATION ==================== */}
      {step === 4 && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#ffffff', margin: 0 }}>Paso 4: Confirmación Final y Carga Masiva a Base de Datos</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Revise el balance de clientes y cuentas a importar. Esta acción consolidará los contratos en el sistema.
            </p>
          </div>

          {!execResult ? (
            <>
              <div className="grid grid-cols-3">
                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffffff' }}>
                    {reconciledClients.length}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clientes Totales</span>
                </div>
                
                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1.25rem', textAlign: 'center', borderLeft: '3px solid var(--color-success)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                    {reconciledClients.filter(c => c.status === 'ACTIVE').length}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clientes Activos (Al Día)</span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1.25rem', textAlign: 'center', borderLeft: '3px solid var(--accent)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                    {reconciledClients.filter(c => c.status === 'DELINQUENT').length}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clientes con Deuda (Morosos)</span>
                </div>
              </div>

              {/* Critical notice */}
              <div 
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                  border: '1px solid var(--color-danger-border)', 
                  color: 'var(--text-main)', 
                  padding: '1.25rem',
                  borderLeft: '4px solid var(--accent)',
                  lineHeight: 1.5,
                  fontSize: '0.85rem'
                }}
              >
                <span style={{ fontWeight: 'bold', color: 'var(--accent)', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ATENCIÓN: EFECTOS Y REGLAS DE IMPORTACIÓN
                </span>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  <li>Se crearán {reconciledClients.length} abonados en el sistema con su respectivo contrato de servicio y plan.</li>
                  <li>Los clientes morosos se importarán con estado de cuenta <strong>DELINQUENT</strong> pero sus contratos iniciarán como <strong>ACTIVE</strong> para evitar cortes accidentales en esta etapa.</li>
                  <li><strong>Facturación Vencida:</strong> Al finalizar la importación, el sistema registrará una factura vencida para cada moroso importado. El administrador podrá revisar esta lista y suspender el servicio manualmente desde el panel de facturación.</li>
                  <li>Cualquier DNI que permanezca en formato temporal (`TEMP-XXXX`) deberá ser actualizado posteriormente editando la ficha del abonado.</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setStep(3)} 
                  disabled={executing}
                  className="btn btn-secondary"
                  style={{ borderRadius: '0px' }}
                >
                  Atrás
                </button>
                <button 
                  onClick={handleExecuteMigration} 
                  disabled={executing}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0px', backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
                >
                  {executing ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  Iniciar Importación Masiva ({reconciledClients.length} clientes)
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '1.25rem' }}>
                <Check size={24} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>¡Migración Finalizada Exitosamente!</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Se procesó la importación masiva de abonados en la base de datos de JNSIX ISP Manager.
                  </p>
                </div>
              </div>

              {/* Execution details */}
              <div className="grid grid-cols-2" style={{ fontSize: '0.85rem' }}>
                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Clientes Importados Correctamente</span>
                  <strong style={{ fontSize: '1.5rem', color: 'var(--color-success)' }}>{execResult.importedCount}</strong>
                </div>
                
                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Registros con Error</span>
                  <strong style={{ fontSize: '1.5rem', color: execResult.errorCount > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{execResult.errorCount}</strong>
                </div>
              </div>

              {execResult.errors && execResult.errors.length > 0 && (
                <div style={{ border: '1px solid var(--color-danger-border)', backgroundColor: 'var(--bg-secondary)', padding: '1rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>
                    DETALLES DE ERRORES EN IMPORTACIÓN:
                  </span>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {execResult.errors.map((err: any, idx: number) => (
                      <div key={idx} style={{ color: 'var(--accent)' }}>
                        Fila: {err.clientName} - Error: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <button 
                  onClick={() => navigate('/mikrotik-management')}
                  className="btn btn-primary"
                  style={{ borderRadius: '0px' }}
                >
                  Finalizar y Volver al Panel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MigrationWizard;
