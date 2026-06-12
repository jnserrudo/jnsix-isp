import { useState } from 'react';
import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

export default function MikrotikTest() {
  const [credentials, setCredentials] = useState({
    host: '10.205.136.198',
    port: '8728',
    user: 'admin-isp',
    password: '',
  });

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estados para pruebas específicas
  const [command, setCommand] = useState('/system/resource/print');
  const [pppoeData, setPppoeData] = useState({
    username: 'test_user',
    password: 'test123',
    profile: 'default',
  });
  const [queueData, setQueueData] = useState({
    name: 'test_queue',
    target: '192.168.1.100/32',
    maxLimit: '10M/10M',
  });
  const [resourceType, setResourceType] = useState('secrets');

  const getToken = () => {
    return localStorage.getItem('token');
  };

  const setOperationLoading = (op: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [op]: isLoading }));
  };

  const setOperationResult = (op: string, data: any) => {
    setResults(prev => ({ ...prev, [op]: data }));
  };

  const setOperationError = (op: string, msg: string) => {
    setErrors(prev => ({ ...prev, [op]: msg }));
  };

  const testConnection = async () => {
    setOperationLoading('connection', true);
    setOperationError('connection', '');
    setOperationResult('connection', null);
    console.log('Iniciando prueba de conexión con:', credentials);

    try {
      const response = await axios.post(
        `${API_URL}/api/mikrotik-test/connection`,
        credentials,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      console.log('Respuesta del backend:', response.data);
      
      setOperationResult('connection', {
        success: response.data.success ?? false,
        message: response.data.message || 'Sin mensaje',
        data: response.data.data || null,
      });
    } catch (err: any) {
      console.error('Error en la petición:', err);
      setOperationError('connection', err.response?.data?.error || err.message);
      setOperationResult('connection', {
        success: false,
        message: err.response?.data?.message || err.message || 'Error desconocido',
        error: err.response?.data?.error || err.message
      });
    } finally {
      setOperationLoading('connection', false);
    }
  };

  const executeCommand = async () => {
    setOperationLoading('command', true);
    setOperationError('command', '');
    setOperationResult('command', null);

    try {
      const response = await axios.post(
        `${API_URL}/api/mikrotik-test/command`,
        { ...credentials, command },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      setOperationResult('command', response.data);
    } catch (err: any) {
      setOperationError('command', err.response?.data?.error || err.message);
      setOperationResult('command', {
        success: false,
        message: err.response?.data?.message || err.message || 'Error desconocido',
        error: err.response?.data?.error || err.message
      });
    } finally {
      setOperationLoading('command', false);
    }
  };

  const createPPPoESecret = async () => {
    setOperationLoading('pppoe', true);
    setOperationError('pppoe', '');
    setOperationResult('pppoe', null);

    try {
      const response = await axios.post(
        `${API_URL}/api/mikrotik-test/pppoe-secret/create`,
        { ...credentials, ...pppoeData },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      setOperationResult('pppoe', response.data);
    } catch (err: any) {
      setOperationError('pppoe', err.response?.data?.error || err.message);
      setOperationResult('pppoe', {
        success: false,
        message: err.response?.data?.message || err.message || 'Error desconocido',
        error: err.response?.data?.error || err.message
      });
    } finally {
      setOperationLoading('pppoe', false);
    }
  };

  const createQueue = async () => {
    setOperationLoading('queue', true);
    setOperationError('queue', '');
    setOperationResult('queue', null);

    try {
      const response = await axios.post(
        `${API_URL}/api/mikrotik-test/queue/create`,
        { ...credentials, ...queueData },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      setOperationResult('queue', response.data);
    } catch (err: any) {
      setOperationError('queue', err.response?.data?.error || err.message);
      setOperationResult('queue', {
        success: false,
        message: err.response?.data?.message || err.message || 'Error desconocido',
        error: err.response?.data?.error || err.message
      });
    } finally {
      setOperationLoading('queue', false);
    }
  };

  const listResources = async () => {
    setOperationLoading('list', true);
    setOperationError('list', '');
    setOperationResult('list', null);

    try {
      const response = await axios.post(
        `${API_URL}/api/mikrotik-test/list`,
        { ...credentials, resource: resourceType },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      setOperationResult('list', response.data);
    } catch (err: any) {
      setOperationError('list', err.response?.data?.error || err.message);
      setOperationResult('list', {
        success: false,
        message: err.response?.data?.message || err.message || 'Error desconocido',
        error: err.response?.data?.error || err.message
      });
    } finally {
      setOperationLoading('list', false);
    }
  };

  const initializeRouter = async () => {
    setOperationLoading('init', true);
    setOperationError('init', '');
    setOperationResult('init', null);

    try {
      const response = await axios.post(
        `${API_URL}/api/mikrotik-test/initialize`,
        credentials,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      setOperationResult('init', response.data);
    } catch (err: any) {
      setOperationError('init', err.response?.data?.error || err.message);
      setOperationResult('init', {
        success: false,
        message: err.response?.data?.message || err.message || 'Error desconocido',
        error: err.response?.data?.error || err.message
      });
    } finally {
      setOperationLoading('init', false);
    }
  };

  const renderResult = (op: string) => {
    const res = results[op];
    const err = errors[op];
    
    if (err) {
      return (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem', color: '#ffffff' }}>Error</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{err}</p>
        </div>
      );
    }
    
    if (!res) return null;
    
    if (res.success) {
      return (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem', color: '#ffffff' }}>Operación Exitosa</h3>
          {res.message && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>{res.message}</p>
          )}
          
          {res.data && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Información del Sistema</h4>
              {res.data.systemIdentity && res.data.systemIdentity[0] && (
                <div style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', minWidth: '100px' }}>Nombre:</span>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>{res.data.systemIdentity[0].name || 'N/A'}</span>
                </div>
              )}
              {res.data.systemResource && res.data.systemResource[0] && (
                <>
                  <div style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', minWidth: '100px' }}>Versión:</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>{res.data.systemResource[0].version || 'N/A'}</span>
                  </div>
                  <div style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', minWidth: '100px' }}>Plataforma:</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>{res.data.systemResource[0].platform || 'N/A'}</span>
                  </div>
                  <div style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', minWidth: '100px' }}>Uptime:</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>{res.data.systemResource[0].uptime || 'N/A'}</span>
                  </div>
                  <div style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', minWidth: '100px' }}>CPU:</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>{res.data.systemResource[0]['cpu-load'] || '0'}%</span>
                  </div>
                  <div style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', minWidth: '100px' }}>Memoria Libre:</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      {res.data.systemResource[0]['free-memory'] ? 
                        `${(parseInt(res.data.systemResource[0]['free-memory']) / 1024 / 1024).toFixed(2)} MB` : 
                        'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          
          {res.steps && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pasos Ejecutados</h4>
              {res.steps.map((step: string, index: number) => (
                <div key={index} style={{ marginBottom: '0.25rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>{step}</div>
              ))}
            </div>
          )}
          
          {res.result && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)', userSelect: 'none', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                Ver JSON Completo
              </summary>
              <pre style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', overflow: 'auto', maxHeight: '400px', fontSize: '0.75rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                {JSON.stringify(res, null, 2)}
              </pre>
            </details>
          )}
        </div>
      );
    }
    
    return (
      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem', color: '#ffffff' }}>Error en la Operación</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{res.message || res.error || 'Error desconocido'}</p>
      </div>
    );
  };

  return (
    <div className="page-wrapper">
      <div className="page-header-section">
        <h1 className="page-title">Pruebas MikroTik</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Herramientas de diagnóstico y prueba de conexión</p>
      </div>

      {/* Credenciales */}
      <div className="data-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1.5rem', color: '#ffffff' }}>Credenciales de Conexión</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label className="form-label">IP/Host</label>
            <input
              type="text"
              value={credentials.host}
              onChange={(e) =>
                setCredentials({ ...credentials, host: e.target.value })
              }
              className="form-input"
              placeholder="192.168.60.1"
            />
          </div>
          <div>
            <label className="form-label">Puerto</label>
            <input
              type="text"
              value={credentials.port}
              onChange={(e) =>
                setCredentials({ ...credentials, port: e.target.value })
              }
              className="form-input"
              placeholder="8728"
            />
          </div>
          <div>
            <label className="form-label">Usuario</label>
            <input
              type="text"
              value={credentials.user}
              onChange={(e) =>
                setCredentials({ ...credentials, user: e.target.value })
              }
              className="form-input"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
              className="form-input"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      {/* Test de Conexión */}
      <div className="data-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1.5rem', color: '#ffffff' }}>1. Test de Conexión</h2>
        <button
          onClick={testConnection}
          disabled={loading['connection']}
          className="btn btn-primary"
        >
          {loading['connection'] ? 'Probando...' : 'Probar Conexión'}
        </button>
        {loading['connection'] && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Conectando a MikroTik...
          </div>
        )}
        {renderResult('connection')}
      </div>

      {/* Inicializar Router */}
      <div className="data-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1.5rem', color: '#ffffff' }}>2. Inicializar Router</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Crea la regla de firewall y address-list necesarias para el sistema
        </p>
        <button
          onClick={initializeRouter}
          disabled={loading['init']}
          className="btn btn-success"
        >
          {loading['init'] ? 'Inicializando...' : 'Inicializar Router'}
        </button>
        {renderResult('init')}
      </div>

      {/* Comandos Manuales */}
      <div className="data-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1.5rem', color: '#ffffff' }}>3. Ejecutar Comando Manual</h2>
        <div style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Comando RouterOS</label>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="form-input"
            style={{ fontFamily: 'monospace' }}
            placeholder="/system/resource/print"
          />
        </div>
        <button
          onClick={executeCommand}
          disabled={loading['command']}
          className="btn btn-primary"
        >
          {loading['command'] ? 'Ejecutando...' : 'Ejecutar Comando'}
        </button>
        {renderResult('command')}
      </div>

      {/* Crear Secret PPPoE */}
      <div className="data-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1.5rem', color: '#ffffff' }}>4. Crear Secret PPPoE</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <label className="form-label">Username</label>
            <input
              type="text"
              value={pppoeData.username}
              onChange={(e) =>
                setPppoeData({ ...pppoeData, username: e.target.value })
              }
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input
              type="text"
              value={pppoeData.password}
              onChange={(e) =>
                setPppoeData({ ...pppoeData, password: e.target.value })
              }
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Profile</label>
            <input
              type="text"
              value={pppoeData.profile}
              onChange={(e) =>
                setPppoeData({ ...pppoeData, profile: e.target.value })
              }
              className="form-input"
            />
          </div>
        </div>
        <button
          onClick={createPPPoESecret}
          disabled={loading['pppoe']}
          className="btn btn-primary"
        >
          {loading['pppoe'] ? 'Creando...' : 'Crear Secret'}
        </button>
        {renderResult('pppoe')}
      </div>

      {/* Crear Queue */}
      <div className="data-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1.5rem', color: '#ffffff' }}>5. Crear Queue</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <label className="form-label">Nombre</label>
            <input
              type="text"
              value={queueData.name}
              onChange={(e) =>
                setQueueData({ ...queueData, name: e.target.value })
              }
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Target (IP/Username)</label>
            <input
              type="text"
              value={queueData.target}
              onChange={(e) =>
                setQueueData({ ...queueData, target: e.target.value })
              }
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Max Limit (Upload/Download)</label>
            <input
              type="text"
              value={queueData.maxLimit}
              onChange={(e) =>
                setQueueData({ ...queueData, maxLimit: e.target.value })
              }
              className="form-input"
              placeholder="10M/10M"
            />
          </div>
        </div>
        <button
          onClick={createQueue}
          disabled={loading['queue']}
          className="btn btn-primary"
        >
          {loading['queue'] ? 'Creando...' : 'Crear Queue'}
        </button>
        {renderResult('queue')}
      </div>

      {/* Listar Recursos */}
      <div className="data-card" style={{ marginBottom: '2rem', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1.5rem', color: '#ffffff' }}>6. Listar Recursos</h2>
        <div style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Tipo de Recurso</label>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="form-input"
          >
            <option value="secrets">PPPoE Secrets</option>
            <option value="queues">Queues</option>
            <option value="active-pppoe">Sesiones PPPoE Activas</option>
            <option value="address-list">Address Lists</option>
            <option value="firewall-filter">Reglas de Firewall</option>
          </select>
        </div>
        <button
          onClick={listResources}
          disabled={loading['list']}
          className="btn btn-primary"
        >
          {loading['list'] ? 'Listando...' : 'Listar'}
        </button>
        {renderResult('list')}
      </div>

    </div>
  );
}
