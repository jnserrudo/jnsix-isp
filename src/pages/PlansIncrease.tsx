import React, { useState, useEffect } from 'react';
import { ArrowUpRight, DollarSign, Percent, Save, RefreshCw, Info, AlertTriangle } from 'lucide-react';

export default function PlansIncrease() {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [increaseType, setIncreaseType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [increaseAmount, setIncreaseAmount] = useState<string>('');
  const [notifyUsers, setNotifyUsers] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/plans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPlans(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedPlans(plans.map(p => p.id));
    } else {
      setSelectedPlans([]);
    }
  };

  const handleSelectPlan = (id: string) => {
    if (selectedPlans.includes(id)) {
      setSelectedPlans(selectedPlans.filter(p => p !== id));
    } else {
      setSelectedPlans([...selectedPlans, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlans.length === 0) {
      setMessage({ type: 'error', text: 'Debe seleccionar al menos un plan para aumentar.' });
      return;
    }
    if (!increaseAmount || Number(increaseAmount) <= 0) {
      setMessage({ type: 'error', text: 'Debe ingresar un monto válido de aumento.' });
      return;
    }

    if (!window.confirm(`¿Está seguro de aplicar un aumento de ${increaseType === 'PERCENTAGE' ? increaseAmount + '%' : '$' + increaseAmount} a ${selectedPlans.length} planes?`)) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/plans/bulk-increase', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planIds: selectedPlans,
          type: increaseType,
          amount: Number(increaseAmount),
          notify: notifyUsers
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar el aumento masivo');
      
      setMessage({ type: 'success', text: 'Aumento aplicado exitosamente a los planes seleccionados.' });
      setIncreaseAmount('');
      setSelectedPlans([]);
      fetchPlans(); // Refresh the prices
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ArrowUpRight size={24} color="var(--accent)" /> 
            <span>Aumento Masivo de Planes</span>
          </h1>
          <p className="page-description" style={{ fontSize: '0.85rem' }}>Aplique un aumento fijo o porcentual a los planes seleccionados.</p>
        </div>
      </div>

      {message && (
        <div className={`form-alert ${message.type}`} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '4px' }}>
          {message.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        
        {/* PASO 1: CONFIGURAR AUMENTO */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <span style={{ color: 'var(--accent)' }}>1.</span> Configurar Aumento
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {/* Tipo de Aumento */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>TIPO DE AUMENTO</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    cursor: 'pointer', 
                    padding: '0.5rem', 
                    backgroundColor: increaseType === 'PERCENTAGE' ? 'rgba(185, 28, 28, 0.05)' : 'var(--bg-tertiary)', 
                    border: increaseType === 'PERCENTAGE' ? '1px solid var(--accent)' : '1px solid var(--border-color)', 
                    borderRadius: '4px', 
                    transition: 'all 0.15s' 
                  }}>
                    <input type="radio" name="increaseType" checked={increaseType === 'PERCENTAGE'} onChange={() => setIncreaseType('PERCENTAGE')} />
                    <Percent size={14} color={increaseType === 'PERCENTAGE' ? "var(--accent)" : "var(--text-muted)"} /> 
                    <span style={{ fontSize: '0.85rem', fontWeight: increaseType === 'PERCENTAGE' ? 600 : 500, color: increaseType === 'PERCENTAGE' ? '#fff' : 'var(--text-muted)' }}>PORCENTAJE</span>
                  </label>
                  
                  <label style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    cursor: 'pointer', 
                    padding: '0.5rem', 
                    backgroundColor: increaseType === 'FIXED' ? 'rgba(185, 28, 28, 0.05)' : 'var(--bg-tertiary)', 
                    border: increaseType === 'FIXED' ? '1px solid var(--accent)' : '1px solid var(--border-color)', 
                    borderRadius: '4px', 
                    transition: 'all 0.15s' 
                  }}>
                    <input type="radio" name="increaseType" checked={increaseType === 'FIXED'} onChange={() => setIncreaseType('FIXED')} />
                    <DollarSign size={14} color={increaseType === 'FIXED' ? "var(--accent)" : "var(--text-muted)"} /> 
                    <span style={{ fontSize: '0.85rem', fontWeight: increaseType === 'FIXED' ? 600 : 500, color: increaseType === 'FIXED' ? '#fff' : 'var(--text-muted)' }}>FIJO</span>
                  </label>
                </div>
              </div>

              {/* Monto de Aumento */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>
                  {increaseType === 'PERCENTAGE' ? 'PORCENTAJE DE AUMENTO (%)' : 'MONTO FIJO DE AUMENTO ($ ARS)'} *
                </label>
                <input 
                  type="number" 
                  className="form-control"
                  min="0.01" 
                  step="any"
                  value={increaseAmount} 
                  onChange={e => setIncreaseAmount(e.target.value)} 
                  placeholder={increaseType === 'PERCENTAGE' ? 'Ej: 15' : 'Ej: 2000'}
                  required 
                  style={{ fontSize: '0.9rem', padding: '0.5rem 0.75rem', height: '36px' }}
                />
              </div>
            </div>

            {/* Notificar Clientes */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              backgroundColor: 'rgba(180, 83, 9, 0.1)', 
              padding: '0.75rem 1rem', 
              borderRadius: '4px', 
              border: '1px solid rgba(180, 83, 9, 0.3)',
              cursor: 'pointer'
            }}>
              <input 
                type="checkbox" 
                checked={notifyUsers} 
                onChange={e => setNotifyUsers(e.target.checked)} 
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Notificar afectados</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Se enviará mensaje de WhatsApp con el nuevo valor en la facturación).</span>
              </div>
            </label>

          </div>
        </div>

        {/* PASO 2: SELECCIONAR PLANES */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <span style={{ color: 'var(--accent)' }}>2.</span> Seleccionar Planes ({selectedPlans.length}/{plans.length})
            </h2>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              <input 
                type="checkbox" 
                checked={plans.length > 0 && selectedPlans.length === plans.length} 
                onChange={handleSelectAll} 
              />
              Seleccionar Todos
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
            {loading ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', opacity: 0.5, display: 'block' }} />
                Cargando planes...
              </div>
            ) : plans.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No hay planes registrados.
              </div>
            ) : (
              plans.map((plan) => {
                const isSelected = selectedPlans.includes(plan.id);
                let simulatedNewPrice = Number(plan.price);
                if (increaseAmount && !isNaN(Number(increaseAmount))) {
                  if (increaseType === 'PERCENTAGE') {
                    simulatedNewPrice += simulatedNewPrice * (Number(increaseAmount) / 100);
                  } else {
                    simulatedNewPrice += Number(increaseAmount);
                  }
                }
                
                return (
                  <label key={plan.id} style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    padding: '0.65rem 0.85rem', 
                    backgroundColor: isSelected ? 'rgba(185, 28, 28, 0.05)' : 'var(--bg-tertiary)', 
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-color)', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => handleSelectPlan(plan.id)} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? '#fff' : 'var(--text-main)' }}>{plan.name}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></span>
                        {plan._count?.contracts || 0} act.
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: '1.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: isSelected && increaseAmount ? 'line-through' : 'none' }}>
                        ${Number(plan.price).toLocaleString()}
                      </span>
                      {isSelected && increaseAmount && (
                        <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '0.95rem' }}>
                          ${simulatedNewPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ACCIONES */}
        <div style={{ position: 'sticky', bottom: '1rem', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.75rem 1.25rem', borderRadius: '4px', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: '2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>{selectedPlans.length}</span> seleccionados
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || selectedPlans.length === 0} style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}>
              {submitting ? <><RefreshCw size={16} className="animate-spin" /> PROCESANDO...</> : <><Save size={16} /> APLICAR AUMENTO</>}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
