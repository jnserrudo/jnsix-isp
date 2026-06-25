import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, X, RefreshCw, MoreVertical, WifiOff, Shuffle } from 'lucide-react';
import { showToast } from '../utils/toast';
import { fetchWithRetry } from '../utils/apiFetch';
import MapPicker from '../components/MapPicker';
import TablePagination from '../components/mikrotik/TablePagination';
import SkeletonTable from '../components/SkeletonTable';
import TopProgressBar from '../components/TopProgressBar';
import FormAlert from '../components/FormAlert';

interface Contract {
  id: string;
  pppoeUsername: string | null;
  pppoePassword: string | null;
  staticIp: string | null;
  macAddress: string | null;
  node: {
    id: string;
    name: string;
  };
  plan?: {
    name: string;
  };
}

interface Client {
  id: string;
  fullName: string;
  dni: string;
  phone1: string | null;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELINQUENT' | 'CANCELLED';
  address: string;
  createdAt: string;
  contracts?: Contract[];
}

interface ClientsProps {
  token: string;
  userRole: string;
}

const Clients: React.FC<ClientsProps> = ({ token, userRole }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nodeFilter, setNodeFilter] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);

  const generateClientCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await fetchWithRetry('/api/clients/generate-code', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClientCode(data.code);
        if (formError) setFormError('');
      }
    } catch (e) {
      showToast('No se pudo generar el código', 'warning');
    } finally {
      setGeneratingCode(false);
    }
  };
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [configError, setConfigError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Config Router states
  const [configTarget, setConfigTarget] = useState<{ id: string; name: string, contractId: string, nodeName: string } | null>(null);
  const [configType, setConfigType] = useState<'PPPoE' | 'StaticIP'>('PPPoE');
  const [configUsername, setConfigUsername] = useState('');
  const [configPassword, setConfigPassword] = useState('');
  const [configIp, setConfigIp] = useState('');
  const [configSubmitting, setConfigSubmitting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, nodeFilter, connectionFilter, planFilter]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithRetry('/api/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setClients(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [token]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName || !dni || !address) {
      setFormError('Nombre, DNI y Dirección son requeridos');
      return;
    }

    const latNum = latitude ? parseFloat(latitude) : null;
    const lngNum = longitude ? parseFloat(longitude) : null;

    if (latNum !== null && (isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setFormError('La latitud debe estar entre -90 y 90');
      return;
    }
    if (lngNum !== null && (isNaN(lngNum) || lngNum < -180 || lngNum > 180)) {
      setFormError('La longitud debe estar entre -180 y 180');
      return;
    }


    setSubmitting(true);
    showToast('Guardando cliente...', 'info');
    try {
      const response = await fetchWithRetry('/api/clients', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName,
          dni,
          clientCode,
          phone1,
          phone2,
          email,
          address,
          latitude: latNum,
          longitude: lngNum,
          notes
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al crear cliente');

      showToast('Cliente guardado con éxito', 'success');
      // Clear form and reload list
      setIsModalOpen(false);
      setFullName('');
      setDni('');
      setClientCode('');
      setPhone1('');
      setPhone2('');
      setEmail('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setNotes('');
      fetchClients();
    } catch (err: any) {
      const errMsg = err.message || 'Error guardando cliente';
      setFormError(errMsg);
      showToast(errMsg, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    showToast('Eliminando cliente...', 'info');
    try {
      const response = await fetchWithRetry(`/api/clients/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar cliente');
      }
      showToast('Cliente eliminado con éxito', 'success');
      fetchClients();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar cliente', 'warning');
    }
  };

  const handleConfigureRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError('');
    if (!configTarget) return;

    const payload: any = {};
    if (configType === 'PPPoE') {
      if (!configUsername || !configPassword) {
        setConfigError('Complete usuario y contraseña PPPoE');
        return;
      }
      payload.pppoeUsername = configUsername;
      payload.pppoePassword = configPassword;
    } else {
      if (!configIp) {
        setConfigError('Complete la dirección IP Estática');
        return;
      }
      payload.staticIp = configIp;
    }

    setConfigSubmitting(true);
    try {
      const response = await fetchWithRetry(`/api/contracts/${configTarget.contractId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al configurar en router');
      }

      showToast('Configuración guardada y sincronizada con el router', 'success');
      setConfigTarget(null);
      // Reset form
      setConfigUsername('');
      setConfigPassword('');
      setConfigIp('');
      fetchClients();
    } catch (err: any) {
      showToast(err.message || 'Error al configurar', 'warning');
    } finally {
      setConfigSubmitting(false);
    }
  };

  // Filters logic
  const uniqueNodes = Array.from(new Set(clients.flatMap(c => c.contracts?.map(contract => contract.node?.name) || []).filter(Boolean))).sort();
  const uniquePlans = Array.from(new Set(clients.flatMap(c => c.contracts?.map(contract => contract.plan?.name) || []).filter(Boolean))).sort();

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) || 
                          c.dni.includes(search) || 
                          (c.phone1 && c.phone1.includes(search));
    const matchesStatus = statusFilter === '' || c.status === statusFilter;
    
    let matchesNode = true;
    if (nodeFilter !== '') {
      matchesNode = c.contracts?.some(contract => contract.node?.name === nodeFilter) ?? false;
    }

    let matchesPlan = true;
    if (planFilter !== '') {
      matchesPlan = c.contracts?.some(contract => contract.plan?.name === planFilter) ?? false;
    }

    let matchesConnection = true;
    if (connectionFilter !== '') {
      if (connectionFilter === 'PPPoE') {
        matchesConnection = c.contracts?.some(contract => !!contract.pppoeUsername) ?? false;
      } else if (connectionFilter === 'StaticIP') {
        matchesConnection = c.contracts?.some(contract => !!contract.staticIp) ?? false;
      } else if (connectionFilter === 'UNCONFIGURED') {
        matchesConnection = c.contracts?.some(contract => !contract.pppoeUsername && !contract.staticIp) ?? false;
      }
    }

    return matchesSearch && matchesStatus && matchesNode && matchesPlan && matchesConnection;
  });

  const totalItems = filteredClients.length;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + rowsPerPage);

  const unconfiguredCount = clients.filter(c => 
    c.contracts?.some(contract => !contract.pppoeUsername && !contract.staticIp)
  ).length;

  return (
    <div className="page-container">
      <TopProgressBar loading={loading} />
      {/* Header section */}
      <div className="title-block">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Clientes</h2>
          <span style={{ color: 'var(--text-muted)' }}>Lista de usuarios de red y contratos</span>
        </div>
        {userRole !== 'READONLY' && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Unconfigured Alert Banner */}
      {unconfiguredCount > 0 && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--accent)', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              !
            </div>
            <div>
              <h3 style={{ color: 'var(--accent)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Atención: Hay {unconfiguredCount} cliente{unconfiguredCount !== 1 ? 's' : ''} sin configurar en el router</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                Estos clientes tienen contrato activo pero MikroTik no puede aplicarles reglas de velocidad o cortes.
              </p>
            </div>
          </div>
          <button 
            className="btn" 
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
            onClick={() => setConnectionFilter('UNCONFIGURED')}
          >
            Ver clientes afectados
          </button>
        </div>
      )}

      {/* Educational description box */}
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem' }}>Gestión de Clientes</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Desde esta sección puede dar de alta nuevos clientes y administrar sus datos personales. 
          Al registrar las coordenadas GPS (latitud y longitud), el sistema mapeará la ubicación física del cliente, 
          permitiendo al equipo técnico ubicar el domicilio del abonado y diagramar el tendido de fibra óptica. 
          Use la barra de búsqueda para filtrar rápidamente por nombre, DNI o número de contacto.
        </p>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, DNI o teléfono..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
        <div style={{ width: '160px' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Estados: Todos</option>
            <option value="ACTIVE">Activo</option>
            <option value="SUSPENDED">Suspendido</option>
            <option value="DELINQUENT">Moroso</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)}>
            <option value="">MikroTik: Todos</option>
            {uniqueNodes.map(node => (
              <option key={node} value={node}>{node}</option>
            ))}
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="">Planes: Todos</option>
            {uniquePlans.map(plan => (
              <option key={plan} value={plan}>{plan}</option>
            ))}
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <select value={connectionFilter} onChange={(e) => setConnectionFilter(e.target.value)}>
            <option value="">Red: Todas</option>
            <option value="PPPoE">PPPoE</option>
            <option value="StaticIP">IP Estática</option>
            <option value="UNCONFIGURED">Sin configurar</option>
          </select>
        </div>
      </div>

      {/* Main List Table */}
      {loading ? (
        <SkeletonTable rows={8} columns={['28%', '14%', '15%', '18%', '12%', '13%']} />
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <WifiOff size={48} style={{ marginBottom: '1rem', opacity: 0.5, margin: '0 auto' }} />
          <h3>Error de conexión</h3>
          <p style={{ marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchClients}>
            <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
            Reintentar
          </button>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No se encontraron clientes registrados con los filtros aplicados.
        </div>
      ) : (
        <div>
        <div className="table-wrapper desktop-only">
          <table>
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th className="desktop-only">DNI / Identificación</th>
                <th className="desktop-only">Contacto</th>
                <th className="desktop-only">Conexión / Red</th>
                <th>Estado</th>
                <th className="desktop-only">Dirección</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.map((client) => (
                <tr key={client.id} className="table-row-hover">
                  <td data-label="Nombre Completo" style={{ fontWeight: 600 }}>
                    <Link to={`/clients/${client.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-block' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {client.fullName}
                      </div>
                    </Link>
                    <div className="mobile-only" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '0.25rem', fontFamily: 'monospace', lineHeight: 1.3 }}>
                      DNI: {client.dni} <br />
                      Tel: {client.phone1 || 'Sin contacto'} <br />
                      Dir: {client.address} <br />
                      {client.contracts && client.contracts.length > 0 ? (
                        (() => {
                          const contract = client.contracts[0];
                          if (contract.pppoeUsername) {
                            return <span style={{ color: 'var(--color-success)' }}>Red: PPPoE ({contract.pppoeUsername})</span>;
                          } else if (contract.staticIp) {
                            return <span style={{ color: 'var(--color-warning)' }}>Red: IP Fija ({contract.staticIp})</span>;
                          }
                          return <span>Red: Sin configurar</span>;
                        })()
                      ) : (
                        <span>Red: Sin contrato</span>
                      )}
                    </div>
                  </td>
                  <td data-label="DNI" className="desktop-only">{client.dni}</td>
                  <td data-label="Contacto" className="desktop-only">{client.phone1 || client.email || 'Sin contacto'}</td>
                  <td data-label="Conexión" className="desktop-only" style={{ fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.3 }}>
                    {client.contracts && client.contracts.length > 0 ? (
                      (() => {
                        const contract = client.contracts[0];
                        if (contract.pppoeUsername) {
                          return (
                            <div>
                              <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>PPPoE: </span>
                              <code>{contract.pppoeUsername}</code>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MikroTik: {contract.node.name}</div>
                            </div>
                          );
                        } else if (contract.staticIp) {
                          return (
                            <div>
                              <span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>IP Estática: </span>
                              <code>{contract.staticIp}</code>
                              {contract.macAddress && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MAC: {contract.macAddress}</div>}
                            </div>
                          );
                        } else {
                          return <span style={{ color: 'var(--text-muted)' }}>Sin configurar en router</span>;
                        }
                      })()
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Sin contrato</span>
                    )}
                  </td>
                  <td data-label="Estado">
                    <span className={`badge ${
                      client.status === 'ACTIVE' ? 'badge-active' :
                      client.status === 'SUSPENDED' ? 'badge-suspended' :
                      client.status === 'DELINQUENT' ? 'badge-delinquent' : 'badge-cancelled'
                    }`}>
                      {client.status === 'ACTIVE' ? 'Activo' :
                       client.status === 'SUSPENDED' ? 'Suspendido' :
                       client.status === 'DELINQUENT' ? 'Moroso' : 'Cancelado'}
                    </span>
                  </td>
                  <td data-label="Dirección" className="desktop-only" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.address}
                  </td>
                  <td data-label="Acciones" style={{ textAlign: 'right', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', position: 'relative' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ padding: '0.4rem', minWidth: '32px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === client.id ? null : client.id);
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {activeDropdown === client.id && (
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
                          <Link 
                            to={`/clients/${client.id}`}
                            className="action-menu-item"
                            style={{
                              display: 'block',
                              padding: '0.6rem 1rem',
                              color: 'var(--text-main)',
                              textDecoration: 'none',
                              fontSize: '0.85rem',
                              borderBottom: '1px solid var(--border-color)'
                            }}
                            onClick={() => setActiveDropdown(null)}
                          >
                            Ver Ficha
                          </Link>
                          {userRole !== 'READONLY' && (
                            <Link 
                              to={`/clients/${client.id}?edit=true`}
                              className="action-menu-item"
                              style={{
                                display: 'block',
                                padding: '0.6rem 1rem',
                                color: 'var(--text-main)',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                                borderBottom: '1px solid var(--border-color)'
                              }}
                              onClick={() => setActiveDropdown(null)}
                            >
                              Editar Datos
                            </Link>
                          )}
                          {client.contracts && client.contracts.length > 0 && !client.contracts[0].pppoeUsername && !client.contracts[0].staticIp && (
                            <button
                              className="action-menu-item"
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.6rem 1rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-success)',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-color)'
                              }}
                              onClick={() => {
                                setActiveDropdown(null);
                                setConfigTarget({ 
                                  id: client.id, 
                                  name: client.fullName, 
                                  contractId: client.contracts![0].id,
                                  nodeName: client.contracts![0].node.name 
                                });
                              }}
                            >
                              Configurar en Router
                            </button>
                          )}
                          {userRole === 'ADMIN' && (
                            <button
                              className="action-menu-item danger"
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
                                setDeleteTarget({ id: client.id, name: client.fullName });
                              }}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
        
        {/* Mobile View */}
        <div className="mobile-only mobile-card-list">
          {paginatedClients.map((client) => (
            <div key={client.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <div className="mobile-card-title">{client.fullName}</div>
                <span className={`badge ${
                  client.status === 'ACTIVE' ? 'badge-active' :
                  client.status === 'SUSPENDED' ? 'badge-suspended' :
                  client.status === 'DELINQUENT' ? 'badge-delinquent' : 'badge-cancelled'
                }`}>
                  {client.status === 'ACTIVE' ? 'Activo' :
                   client.status === 'SUSPENDED' ? 'Suspendido' :
                   client.status === 'DELINQUENT' ? 'Moroso' : 'Cancelado'}
                </span>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-row">
                  <div className="mobile-card-label">DNI</div>
                  <div className="mobile-card-value">{client.dni}</div>
                </div>
                <div className="mobile-card-row">
                  <div className="mobile-card-label">Contacto</div>
                  <div className="mobile-card-value">{client.phone1 || client.email || 'Sin contacto'}</div>
                </div>
                {client.contracts && client.contracts.length > 0 ? (
                  <div className="mobile-card-row">
                    <div className="mobile-card-label">Conexión</div>
                    <div className="mobile-card-value" style={{textAlign: 'right'}}>
                      {client.contracts[0].pppoeUsername ? (
                        <>
                          <div style={{color: 'var(--color-success)', fontWeight: 'bold'}}>PPPoE</div>
                          <div>{client.contracts[0].pppoeUsername}</div>
                        </>
                      ) : client.contracts[0].staticIp ? (
                        <>
                          <div style={{color: 'var(--color-warning)', fontWeight: 'bold'}}>IP Estática</div>
                          <div>{client.contracts[0].staticIp}</div>
                        </>
                      ) : (
                        <div style={{color: 'var(--text-muted)'}}>Sin configurar</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mobile-card-row">
                    <div className="mobile-card-label">Red</div>
                    <div className="mobile-card-value" style={{color: 'var(--text-muted)'}}>Sin contrato</div>
                  </div>
                )}
                {client.address && (
                  <div className="mobile-card-row">
                    <div className="mobile-card-label">Dirección</div>
                    <div className="mobile-card-value">{client.address}</div>
                  </div>
                )}
              </div>
              <div className="mobile-card-footer" style={{flexWrap: 'wrap'}}>
                {client.contracts && client.contracts.length > 0 && !client.contracts[0].pppoeUsername && !client.contracts[0].staticIp && (
                  <button 
                    className="btn btn-warning btn-sm" 
                    style={{flex: '1 1 100%', textAlign: 'center', marginBottom: '0.5rem'}}
                    onClick={() => setConfigTarget({
                      id: client.id,
                      name: client.fullName,
                      contractId: client.contracts![0].id,
                      nodeName: client.contracts![0].node.name 
                    })}
                  >
                    Configurar en Router
                  </button>
                )}
                <Link to={`/clients/${client.id}`} className="btn btn-secondary btn-sm" style={{flex: 1, textAlign: 'center'}}>Ver Ficha</Link>
                {userRole !== 'READONLY' && (
                  <Link to={`/clients/${client.id}?edit=true`} className="btn btn-primary btn-sm" style={{flex: 1, textAlign: 'center', marginLeft: '0.5rem'}}>Editar</Link>
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

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Crear Nuevo Cliente</h3>
            
            <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body">
                <FormAlert message={formError} />
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input type="text" className={!fullName && formError ? "input-error" : ""} placeholder="Ej: Nahuel Dev" value={fullName} onChange={(e) => { setFullName(e.target.value); if (formError) setFormError(""); }} />
                </div>
                
                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>DNI *</label>
                    <input type="text" className={!dni && formError ? "input-error" : ""} placeholder="DNI sin puntos" value={dni} onChange={(e) => { setDni(e.target.value); if (formError) setFormError(""); }} />
                  </div>
                  <div className="form-group">
                    <label>Código de Cliente *</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className={!clientCode && formError ? 'input-error' : ''}
                        placeholder="Ej: CLI-4A2X"
                        value={clientCode}
                        onChange={(e) => { setClientCode(e.target.value); if (formError) setFormError(''); }}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={generateClientCode}
                        disabled={generatingCode}
                        title="Generar código aleatorio"
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
                      Identificador unico del abonado. Lo usara para acceder al Portal de Autogestión. Usa "Generar" para crear uno automaticamente.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Email</label>
                    <input type="email" placeholder="ejemplo@correo.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Teléfono Principal</label>
                    <input type="text" placeholder="Teléfono" value={phone1} onChange={e => setPhone1(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Teléfono Secundario</label>
                    <input type="text" placeholder="Alternativo" value={phone2} onChange={e => setPhone2(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dirección Completa (con referencias) *</label>
                  <textarea rows={2} placeholder="Ej: Calle Falsa 123. Casa portón verde frente al kiosco." value={address} onChange={e => setAddress(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>Ubicación Geográfica (Haga clic en el mapa o arrastre el marcador)</label>
                  <div style={{ height: '220px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                    <MapPicker
                      lat={latitude}
                      lng={longitude}
                      onLocationSelect={(lat, lng) => {
                        setLatitude(lat.toFixed(6));
                        setLongitude(lng.toFixed(6));
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Latitud GPS (Solo Lectura)</label>
                    <input type="text" value={latitude} readOnly placeholder="Seleccione en el mapa..." style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }} />
                  </div>
                  <div className="form-group">
                    <label>Longitud GPS (Solo Lectura)</label>
                    <input type="text" value={longitude} readOnly placeholder="Seleccione en el mapa..." style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notas de Campo / Observaciones</label>
                  <textarea rows={2} placeholder="Comentarios del técnico, tendido de cable, árboles..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Guardando...
                    </>
                  ) : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setDeleteTarget(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--status-error)' }}>Confirmar Eliminación</h3>
            
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              ¿Está seguro que desea eliminar a <strong>{deleteTarget.name}</strong>? Esta acción eliminará su contrato y no se puede deshacer.
            </p>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ backgroundColor: 'var(--status-error)' }}
                onClick={() => {
                  handleDeleteClient(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Eliminar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configurar en Router Modal */}
      {configTarget && (
        <div className="modal-backdrop" onClick={() => setConfigTarget(null)}>
          <div className="modal-content bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setConfigTarget(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Configurar Conexión: {configTarget.name}</h3>
            
            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ color: '#38bdf8', marginTop: '0.1rem' }}><RefreshCw size={18} /></div>
              <div>
                <h4 style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>Sincronización Automática</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
                  Este cliente está pre-asignado al MikroTik <strong>{configTarget.nodeName}</strong>. Al guardar, el sistema enviará los datos directamente a ese router y el cliente tendrá acceso a internet bajo su plan actual.
                </p>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Seleccione cómo este cliente se conectará a la red. Esta configuración se provisionará en el nodo.
            </p>

            <form onSubmit={handleConfigureRouter} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <FormAlert message={configError} />
              <div className="form-group">
                <label>Tipo de Conexión</label>
                <select 
                  value={configType} 
                  onChange={(e) => setConfigType(e.target.value as 'PPPoE' | 'StaticIP')}
                  disabled={configSubmitting}
                >
                  <option value="PPPoE">PPPoE (Recomendado)</option>
                  <option value="StaticIP">IP Estática</option>
                </select>
              </div>

              {configType === 'PPPoE' ? (
                <>
                  <div className="form-group">
                    <label>Usuario PPPoE</label>
                    <input 
                      type="text" 
                      placeholder="Ej: cliente_123" 
                      value={configUsername} 
                      onChange={e => setConfigUsername(e.target.value)} 
                      disabled={configSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label>Contraseña PPPoE</label>
                    <input 
                      type="text" 
                      placeholder="Ej: 123456" 
                      value={configPassword} 
                      onChange={e => setConfigPassword(e.target.value)} 
                      disabled={configSubmitting}
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Dirección IP Estática</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 192.168.10.50" 
                    value={configIp} 
                    onChange={e => setConfigIp(e.target.value)} 
                    disabled={configSubmitting}
                  />
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setConfigTarget(null)} disabled={configSubmitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={configSubmitting}>
                  {configSubmitting ? (
                    <><RefreshCw size={14} className="animate-spin" /> Guardando...</>
                  ) : 'Guardar y Configurar Router'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
