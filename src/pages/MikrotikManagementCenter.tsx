import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Network, 
  Wifi, 
  Layers, 
  Sliders, 
  ShieldAlert, 
  Terminal, 
  AlertTriangle, 
  Database,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import InterfaceModule from '../components/mikrotik/InterfaceModule';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

interface Node {
  id: string;
  name: string;
  mikrotikHost: string;
  mikrotikPort: number;
  mikrotikUser: string;
  isActive: boolean;
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

type ModuleType = 'interfaces' | 'ip-dhcp' | 'ppp' | 'queues' | 'firewall';

const MikrotikManagementCenter: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [activeModule, setActiveModule] = useState<ModuleType>('interfaces');
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [error, setError] = useState('');

  // Global Action logs console state
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const consoleContainerRef = useRef<HTMLDivElement | null>(null);

  const getToken = () => localStorage.getItem('token');

  // Load all nodes
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/nodes`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        setNodes(res.data);
      } catch (err: any) {
        console.error('Error fetching nodes:', err);
        setError('No se pudieron cargar los nodos de MikroTik. Verifique el estado del servidor.');
      } finally {
        setLoadingNodes(false);
      }
    };
    fetchNodes();
  }, []);

  // Scroll console to bottom on new log (internal container scroll only)
  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [actionLogs]);

  const addLog = (log: ActionLog) => {
    setActionLogs(prev => [...prev, log]);
  };

  const clearConsole = () => {
    setActionLogs([]);
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Mapped modules with icons, descriptions and badges
  const modules = [
    {
      id: 'interfaces' as ModuleType,
      name: 'Interfaces & Wireless',
      desc: 'Gestión de puertos físicos (ether) y antenas (wlan).',
      icon: Network,
      color: 'var(--accent)'
    },
    {
      id: 'ip-dhcp' as ModuleType,
      name: 'IP & DHCP',
      desc: 'Asignación de redes, Leases, y ARP en vivo.',
      icon: Layers,
      color: '#0f766e' // Dark teal
    },
    {
      id: 'ppp' as ModuleType,
      name: 'PPP & Autenticación',
      desc: 'Gestión de servidores PPPoE, perfiles y secretos.',
      icon: Wifi,
      color: '#3b82f6' // Blue
    },
    {
      id: 'queues' as ModuleType,
      name: 'Queues (Ancho de Banda)',
      desc: 'Colas simples, bursts, prioridades y límites.',
      icon: Sliders,
      color: '#d97706' // Amber
    },
    {
      id: 'firewall' as ModuleType,
      name: 'Firewall & Seguridad',
      desc: 'Reglas NAT, filtros de corte, y Address Lists.',
      icon: ShieldAlert,
      color: '#dc2626' // Red
    }
  ];

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Page Title Block */}
      <div className="title-block" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: 0 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', margin: 0 }}>
            Centro de Gestión y Control Absoluto MikroTik
          </h1>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            Consola Operativa Central del Administrador
          </span>
        </div>

        {/* Node Selection Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ margin: 0, fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nodo Activo:</label>
          {loadingNodes ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cargando Nodos...</span>
          ) : (
            <select
              value={selectedNodeId}
              onChange={(e) => {
                setSelectedNodeId(e.target.value);
                // Clear console and stop monitoring
                clearConsole();
              }}
              style={{
                width: '240px',
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                fontSize: '0.9rem',
                color: '#ffffff',
                fontWeight: 600
              }}
            >
              <option value="">-- Seleccionar Nodo MikroTik --</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name} ({node.mikrotikHost})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div 
          style={{ 
            backgroundColor: 'var(--color-danger-bg)', 
            border: '1px solid var(--color-danger-border)',
            color: 'var(--accent)', 
            padding: '1rem 1.5rem', 
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {selectedNodeId ? (
        <>
          {/* Node Summary Specs Card */}
          {selectedNode && (
            <div className="node-summary-bar">
              <div className="node-summary-details">
                <div>
                  <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, display: 'block' }}>Nombre del Nodo</span>
                  <strong style={{ color: '#ffffff', fontSize: '1rem' }}>{selectedNode.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, display: 'block' }}>IP Host / Puerto API</span>
                  <code style={{ fontFamily: 'monospace', color: '#ffffff' }}>{selectedNode.mikrotikHost}:{selectedNode.mikrotikPort}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, display: 'block' }}>Usuario de Conexión</span>
                  <span style={{ color: '#ffffff' }}>{selectedNode.mikrotikUser}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-active">API RouterOS Conectada</span>
              </div>
            </div>
          )}

          {/* Modules Grid (Dashboard Modules Selection) */}
          <div className="grid grid-cols-5" style={{ gap: '1rem' }}>
            {modules.map((mod) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              return (
                <div 
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--accent)' : 'var(--border-color)',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s linear',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--border-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div 
                      style={{ 
                        border: '1px solid var(--border-color)', 
                        padding: '0.5rem', 
                        backgroundColor: 'var(--bg-primary)',
                        color: mod.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    {isActive && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.05em' }}>
                        Activo
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      {mod.name}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0', lineHeight: 1.3 }}>
                      {mod.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Module Content Dispatcher */}
          <div style={{ minHeight: '350px' }}>
            {activeModule === 'interfaces' && (
              <InterfaceModule 
                nodeId={selectedNodeId} 
                onAddLog={addLog}
              />
            )}

            {activeModule === 'ip-dhcp' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div 
                  className="info-banner" 
                  style={{ borderLeftColor: '#0f766e', border: '1px solid var(--border-color)', borderLeftWidth: '3px', backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <HelpCircle size={18} style={{ color: '#0f766e' }} />
                    <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      Direccionamiento IP, DHCP y Tabla ARP
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>
                    Este módulo maneja las direcciones IP asignadas a las interfaces físicas, los registros dinámicos de concesiones DHCP (`/ip/dhcp-server/lease`) y el mapa de resolución física ARP (`/ip/arp`). El administrador puede ver las IPs activas en la red en tiempo real.
                  </p>
                </div>
                <div style={{ textAlign: 'center', padding: '4rem var(--text-muted)', border: '1px dashed var(--border-color)' }}>
                  <Database size={40} style={{ opacity: 0.3, marginBottom: '1rem', color: '#0f766e' }} />
                  <h4 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Módulo IP & DHCP - En Construcción</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto' }}>
                    Este módulo se implementará próximamente. Mapeará las acciones de `/ip/address/print`, `/ip/dhcp-server/lease/print` y `/ip/arp/print`.
                  </p>
                </div>
              </div>
            )}

            {activeModule === 'ppp' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div 
                  className="info-banner" 
                  style={{ borderLeftColor: '#3b82f6', border: '1px solid var(--border-color)', borderLeftWidth: '3px', backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <HelpCircle size={18} style={{ color: '#3b82f6' }} />
                    <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      PPP & Autenticación de Clientes PPPoE
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>
                    Administra el servidor de túneles punto a punto PPPoE. Permite consultar secretos de usuario (`/ppp/secret`), monitorear conexiones activas (`/ppp/active`) con su IP asignada y tiempo de sesión (uptime), y modificar perfiles de velocidad (`/ppp/profile`).
                  </p>
                </div>
                <div style={{ textAlign: 'center', padding: '4rem var(--text-muted)', border: '1px dashed var(--border-color)' }}>
                  <Wifi size={40} style={{ opacity: 0.3, marginBottom: '1rem', color: '#3b82f6' }} />
                  <h4 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Módulo PPPoE - En Construcción</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto' }}>
                    El administrador podrá crear servidores PPPoE, perfiles de ancho de banda y secretos de clientes mediante un asistente (Wizard) paso a paso.
                  </p>
                </div>
              </div>
            )}

            {activeModule === 'queues' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div 
                  className="info-banner" 
                  style={{ borderLeftColor: '#d97706', border: '1px solid var(--border-color)', borderLeftWidth: '3px', backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <HelpCircle size={18} style={{ color: '#d97706' }} />
                    <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      Control de Ancho de Banda y Limitaciones (Queues)
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>
                    Controla los límites de velocidad de transmisión. Mapea la sintaxis de `/queue/simple` para aplicar límites duros de descarga y subida, ráfagas de velocidad temporales (Bursts) y priorización de tráfico (Priority 1 a 8) para asegurar estabilidad de red.
                  </p>
                </div>
                <div style={{ textAlign: 'center', padding: '4rem var(--text-muted)', border: '1px dashed var(--border-color)' }}>
                  <Sliders size={40} style={{ opacity: 0.3, marginBottom: '1rem', color: '#d97706' }} />
                  <h4 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Módulo de Colas (Queues) - En Construcción</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto' }}>
                    Aquí se visualizará la lista de colas simples y se permitirá la edición y reasignación de límites de velocidad por IP o interfaz de forma ágil.
                  </p>
                </div>
              </div>
            )}

            {activeModule === 'firewall' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div 
                  className="info-banner" 
                  style={{ borderLeftColor: '#dc2626', border: '1px solid var(--border-color)', borderLeftWidth: '3px', backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <HelpCircle size={18} style={{ color: '#dc2626' }} />
                    <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      Firewall, NAT y Listas de Direcciones de Seguridad
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>
                    Mapea el subsistema de red IP Filter y NAT del MikroTik. Permite ver las reglas de enmascaramiento (/ip/firewall/nat) para salida a Internet, reglas de filtro (/ip/firewall/filter) para drop o bloqueo, y listas de IPs de clientes bloqueados por falta de pago (Address-List "cortados").
                  </p>
                </div>
                <div style={{ textAlign: 'center', padding: '4rem var(--text-muted)', border: '1px dashed var(--border-color)' }}>
                  <ShieldAlert size={40} style={{ opacity: 0.3, marginBottom: '1rem', color: '#dc2626' }} />
                  <h4 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Módulo de Firewall - En Construcción</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto' }}>
                    Mostrará las reglas en cadena (forward, input, srcnat, dstnat) y la lista de clientes inhabilitados administrativamente.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Command Execution Console (Historical timeline log feed) */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={18} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#ffffff', margin: 0 }}>
                  Consola de Operaciones RouterOS (Logs de Comandos API)
                </h2>
              </div>
              <button 
                onClick={clearConsole} 
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              >
                Limpiar Terminal
              </button>
            </div>

            {/* Console viewport */}
            <div 
              ref={consoleContainerRef}
              style={{ 
                backgroundColor: '#070809', 
                border: '1px solid var(--border-color)', 
                height: '180px', 
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                color: '#888888',
                borderRadius: '0px'
              }}
            >
              {actionLogs.length === 0 ? (
                <div style={{ color: '#555555', fontStyle: 'italic' }}>
                  -- Consola inactiva. Realice alguna acción para ver los comandos enviados al API de MikroTik --
                </div>
              ) : (
                actionLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleTimeString();
                  return (
                    <div 
                      key={log.id} 
                      style={{ 
                        borderLeft: `2px solid ${log.success ? 'var(--color-success)' : 'var(--accent)'}`,
                        paddingLeft: '0.5rem',
                        lineHeight: 1.4
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                        <span style={{ color: log.success ? 'var(--color-success)' : 'var(--accent)', fontWeight: 'bold' }}>
                          {log.success ? '[OK]' : '[ERROR]'} {log.command}
                        </span>
                        <span style={{ color: '#444444' }}>{dateStr}</span>
                      </div>
                      <div style={{ color: '#dddddd', marginBottom: '0.15rem' }}>{log.friendlyMessage}</div>
                      {log.args && (
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          Parámetros: {JSON.stringify(log.args)}
                        </div>
                      )}
                      {log.errorDetails && (
                        <div style={{ color: 'var(--accent)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                          Detalle técnico: {log.errorDetails}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : nodes.length > 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem', borderLeft: '4px solid var(--accent)', borderRadius: '0px' }}>
          <Network size={48} style={{ opacity: 0.3, margin: '0 auto 1.5rem', color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '500', color: '#ffffff', marginBottom: '0.5rem' }}>
            Por favor, Seleccione un Nodo MikroTik
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto' }}>
            Utilice el selector en la esquina superior derecha para elegir el router MikroTik core que desea administrar.
            Una vez seleccionado, se activará el panel modular y la consola de comandos de RouterOS.
          </p>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem', borderRadius: '0px' }}>
          <Database size={48} style={{ opacity: 0.3, margin: '0 auto 1.5rem', color: 'var(--text-muted)' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '500', color: '#ffffff', marginBottom: '0.5rem' }}>
            No hay Nodos de Red Disponibles
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            Para poder gestionar las capacidades de red, debe agregar primero un nodo MikroTik activo en la base de datos.
          </p>
          <a href="/nodes" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0px' }}>
            Ir a Nodos de Red <ArrowRight size={16} />
          </a>
        </div>
      )}
    </div>
  );
};

export default MikrotikManagementCenter;
