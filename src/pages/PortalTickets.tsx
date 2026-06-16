import React, { useEffect, useState } from 'react';
import { Plus, Ticket, AlertCircle } from 'lucide-react';
import { showToast } from '../utils/toast';

interface PortalTicketsProps {
  token: string | null;
}

interface TicketData {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
}

const PortalTickets: React.FC<PortalTicketsProps> = ({ token }) => {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New ticket state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/portal/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        setTickets(json);
      }
    } catch (err) {
      showToast('Error cargando tickets', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [token]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, description, priority })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear el ticket');
      }

      showToast('Ticket creado exitosamente', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setPriority('NORMAL');
      fetchTickets();
    } catch (err: any) {
      showToast(err.message, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'OPEN': return <span className="badge badge-warning">Abierto</span>;
      case 'IN_PROGRESS': return <span className="badge" style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info-border)' }}>En Progreso</span>;
      case 'RESOLVED': return <span className="badge badge-success">Resuelto</span>;
      case 'CLOSED': return <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Cerrado</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'LOW': return 'var(--text-muted)';
      case 'NORMAL': return 'var(--color-info)';
      case 'HIGH': return 'var(--color-warning)';
      case 'URGENT': return 'var(--color-danger)';
      default: return 'var(--text-muted)';
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}><div className="ring-spinner" /></div>;
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Ticket size={20} color="var(--accent)" /> Mis Tickets de Soporte
        </h3>
        <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Nuevo Ticket
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tickets.length === 0 ? (
          <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <AlertCircle size={48} style={{ opacity: 0.5 }} />
            <p>No tienes tickets de soporte registrados.</p>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(true)}>Crear mi primer ticket</button>
          </div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: `3px solid ${getPriorityColor(ticket.priority)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, marginBottom: '0.25rem' }}>{ticket.title}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Creado el {new Date(ticket.createdAt).toLocaleString()}
                  </span>
                </div>
                <div>{getStatusBadge(ticket.status)}</div>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.5, backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '4px' }}>
                {ticket.description}
              </p>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Crear Nuevo Ticket</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Título del Problema</label>
                <input 
                  className="form-control" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  required 
                  placeholder="Ej: Sin conexión a internet"
                />
              </div>
              <div className="form-group">
                <label>Prioridad</label>
                <select className="form-control" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="LOW">Baja</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
              <div className="form-group">
                <label>Descripción detallada</label>
                <textarea 
                  className="form-control" 
                  rows={4} 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  required 
                  placeholder="Describe tu problema con el mayor detalle posible..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Crear Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default PortalTickets;
