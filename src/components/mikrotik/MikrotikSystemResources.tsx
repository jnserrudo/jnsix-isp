import React, { useEffect, useState } from 'react';
import { Cpu, HardDrive, Database, Info, Clock, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { showToast } from '../../utils/toast';

interface Props {
  nodeId: string;
  token: string;
}

interface SystemResourcesData {
  resource: {
    uptime?: string;
    version?: string;
    'build-time'?: string;
    'factory-software'?: string;
    'free-memory'?: string;
    'total-memory'?: string;
    cpu?: string;
    'cpu-count'?: string;
    'cpu-frequency'?: string;
    'cpu-load'?: string;
    'free-hdd-space'?: string;
    'total-hdd-space'?: string;
    'architecture-name'?: string;
    'board-name'?: string;
    platform?: string;
  };
  routerboard: {
    routerboard?: string;
    model?: string;
    'serial-number'?: string;
    'current-firmware'?: string;
    'upgrade-firmware'?: string;
  };
  identity: {
    name?: string;
  };
}

const MikrotikSystemResources: React.FC<Props> = ({ nodeId, token }) => {
  const [data, setData] = useState<SystemResourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/nodes/${nodeId}/mikrotik/system-resources`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al conectar con el router para obtener recursos de sistema.');
      }

      const resData = await response.json();
      setData(resData.data || null);
    } catch (err: any) {
      setError(err.message || 'Error de red');
      showToast(err.message || 'Error cargando recursos', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nodeId) {
      fetchResources();
    }
  }, [nodeId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem 0', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Obteniendo especificaciones del hardware...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <AlertCircle size={32} style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Error de Conectividad</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{error || 'No se pudo obtener información del router.'}</p>
        <button className="btn btn-secondary" onClick={fetchResources}>Reintentar Conexión</button>
      </div>
    );
  }

  const { resource, routerboard, identity } = data;

  // RAM calculations
  const totalMem = parseInt(resource['total-memory'] || '0');
  const freeMem = parseInt(resource['free-memory'] || '0');
  const usedMem = totalMem - freeMem;
  const memUsedPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
  const totalMemMB = totalMem > 0 ? (totalMem / (1024 * 1024)).toFixed(1) : '0';
  const freeMemMB = freeMem > 0 ? (freeMem / (1024 * 1024)).toFixed(1) : '0';
  const usedMemMB = usedMem > 0 ? (usedMem / (1024 * 1024)).toFixed(1) : '0';

  // HDD calculations
  const totalHdd = parseInt(resource['total-hdd-space'] || '0');
  const freeHdd = parseInt(resource['free-hdd-space'] || '0');
  const usedHdd = totalHdd - freeHdd;
  const hddUsedPercent = totalHdd > 0 ? Math.round((usedHdd / totalHdd) * 100) : 0;
  const totalHddMB = totalHdd > 0 ? (totalHdd / (1024 * 1024)).toFixed(1) : '0';
  const freeHddMB = freeHdd > 0 ? (freeHdd / (1024 * 1024)).toFixed(1) : '0';
  const usedHddMB = usedHdd > 0 ? (usedHdd / (1024 * 1024)).toFixed(1) : '0';

  // CPU Load
  const cpuLoad = parseInt(resource['cpu-load'] || '0');

  // Helper to determine status bar color
  const getProgressColor = (percent: number) => {
    if (percent > 85) return 'var(--accent)'; // Red/Orange
    if (percent > 60) return 'var(--color-warning)'; // Yellow
    return 'var(--color-success)'; // Green
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Identity Banner */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderLeft: '4px solid var(--color-success)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
              Identidad de RouterOS (System Identity)
            </span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.25rem 0 0 0', color: '#ffffff' }}>
              {identity?.name || 'MikroTik'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modelo de Placa</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{routerboard?.model || resource['board-name'] || 'Genérico'}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Versión del OS</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-success)' }}>RouterOS v{resource.version || 'Desconocida'}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiempo Encendido (Uptime)</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>{resource.uptime || 'Desconocido'}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top Cards for Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.25rem' }}>
        
        {/* CPU Load */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Activity size={16} />
              <span>Carga de CPU</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {resource['cpu-frequency'] || 'N/D'}
            </span>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>{cpuLoad}%</div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${cpuLoad}%`, 
                  backgroundColor: getProgressColor(cpuLoad),
                  transition: 'width 0.5s ease-in-out'
                }} 
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Núcleos: {resource['cpu-count'] || '1'}</span>
            <span>Tipo: {resource.cpu || 'Genérico'}</span>
          </div>
        </div>

        {/* Memory RAM */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Cpu size={16} />
              <span>Memoria RAM</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {memUsedPercent}% Usado
            </span>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>{usedMemMB} MB</div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${memUsedPercent}%`, 
                  backgroundColor: getProgressColor(memUsedPercent),
                  transition: 'width 0.5s ease-in-out'
                }} 
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Libre: {freeMemMB} MB</span>
            <span>Total: {totalMemMB} MB</span>
          </div>
        </div>

        {/* Almacenamiento HDD */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <HardDrive size={16} />
              <span>Espacio HDD</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {hddUsedPercent}% Usado
            </span>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>{usedHddMB} MB</div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${hddUsedPercent}%`, 
                  backgroundColor: getProgressColor(hddUsedPercent),
                  transition: 'width 0.5s ease-in-out'
                }} 
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Libre: {freeHddMB} MB</span>
            <span>Total: {totalHddMB} MB</span>
          </div>
        </div>

      </div>

      {/* Main Details and Hardware Table */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '2rem' }}>
        
        {/* Hardware Specifications */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Database size={18} color="var(--accent)" />
            <h3 style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>Especificaciones del Routerboard</h3>
          </div>
          
          <table className="table-wrapper" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Modelo Físico</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                  {routerboard.model || resource['board-name'] || 'Genérico'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Número de Serie</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                  {routerboard['serial-number'] || 'N/D'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Arquitectura de CPU</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                  {resource['architecture-name'] || 'N/D'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Tiene Hardware Routerboard</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-main)' }}>
                  {routerboard.routerboard === 'yes' ? 'Sí (Hardware Oficial)' : 'No (Instancia x86/Cloud)'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Plataforma Operativa</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-main)', fontWeight: 600 }}>
                  {resource.platform || 'RouterOS'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Software & Firmware Info */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Info size={18} color="var(--color-success)" />
            <h3 style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>Firmware & Uptime</h3>
          </div>
          
          <table className="table-wrapper" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Versión de RouterOS</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                  v{resource.version || 'Desconocida'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Firmware RouterBOOT</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-main)' }}>
                  {routerboard['current-firmware'] ? `v${routerboard['current-firmware']}` : 'N/D'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Firmware Disponible (Upgrade)</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-main)' }}>
                  {routerboard['upgrade-firmware'] ? `v${routerboard['upgrade-firmware']}` : 'N/D'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Software de Fábrica</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-muted)' }}>
                  v{resource['factory-software'] || 'N/D'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  <Clock size={14} /> Tiempo Encendido (Uptime)
                </td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                  {resource.uptime || 'Desconocido'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* Manual Refresh Row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem' }}>
        <button className="btn btn-secondary" onClick={fetchResources}>
          <RefreshCw size={14} style={{ marginRight: '0.5rem' }} />
          Actualizar Recursos
        </button>
      </div>

    </div>
  );
};

export default MikrotikSystemResources;
