import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  status: string;
  serialNumber?: string;
  macAddress?: string;
  quantity: number;
  assignedTo?: string;
  notes?: string;
}

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('ROUTER');
  const [status, setStatus] = useState('IN_STOCK');
  const [serialNumber, setSerialNumber] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:4000/api/inventory', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching inventory', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setType(item.type);
      setStatus(item.status);
      setSerialNumber(item.serialNumber || '');
      setMacAddress(item.macAddress || '');
      setQuantity(item.quantity);
      setNotes(item.notes || '');
    } else {
      setEditingItem(null);
      setName('');
      setType('ROUTER');
      setStatus('IN_STOCK');
      setSerialNumber('');
      setMacAddress('');
      setQuantity(1);
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, type, status, serialNumber, macAddress, quantity, notes };
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem 
      ? `http://localhost:4000/api/inventory/${editingItem.id}` 
      : `http://localhost:4000/api/inventory`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        (window as any).showToast('Inventario actualizado', 'success');
        fetchItems();
        closeModal();
      } else {
        (window as any).showToast('Error al guardar', 'warning');
      }
    } catch (error) {
      console.error(error);
      (window as any).showToast('Error de conexión', 'warning');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este ítem?')) return;
    try {
      const res = await fetch(`http://localhost:4000/api/inventory/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        (window as any).showToast('Ítem eliminado', 'success');
        fetchItems();
      } else {
        (window as any).showToast('Error al eliminar', 'warning');
      }
    } catch (error) {
      console.error(error);
      (window as any).showToast('Error de conexión', 'warning');
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.serialNumber && i.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="page-container fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={28} color="var(--accent)" />
            Inventario
          </h1>
          <p className="page-subtitle">Gestión de equipos y materiales</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Plus size={18} /> Nuevo Ítem
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-body" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px', margin: 0, position: 'relative' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre o serie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando inventario...</div>
      ) : (
        <div className="mobile-card-list">
          {filteredItems.map(item => (
            <div key={item.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{item.name}</h3>
                <span className={`badge ${item.status === 'IN_STOCK' ? 'badge-success' : 'badge-warning'}`}>
                  {item.status}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <strong>Tipo:</strong> {item.type} <br/>
                <strong>Cantidad:</strong> {item.quantity} <br/>
                {item.serialNumber && <><strong>S/N:</strong> {item.serialNumber}<br/></>}
                {item.macAddress && <><strong>MAC:</strong> {item.macAddress}</>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openModal(item)}>
                  <Edit2 size={14} />
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron ítems.</div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content fade-in" style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{editingItem ? 'Editar Ítem' : 'Nuevo Ítem'}</h2>
              <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre del Equipo/Material</label>
                <input required type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                    <option value="ROUTER">Router</option>
                    <option value="ANTENNA">Antena</option>
                    <option value="CABLE">Cable</option>
                    <option value="CONNECTOR">Conector</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Estado</label>
                  <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="IN_STOCK">En Stock</option>
                    <option value="DEPLOYED">Instalado</option>
                    <option value="DEFECTIVE">Defectuoso</option>
                    <option value="LOST">Perdido</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>S/N (Opcional)</label>
                  <input type="text" className="form-control" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>MAC (Opcional)</label>
                  <input type="text" className="form-control" value={macAddress} onChange={e => setMacAddress(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" min="1" className="form-control" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} rows={3}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
