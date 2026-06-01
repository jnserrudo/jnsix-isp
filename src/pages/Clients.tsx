import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, X, RefreshCw, MoreVertical } from 'lucide-react';
import { showToast } from '../utils/toast';
import MapPicker from '../components/MapPicker';

interface Client {
  id: string;
  fullName: string;
  dni: string;
  phone1: string | null;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELINQUENT' | 'CANCELLED';
  address: string;
  createdAt: string;
}

interface ClientsProps {
  token: string;
  userRole: string;
}

const Clients: React.FC<ClientsProps> = ({ token, userRole }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

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
      const response = await fetch('/api/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar la lista de clientes');
      const data = await response.json();
      setClients(data);
    } catch (err: any) {
      console.error(err);
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
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName,
          dni,
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
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    showToast('Eliminando cliente...', 'info');
    try {
      const response = await fetch(`/api/clients/${id}`, {
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
      showToast(err.message || 'Error al eliminar cliente', 'error');
    }
  };

  // Filters logic
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) || 
                          c.dni.includes(search) || 
                          (c.phone1 && c.phone1.includes(search));
    const matchesStatus = statusFilter === '' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredClients.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="page-container">
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
        <div style={{ width: '200px' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="SUSPENDED">Suspendido</option>
            <option value="DELINQUENT">Moroso</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Main List Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent)' }}>Cargando clientes...</div>
      ) : filteredClients.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No se encontraron clientes registrados con los filtros aplicados.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>DNI / Identificación</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Dirección</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.map((client) => (
                <tr key={client.id}>
                  <td style={{ fontWeight: 600 }}>{client.fullName}</td>
                  <td>{client.dni}</td>
                  <td>{client.phone1 || client.email || 'Sin contacto'}</td>
                  <td>
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
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.address}
                  </td>
                  <td style={{ textAlign: 'right', position: 'relative' }}>
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
                          {userRole === 'ADMIN' && (
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

          {/* Pagination bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '1rem 1.5rem', 
            borderTop: '1px solid var(--border-color)', 
            backgroundColor: 'var(--bg-secondary)',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Filas por página:</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ 
                  padding: '0.2rem 0.5rem', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  width: 'auto'
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Mostrando {totalItems === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalItems)} de {totalItems}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '0.3rem 0.6rem' }}
                >
                  Anterior
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  style={{ padding: '0.3rem 0.6rem' }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
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
            
            {formError && (
              <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input type="text" placeholder="Ej: Nahuel Dev" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                
                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>DNI *</label>
                    <input type="text" placeholder="DNI sin puntos" value={dni} onChange={e => setDni(e.target.value)} required />
                  </div>
                  <div className="form-group">
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
                  <textarea rows={2} placeholder="Ej: Calle Falsa 123. Casa portón verde frente al kiosco." value={address} onChange={e => setAddress(e.target.value)} required />
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
      {/* Custom Confirmation Modal for Client Deletion */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setDeleteTarget(null)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Eliminar Abonado</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              ¿Está seguro de eliminar al cliente <strong>{deleteTarget.name}</strong>? Se borrarán también todos sus contratos asociados e historial de facturación de forma permanente.
            </p>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  const targetId = deleteTarget.id;
                  setDeleteTarget(null);
                  handleDeleteClient(targetId);
                }}
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
