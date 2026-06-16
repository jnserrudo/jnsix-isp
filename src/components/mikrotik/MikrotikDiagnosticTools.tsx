import React, { useState } from 'react';
import { Activity, Play, RefreshCw, Terminal } from 'lucide-react';
import { showToast } from '../../utils/toast';

interface Props {
  nodeId: string;
  token: string;
}

const MikrotikDiagnosticTools: React.FC<Props> = ({ nodeId, token }) => {
  const [targetIp, setTargetIp] = useState('');
  const [pingCount, setPingCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const handlePing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetIp) return;

    setLoading(true);
    setResults(null);
    try {
      const response = await fetch(`/api/nodes/${nodeId}/mikrotik/ping`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: targetIp, count: pingCount })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Error al ejecutar ping');
      }

      const { data } = await response.json();
      setResults(data);
      showToast('Diagnóstico finalizado', 'success');
    } catch (err: any) {
      showToast(err.message || 'Fallo de ping', 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Herramientas de Diagnóstico: Ping</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Utilice esta herramienta para verificar si una antena o dispositivo remoto tiene conexión a internet o a la red interna. El test se ejecuta desde el propio router MikroTik hacia el destino.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '2rem' }}>
        {/* Formulario Ping */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <Activity color="var(--accent)" />
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Prueba de Ping a Host</h3>
          </div>
          
          <form onSubmit={handlePing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Dirección IP o Dominio de Destino</label>
              <input 
                type="text" 
                placeholder="Ej: 8.8.8.8 o 192.168.88.20" 
                value={targetIp} 
                onChange={e => setTargetIp(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label>Cantidad de Paquetes</label>
              <input 
                type="number" 
                min={1} 
                max={20} 
                value={pingCount} 
                onChange={e => setPingCount(Number(e.target.value))} 
              />
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ marginTop: '0.5rem', justifyContent: 'center' }}
              disabled={loading || !targetIp}
            >
              {loading ? (
                <><RefreshCw size={16} className="animate-spin" /> Ejecutando Test...</>
              ) : (
                <><Play size={16} /> Iniciar Ping</>
              )}
            </button>
          </form>
        </div>

        {/* Resultados en Terminal Mockup */}
        <div className="card" style={{ backgroundColor: '#0a0a0a', border: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#888' }}>
            <Terminal size={16} />
            <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>mikrotik@routeros:~$ ping {targetIp || '...'}</span>
          </div>
          
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#0f0', minHeight: '200px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {loading ? (
              <span style={{ color: '#888', animation: 'pulse 2s infinite' }}>Haciendo ping a {targetIp}...</span>
            ) : results ? (
              results.length === 0 ? (
                <span style={{ color: '#f00' }}>El destino es inalcanzable (Timeout).</span>
              ) : (
                results.map((r, i) => (
                  <div key={i}>
                    {r.size} bytes from {r.host}: icmp_seq={r.sent} ttl={r.ttl} time={r.time}
                  </div>
                ))
              )
            ) : (
              <span style={{ color: '#555' }}>Esperando ejecución del test...</span>
            )}
            
            {results && results.length > 0 && (
              <div style={{ marginTop: '1rem', color: '#aaa' }}>
                --- {targetIp} ping statistics ---<br/>
                {results.length} packets transmitted, {results.length} received, 0% packet loss<br/>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MikrotikDiagnosticTools;
