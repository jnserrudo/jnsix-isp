import React, { useState, useEffect } from 'react';
import FormAlert from '../components/FormAlert';
import { Plus, Search, Ticket as TicketIcon } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  client?: { fullName: string; phone1: string };
  assignee?: { fullName: string };
}

interface TicketsProps {
  token: string | null;
  userRole: string;
}

const Tickets: React.FC<TicketsProps> = ({ token }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
      
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'OPEN',
    clientId: ''
  });

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tickets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al obtener tickets');
      const data = await res.json();
      setTickets(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTickets();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validación bloqueante antes del submit
    const missing: string[] = [];
    if (!formData.title || !formData.title.trim()) missing.push('Título');
    if (!formData.description || !formData.description.trim()) missing.push('Descripción');
    if (missing.length > 0) {
      setFormError(`Los siguientes campos son requeridos: ${missing.join(', ')}.`);
      return;
    }

    try {
      const url = editingTicket 
        ? `/api/tickets/${editingTicket.id}`
        : `/api/tickets`;
      
      const method = editingTicket ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar el ticket');
      }
      
      setFormError('');
      setIsModalOpen(false);
      setEditingTicket(null);
      setFormData({ title: '', description: '', priority: 'MEDIUM', status: 'OPEN', clientId: '' });
      fetchTickets();
      (window as any).showToast('Ticket guardado correctamente', 'success');
    } catch (err: any) {
      setFormError(err.message);
      (window as any).showToast(err.message, 'warning');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'var(--color-danger)';
      case 'HIGH': return 'var(--color-warning)';
      case 'MEDIUM': return 'var(--color-info)';
      default: return 'var(--text-muted)';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'OPEN': return 'badge badge-warning';
      case 'IN_PROGRESS': return 'badge badge-info';
      case 'RESOLVED': return 'badge badge-success';
      case 'CLOSED': return 'badge badge-secondary';
      default: return 'badge badge-secondary';
    }
  };

  const openEditModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setFormData({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      clientId: ticket.client ? (ticket as any).clientId || '' : ''
    });
    setIsModalOpen(true);
  };

  const filteredTickets = tickets.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.client?.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Soporte Técnico</h1>
          <p className="page-subtitle">Gestión de tickets y averías</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '250px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              className="form-control"
              placeholder="Buscar tickets..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%', margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => {
            setEditingTicket(null);
            setFormData({ title: '', description: '', priority: 'MEDIUM', status: 'OPEN', clientId: '' });
            setIsModalOpen(true);
          }}>
            <Plus size={18} />
            <span className="desktop-only-text">Nuevo Ticket</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando tickets...</div>
      ) : (
        <div className="card">
          <div className="mobile-card-list">
            {filteredTickets.map(ticket => (
              <div key={ticket.id} className="mobile-card" onClick={() => openEditModal(ticket)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TicketIcon size={16} color={getPriorityColor(ticket.priority)} />
                    {ticket.title}
                  </h3>
                  <span className={getStatusBadgeClass(ticket.status)}>{ticket.status}</span>
                </div>
                
                <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {ticket.description.length > 100 ? `${ticket.description.substring(0, 100)}...` : ticket.description}
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{ticket.client ? ticket.client.fullName : 'Sin Cliente'}</span>
                  <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            
            {filteredTickets.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No se encontraron tickets.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>{editingTicket ? 'Editar Ticket' : 'Nuevo Ticket'}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="form-grid">
              <div style={{ gridColumn: '1 / -1' }}>
                <FormAlert message={formError} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Título *</label>
                <input 
                  type="text" 
                  className={!formData.title.trim() && formError ? 'form-control input-error' : 'form-control'}
                  value={formData.title}
                  onChange={e => { setFormData({...formData, title: e.target.value}); if (formError) setFormError(''); }}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Descripción *</label>
                <textarea 
                  className={!formData.description.trim() && formError ? 'form-control input-error' : 'form-control'}
                  rows={4}
                  value={formData.description}
                  onChange={e => { setFormData({...formData, description: e.target.value}); if (formError) setFormError(''); }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prioridad</label>
                <select 
                  className="form-control"
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value})}
                >
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Estado</label>
                <select 
                  className="form-control"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                >
                  <option value="OPEN">Abierto</option>
                  <option value="IN_PROGRESS">En Progreso</option>
                  <option value="RESOLVED">Resuelto</option>
                  <option value="CLOSED">Cerrado</option>
                </select>
              </div>

              <div className="modal-actions" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;
