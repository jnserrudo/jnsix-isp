import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Network, 
  Wifi, 
  RefreshCw, 
  Play, 
  Square, 
  Settings2, 
  Activity, 
  AlertTriangle
} from 'lucide-react';
import EduBox from './EduBox';
import TablePagination from './TablePagination';

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

interface InterfaceData {
  '.id': string;
  name: string;
  type: string;
  disabled: string;
  running: string;
  mtu: string;
  'actual-mtu': string;
  comment?: string;
}

interface WirelessData {
  '.id': string;
  name: string;
  ssid: string;
  frequency: string;
  band: string;
  mode: string;
  disabled: string;
  'radio-name'?: string;
  comment?: string;
}

interface ActionLog {
  id: string;
  command: string;
  args?: any;
  friendlyMessage: string;
  success: boolean;
  timestamp: string;
  errorDetails?: string;
}

interface Props {
  nodeId: string;
  onAddLog: (log: ActionLog) => void;
}

const InterfaceModule: React.FC<Props> = ({ nodeId, onAddLog }) => {
  const [interfaces, setInterfaces] = useState<InterfaceData[]>([]);
  const [wireless, setWireless] = useState<WirelessData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Interface state changing states
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Pending action for impact warning modal
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    command: string;
    args: any;
    concept: string;
    impact: string;
    onConfirm: () => void;
  } | null>(null);

  // Wireless configuration modal states
  const [selectedWlan, setSelectedWlan] = useState<WirelessData | null>(null);
  const [wlanSSID, setWlanSSID] = useState('');
  const [wlanFreq, setWlanFreq] = useState('');
  const [wlanDisabled, setWlanDisabled] = useState(false);

  // Real-time Traffic monitoring states
  const [monitoredInterface, setMonitoredInterface] = useState<string | null>(null);
  const [trafficData, setTrafficData] = useState<{
    rxBps: number;
    txBps: number;
    rxPps: number;
    txPps: number;
  } | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const trafficInterval = useRef<any>(null);

  // Pagination states
  const [etherPage, setEtherPage] = useState(1);
  const [etherItemsPerPage, setEtherItemsPerPage] = useState(5);
  const [wlanPage, setWlanPage] = useState(1);
  const [wlanItemsPerPage, setWlanItemsPerPage] = useState(5);

  const getToken = () => localStorage.getItem('token');

  // Load data from backend
  const loadData = async () => {
    setLoading(true);
    setError('');
    const logId = Math.random().toString();
    
    // Initial loading log
    const initialLog: ActionLog = {
      id: logId,
      command: 'GET /api/nodes/:nodeId/mikrotik/interfaces',
      friendlyMessage: 'Iniciando escaneo de interfaces en el router MikroTik...',
      success: true,
      timestamp: new Date().toISOString()
    };
    onAddLog(initialLog);

    try {
      const response = await axios.get(
        `${API_URL}/api/nodes/${nodeId}/mikrotik/interfaces`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      if (response.data.success) {
        setInterfaces(response.data.data.interfaces);
        setWireless(response.data.data.wireless);
        
        // Log success
        onAddLog({
          id: Math.random().toString(),
          command: response.data.log.command,
          friendlyMessage: response.data.log.friendlyMessage,
          success: true,
          timestamp: response.data.log.timestamp
        });
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Error al consultar las interfaces';
      let errDetails = '';
      let logPayload: any = null;

      if (err.response?.data) {
        errorMsg = err.response.data.message || errorMsg;
        errDetails = err.response.data.errorDetails || '';
        logPayload = err.response.data.log;
      } else {
        errDetails = err.message || String(err);
      }

      setError(`${errorMsg} ${errDetails ? `(${errDetails})` : ''}`);

      onAddLog({
        id: Math.random().toString(),
        command: logPayload?.command || '/interface/print',
        args: logPayload?.args,
        friendlyMessage: `FALLÓ: ${errorMsg}`,
        success: false,
        errorDetails: errDetails,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      stopTrafficMonitoring();
    };
  }, [nodeId]);

  // Toggle interface state (Enable/Disable) - Intercepted with confirmation
  const handleToggleState = async (ifaceName: string, currentDisabled: boolean) => {
    const nextDisabled = !currentDisabled;
    const friendlyDesc = nextDisabled 
      ? `Deshabilitar interfaz "${ifaceName}"`
      : `Habilitar interfaz "${ifaceName}"`;

    const impactDesc = nextDisabled
      ? `ATENCIÓN: Apagar esta interfaz interrumpirá de inmediato toda transmisión física y desconectará eléctricamente el enlace físico de este puerto. Si esta interfaz es el enlace WAN o forma parte del Bridge LAN principal, la conectividad externa del nodo y sus clientes asociados se cortará por completo.`
      : `Habilitar esta interfaz encenderá eléctricamente el circuito físico del puerto, permitiendo restablecer el ruteo automático del enlace en unos segundos.`;

    setPendingAction({
      title: friendlyDesc,
      command: `/interface/set`,
      args: { numbers: ifaceName, disabled: nextDisabled ? 'yes' : 'no' },
      concept: 'Modifica el estado administrativo (habilitado/deshabilitado) de una interfaz física o lógica a nivel de hardware del router.',
      impact: impactDesc,
      onConfirm: () => {
        setPendingAction(null);
        executeToggleState(ifaceName, nextDisabled);
      }
    });
  };

  const executeToggleState = async (ifaceName: string, nextDisabled: boolean) => {
    setActionInProgress(ifaceName);
    setError('');

    const friendlyDesc = nextDisabled 
      ? `Deshabilitando interfaz "${ifaceName}"`
      : `Habilitando interfaz "${ifaceName}"`;

    onAddLog({
      id: Math.random().toString(),
      command: `POST /interfaces/set-state`,
      args: { name: ifaceName, disabled: nextDisabled },
      friendlyMessage: `${friendlyDesc} (Iniciando)...`,
      success: true,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await axios.post(
        `${API_URL}/api/nodes/${nodeId}/mikrotik/interfaces/set-state`,
        {
          name: ifaceName,
          disabled: nextDisabled
        },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      if (response.data.success) {
        // Success log
        onAddLog({
          id: Math.random().toString(),
          command: response.data.command,
          args: response.data.args,
          friendlyMessage: response.data.friendlyMessage,
          success: true,
          timestamp: response.data.timestamp
        });

        // Update local state
        setInterfaces(prev => prev.map(item => {
          if (item.name === ifaceName) {
            return { ...item, disabled: nextDisabled ? 'yes' : 'no' };
          }
          return item;
        }));

        // Also update wireless local state if it's wlan
        setWireless(prev => prev.map(item => {
          if (item.name === ifaceName) {
            return { ...item, disabled: nextDisabled ? 'yes' : 'no' };
          }
          return item;
        }));
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Error al cambiar estado de la interfaz';
      let errDetails = '';
      let logPayload: any = null;

      if (err.response?.data) {
        errorMsg = err.response.data.message || errorMsg;
        errDetails = err.response.data.errorDetails || '';
        logPayload = err.response.data.log;
      } else {
        errDetails = err.message || String(err);
      }

      setError(`${errorMsg}. ${errDetails}`);

      onAddLog({
        id: Math.random().toString(),
        command: logPayload?.command || '/interface/set',
        args: logPayload?.args || { numbers: ifaceName, disabled: nextDisabled ? 'yes' : 'no' },
        friendlyMessage: `FALLÓ: ${errorMsg}`,
        success: false,
        errorDetails: errDetails,
        timestamp: new Date().toISOString()
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Configure Wireless settings - Intercepted with confirmation
  const handleConfigureWireless = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWlan) return;

    const wlanName = selectedWlan.name;
    const impactDesc = `ATENCIÓN: Guardar y aplicar parámetros inalámbricos en wlan desconectará de forma inmediata a todos los clientes receptores asociados a esta antena AP. Se producirá un corte de navegación temporal para los clientes, quienes no recuperarán el servicio hasta que reestablezcan señal con el nuevo SSID o canal Wi-Fi modificado.`;

    setPendingAction({
      title: `Configurar parámetros inalámbricos en ${wlanName}`,
      command: `/interface/wireless/set`,
      args: { numbers: wlanName, ssid: wlanSSID, frequency: wlanFreq, disabled: wlanDisabled ? 'yes' : 'no' },
      concept: 'Modifica los parámetros de SSID, frecuencia de canal de transmisión y estado de encendido en el AP del adaptador inalámbrico del MikroTik.',
      impact: impactDesc,
      onConfirm: () => {
        setPendingAction(null);
        executeConfigureWireless(wlanName);
      }
    });
  };

  const executeConfigureWireless = async (wlanName: string) => {
    setError('');
    setActionInProgress(wlanName);

    onAddLog({
      id: Math.random().toString(),
      command: 'POST /interfaces/wireless/configure',
      args: { name: wlanName, ssid: wlanSSID, frequency: wlanFreq, disabled: wlanDisabled },
      friendlyMessage: `Guardando parámetros inalámbricos en ${wlanName} (SSID: ${wlanSSID}, Frecuencia: ${wlanFreq} MHz)...`,
      success: true,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await axios.post(
        `${API_URL}/api/nodes/${nodeId}/mikrotik/interfaces/wireless/configure`,
        {
          name: wlanName,
          ssid: wlanSSID,
          frequency: wlanFreq,
          disabled: wlanDisabled
        },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      if (response.data.success) {
        onAddLog({
          id: Math.random().toString(),
          command: response.data.command,
          args: response.data.args,
          friendlyMessage: response.data.friendlyMessage,
          success: true,
          timestamp: response.data.timestamp
        });

        // Update local wireless state
        setWireless(prev => prev.map(item => {
          if (item.name === wlanName) {
            return { 
              ...item, 
              ssid: wlanSSID, 
              frequency: wlanFreq,
              disabled: wlanDisabled ? 'yes' : 'no'
            };
          }
          return item;
        }));

        // Also update standard interfaces state
        setInterfaces(prev => prev.map(item => {
          if (item.name === wlanName) {
            return { ...item, disabled: wlanDisabled ? 'yes' : 'no' };
          }
          return item;
        }));

        setSelectedWlan(null);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Error al configurar interfaz inalámbrica';
      let errDetails = '';
      let logPayload: any = null;

      if (err.response?.data) {
        errorMsg = err.response.data.message || errorMsg;
        errDetails = err.response.data.errorDetails || '';
        logPayload = err.response.data.log;
      } else {
        errDetails = err.message || String(err);
      }

      setError(`${errorMsg}. ${errDetails}`);

      onAddLog({
        id: Math.random().toString(),
        command: logPayload?.command || '/interface/wireless/set',
        args: logPayload?.args,
        friendlyMessage: `FALLÓ: ${errorMsg}`,
        success: false,
        errorDetails: errDetails,
        timestamp: new Date().toISOString()
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Start traffic monitor polling
  const startTrafficMonitoring = (ifaceName: string) => {
    stopTrafficMonitoring(monitoredInterface || undefined);
    setMonitoredInterface(ifaceName);
    setTrafficLoading(true);
    setTrafficData(null);

    const fetchTraffic = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/nodes/${nodeId}/mikrotik/interfaces/${ifaceName}/traffic`,
          {
            headers: { Authorization: `Bearer ${getToken()}` },
          }
        );

        if (response.data.success && response.data.result && response.data.result.length > 0) {
          const raw = response.data.result[0];
          setTrafficData({
            rxBps: parseInt(raw['rx-bits-per-second'] || '0'),
            txBps: parseInt(raw['tx-bits-per-second'] || '0'),
            rxPps: parseInt(raw['rx-packets-per-second'] || '0'),
            txPps: parseInt(raw['tx-packets-per-second'] || '0'),
          });
        } else {
          // If no data returned (e.g. interface is disabled or no packets active)
          setTrafficData({
            rxBps: 0,
            txBps: 0,
            rxPps: 0,
            txPps: 0
          });
        }
      } catch (err: any) {
        console.error('Error monitoreando tráfico:', err);
        const errMsg = err.response?.data?.message || err.message || 'Error de conexión';
        
        // Log error to Operations Console
        onAddLog({
          id: Math.random().toString(),
          command: `GET /interfaces/${ifaceName}/traffic (Interval Error)`,
          friendlyMessage: `ERROR EN LECTURA DE TRÁFICO: El router no responde o rechazó la consulta para la interfaz ${ifaceName}. Detalle: ${errMsg}`,
          success: false,
          timestamp: new Date().toISOString(),
          errorDetails: err.response?.data?.errorDetails || err.message
        });
        
        // Stop monitoring to prevent infinite error loops
        stopTrafficMonitoring(ifaceName);
      } finally {
        setTrafficLoading(false);
      }
    };

    // Run immediately
    fetchTraffic();
    // Setup interval
    trafficInterval.current = setInterval(fetchTraffic, 2000);

    onAddLog({
      id: Math.random().toString(),
      command: `GET /interfaces/${ifaceName}/traffic`,
      friendlyMessage: `Iniciado monitor de tráfico en tiempo real para ${ifaceName} (Intervalo: 2s).`,
      success: true,
      timestamp: new Date().toISOString()
    });
  };

  // Stop traffic monitor polling
  const stopTrafficMonitoring = (ifaceName?: string) => {
    if (trafficInterval.current) {
      clearInterval(trafficInterval.current);
      trafficInterval.current = null;
    }
    const targetName = ifaceName || monitoredInterface;
    if (targetName) {
      onAddLog({
        id: Math.random().toString(),
        command: 'STOP /interfaces/traffic-monitor',
        friendlyMessage: `Detenido monitor de tráfico en interfaz ${targetName}.`,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    setMonitoredInterface(null);
    setTrafficData(null);
  };

  // Format bits to readable bandwidth
  const formatSpeed = (bps: number) => {
    if (bps === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Open Wireless Config Modal
  const openWlanConfig = (wlan: WirelessData) => {
    setSelectedWlan(wlan);
    setWlanSSID(wlan.ssid || '');
    setWlanFreq(wlan.frequency || '2412');
    setWlanDisabled(wlan.disabled === 'yes');
  };

  const renderTrafficMonitor = (ifaceName: string, accentColor: string = 'var(--accent)') => {
    if (monitoredInterface !== ifaceName) return null;

    return (
      <div 
        style={{ 
          backgroundColor: 'var(--bg-tertiary)', 
          border: `1px solid ${accentColor}`, 
          borderLeft: `4px solid ${accentColor}`,
          padding: '1.25rem', 
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          borderRadius: '0px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span 
              className="animate-pulse" 
              style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: accentColor === 'var(--accent)' ? 'var(--accent)' : '#10b981', 
                display: 'inline-block' 
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.05em' }}>
              Monitoreo de Tráfico Activo: <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>{ifaceName}</span>
            </span>
          </div>
          <button 
            onClick={() => stopTrafficMonitoring(ifaceName)} 
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '0px' }}
          >
            Cerrar Monitor
          </button>
        </div>

        {trafficLoading && !trafficData ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className="animate-spin" />
            <span>Conectando con la API del MikroTik y obteniendo estadísticas...</span>
          </div>
        ) : trafficData ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ borderLeft: '2px solid var(--color-success)', paddingLeft: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>Velocidad Descarga (RX)</div>
              <div style={{ fontSize: '1.65rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#ffffff', margin: '0.2rem 0' }}>
                {formatSpeed(trafficData.rxBps)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Paquetes/s: {trafficData.rxPps.toLocaleString()} pps
              </div>
              <div style={{ width: '100%', height: '3px', backgroundColor: '#1e293b', marginTop: '0.5rem', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: 'var(--color-success)', 
                    width: `${Math.min(100, (trafficData.rxBps / 30000000) * 100)}%`,
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
            <div style={{ borderLeft: `2px solid ${accentColor}`, paddingLeft: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>Velocidad Subida (TX)</div>
              <div style={{ fontSize: '1.65rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#ffffff', margin: '0.2rem 0' }}>
                {formatSpeed(trafficData.txBps)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Paquetes/s: {trafficData.txPps.toLocaleString()} pps
              </div>
              <div style={{ width: '100%', height: '3px', backgroundColor: '#1e293b', marginTop: '0.5rem', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: accentColor, 
                    width: `${Math.min(100, (trafficData.txBps / 10000000) * 100)}%`,
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Esperando primeras lecturas de tráfico...</span>
        )}
      </div>
    );
  };


  const eduParameters = [
    { name: 'numbers', type: 'string', desc: 'Identifica la interfaz (ej. ether1, wlan1) por su nombre o índice.' },
    { name: 'disabled', type: 'yes | no', desc: 'Desactiva temporalmente el puerto físico apagando su circuito de transmisión.' },
    { name: 'ssid', type: 'string', desc: 'Nombre identificativo (SSID) de la red inalámbrica Wi-Fi.' },
    { name: 'frequency', type: 'string', desc: 'Frecuencia de canal de transmisión en MHz (ej: 2412 equivale al canal 1).' }
  ];

  const etherInterfaces = interfaces.filter((iface) => iface.type !== 'wlan');
  const paginatedEther = etherInterfaces.slice(
    (etherPage - 1) * etherItemsPerPage,
    etherPage * etherItemsPerPage
  );

  const paginatedWlan = wireless.slice(
    (wlanPage - 1) * wlanItemsPerPage,
    wlanPage * wlanItemsPerPage
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Educational Box */}
      <EduBox 
        title="Interfaces de Red & Wireless"
        winboxPath="Interfaces -> Interface"
        command="/interface/print y /interface/wireless/print"
        concept="En MikroTik RouterOS, las interfaces representan las conexiones físicas (ethernet) e inalámbricas (wlan) del hardware. Apagar una interfaz (disabled=yes) equivale a desconectar físicamente el cable de red. Para las antenas (wireless), permite definir parámetros críticos de propagación electromagnética como la frecuencia del canal y el SSID."
        parameters={eduParameters}
      />

      {/* SECTION A: Physical Ports Panel (Ethernet) */}
      <div className="card" style={{ borderLeft: '4px solid #64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
              Sección A
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#ffffff', margin: 0 }}>
              Puertos Físicos Ethernet (Red Cableada)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Monitoreo y encendido/apagado físico de puertos RJ45 a nivel de hardware.
            </p>
          </div>
          <button 
            onClick={loadData} 
            disabled={loading} 
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '0px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Escanear Router
          </button>
        </div>

        {error && (
          <div 
            style={{ 
              backgroundColor: 'var(--color-danger-bg)', 
              border: '1px solid var(--color-danger-border)',
              color: 'var(--accent)', 
              padding: '0.85rem 1.25rem', 
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Real-time Traffic Monitor Window if active for physical ports */}
        {monitoredInterface && !monitoredInterface.startsWith('wlan') && renderTrafficMonitor(monitoredInterface, '#64748b')}

        {/* SECTION A: Physical Ports Table */}
        <div className="table-wrapper">
          {loading && interfaces.filter(iface => iface.type !== 'wlan').length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={36} className="animate-spin" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.85rem' }}>Obteniendo puertos del hardware del router...</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre Puerto</th>
                  <th>Tipo</th>
                  <th>Link Físico</th>
                  <th>Estado Admin</th>
                  <th>Actual MTU</th>
                  <th>Comentario / Descripción</th>
                  <th style={{ textAlign: 'right' }}>Acciones de Control Físico</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEther.map((iface) => {
                  const isDisabled = iface.disabled === 'yes';
                  const isRunning = iface.running === 'yes';
                  const isChanging = actionInProgress === iface.name;
                  const isMonitored = monitoredInterface === iface.name;

                  return (
                    <tr 
                      key={iface.name}
                      style={{
                        backgroundColor: isMonitored ? 'rgba(100, 116, 139, 0.08)' : undefined,
                        borderLeft: isMonitored ? '4px solid #64748b' : undefined,
                        transition: 'all 0.15s ease-in-out'
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Network size={16} style={{ color: isMonitored ? '#94a3b8' : undefined }} />
                          <span>{iface.name}</span>
                          {isMonitored && (
                            <span 
                              className="badge animate-pulse" 
                              style={{ 
                                fontSize: '0.6rem', 
                                padding: '0.1rem 0.35rem', 
                                backgroundColor: '#64748b', 
                                color: '#ffffff',
                                borderRadius: '0px',
                                fontWeight: 'bold'
                              }}
                            >
                              EN VIVO
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          {iface.type}
                        </span>
                      </td>
                      <td>
                        {!isDisabled ? (
                          isRunning ? (
                            <span style={{ color: 'var(--color-success)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              ● LINK ARRIBA (Activo)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              ○ SIN CABLE (Link abajo)
                            </span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-dark)', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>
                      <td>
                        {isDisabled ? (
                          <span 
                            className="badge badge-suspended" 
                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}
                          >
                            Apagado
                          </span>
                        ) : (
                          <span 
                            className="badge badge-active" 
                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}
                          >
                            Encendido
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {iface['actual-mtu'] || iface.mtu || '1500'} B
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {iface.comment || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sin comentario</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          
                          {/* Traffic monitor */}
                          <button
                            onClick={() => startTrafficMonitoring(iface.name)}
                            disabled={isDisabled || isChanging}
                            className="btn btn-secondary btn-sm"
                            title="Monitorear ancho de banda en vivo"
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            <Activity size={14} />
                          </button>

                          {/* Enable/Disable switch button */}
                          <button
                            onClick={() => handleToggleState(iface.name, isDisabled)}
                            disabled={isChanging}
                            className={`btn btn-sm ${isDisabled ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ 
                              padding: '0.3rem 0.75rem',
                              fontSize: '0.75rem',
                              minWidth: '95px'
                            }}
                          >
                            {isChanging ? (
                              'Enviando...'
                            ) : isDisabled ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Play size={10} /> Encender</span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Square size={10} /> Apagar</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Section A Pagination */}
        <TablePagination
          currentPage={etherPage}
          totalItems={etherInterfaces.length}
          itemsPerPage={etherItemsPerPage}
          onPageChange={setEtherPage}
          onItemsPerPageChange={setEtherItemsPerPage}
        />
      </div>

      {/* SECTION B: Wireless Antennas Management Card */}
      {wireless.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
            Sección B
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#ffffff', marginBottom: '0.25rem' }}>
            Antenas Inalámbricas (Wireless WLAN AP)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Mapeo completo de SSID, canales Wi-Fi, potencia y control de propagación inalámbrica.
          </p>

          {/* Real-time Traffic Monitor Window if active for wireless */}
          {monitoredInterface && monitoredInterface.startsWith('wlan') && renderTrafficMonitor(monitoredInterface, 'var(--accent)')}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Interfaz WLAN</th>
                  <th>Nombre SSID</th>
                  <th>Frecuencia Canal</th>
                  <th>Banda Frecuencia</th>
                  <th>Estado Físico</th>
                  <th>Estado Admin</th>
                  <th>Comentario</th>
                  <th style={{ textAlign: 'right' }}>Acciones de Control Inalámbrico</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWlan.map((wlan) => {
                  const ifaceMatch = interfaces.find(i => i.name === wlan.name);
                  const isDisabled = wlan.disabled === 'yes';
                  const isRunning = ifaceMatch ? ifaceMatch.running === 'yes' : false;
                  const comment = wlan.comment || (ifaceMatch ? ifaceMatch.comment : '');
                  const isChanging = actionInProgress === wlan.name;
                  const isMonitored = monitoredInterface === wlan.name;

                  return (
                    <tr 
                      key={wlan.name}
                      style={{
                        backgroundColor: isMonitored ? 'rgba(220, 38, 38, 0.08)' : undefined,
                        borderLeft: isMonitored ? '4px solid var(--accent)' : undefined,
                        transition: 'all 0.15s ease-in-out'
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Wifi size={16} color={isMonitored ? 'var(--accent)' : '#94a3b8'} />
                          <span>{wlan.name}</span>
                          {isMonitored && (
                            <span 
                              className="badge animate-pulse" 
                              style={{ 
                                fontSize: '0.6rem', 
                                padding: '0.1rem 0.35rem', 
                                backgroundColor: 'var(--accent)', 
                                color: '#ffffff',
                                borderRadius: '0px',
                                fontWeight: 'bold'
                              }}
                            >
                              EN VIVO
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 'bold' }}>
                        "{wlan.ssid || 'N/A'}"
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {wlan.frequency ? `${wlan.frequency} MHz` : 'Automático'}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {wlan.band} ({wlan.mode})
                      </td>
                      <td>
                        {!isDisabled ? (
                          isRunning ? (
                            <span style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>
                              ● EMITIENDO
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              ○ SIN ASOCIAR
                            </span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-dark)', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>
                      <td>
                        {isDisabled ? (
                          <span className="badge badge-suspended" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                            Apagado
                          </span>
                        ) : (
                          <span className="badge badge-active" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                            Encendido
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {comment || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sin comentario</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          
                          {/* Traffic monitor */}
                          <button
                            onClick={() => startTrafficMonitoring(wlan.name)}
                            disabled={isDisabled || isChanging}
                            className="btn btn-secondary btn-sm"
                            title="Monitorear tráfico de radio en vivo"
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            <Activity size={14} />
                          </button>

                          {/* Settings configure */}
                          <button
                            onClick={() => openWlanConfig(wlan)}
                            disabled={isChanging}
                            className="btn btn-secondary btn-sm"
                            title="Configurar SSID / Frecuencia"
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            <Settings2 size={14} />
                          </button>

                          {/* Toggle active state */}
                          <button
                            onClick={() => handleToggleState(wlan.name, isDisabled)}
                            disabled={isChanging}
                            className={`btn btn-sm ${isDisabled ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ 
                              padding: '0.3rem 0.75rem',
                              fontSize: '0.75rem',
                              minWidth: '95px'
                            }}
                          >
                            {isChanging ? (
                              'Enviando...'
                            ) : isDisabled ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Play size={10} /> Encender</span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Square size={10} /> Apagar</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section B Pagination */}
          <TablePagination
            currentPage={wlanPage}
            totalItems={wireless.length}
            itemsPerPage={wlanItemsPerPage}
            onPageChange={setWlanPage}
            onItemsPerPageChange={setWlanItemsPerPage}
          />
        </div>
      )}

      {/* Wireless Edit Modal */}
      {selectedWlan && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <button 
              onClick={() => setSelectedWlan(null)}
              className="modal-close-btn"
            >
              &times;
            </button>
            
            <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#ffffff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              Configurar Wireless: {selectedWlan.name}
            </h2>

            <form onSubmit={handleConfigureWireless}>
              <div className="form-group">
                <label>Nombre de Red (SSID)</label>
                <input 
                  type="text" 
                  value={wlanSSID}
                  onChange={(e) => setWlanSSID(e.target.value)}
                  placeholder="Ej: JNSIX_AP_CLIENTES"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Nombre público de la señal que verán las antenas receptoras.
                </span>
              </div>

              <div className="form-group">
                <label>Frecuencia de Canal (MHz)</label>
                <select 
                  value={wlanFreq}
                  onChange={(e) => setWlanFreq(e.target.value)}
                >
                  <option value="2412">2412 MHz (Canal 1 - 2.4 GHz)</option>
                  <option value="2437">2437 MHz (Canal 6 - 2.4 GHz)</option>
                  <option value="2462">2462 MHz (Canal 11 - 2.4 GHz)</option>
                  <option value="5180">5180 MHz (Canal 36 - 5 GHz)</option>
                  <option value="5240">5240 MHz (Canal 48 - 5 GHz)</option>
                  <option value="5745">5745 MHz (Canal 149 - 5 GHz)</option>
                  <option value="5805">5805 MHz (Canal 161 - 5 GHz)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Seleccione una frecuencia libre de interferencias para asegurar buena señal.
                </span>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0' }}>
                <input 
                  type="checkbox" 
                  id="wlan-disabled-check"
                  checked={wlanDisabled}
                  onChange={(e) => setWlanDisabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                />
                <label htmlFor="wlan-disabled-check" style={{ cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                  Deshabilitar Antena (Apagar Transmisión)
                </label>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setSelectedWlan(null)} 
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ minWidth: '120px' }}
                >
                  Aplicar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Impact Warning Confirmation Modal */}
      {pendingAction && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px', border: '1px solid var(--accent)' }}>
            <button 
              onClick={() => setPendingAction(null)}
              className="modal-close-btn"
            >
              &times;
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <AlertTriangle size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#ffffff', margin: 0 }}>
                Confirmar Acción: {pendingAction.title}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              {/* What does it do */}
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                  Descripción de la Acción (Qué hace)
                </span>
                <p style={{ color: 'var(--text-main)', margin: 0 }}>
                  {pendingAction.concept}
                </p>
              </div>

              {/* API equivalents */}
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                  Comando API RouterOS
                </span>
                <code style={{ fontFamily: 'monospace', color: '#fca5a5', fontWeight: 'bold' }}>
                  {pendingAction.command} {JSON.stringify(pendingAction.args)}
                </code>
              </div>

              {/* Network impact warning */}
              <div 
                style={{ 
                  backgroundColor: 'var(--color-danger-bg)', 
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--text-main)', 
                  padding: '1rem',
                  borderLeft: '4px solid var(--accent)'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>
                  Impacto Técnico y Efectos en la Red
                </span>
                <p style={{ margin: 0, lineHeight: 1.4, color: 'var(--text-main)' }}>
                  {pendingAction.impact}
                </p>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                onClick={() => setPendingAction(null)} 
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={pendingAction.onConfirm} 
                className="btn btn-primary"
                style={{ minWidth: '150px' }}
              >
                Confirmar y Ejecutar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterfaceModule;
