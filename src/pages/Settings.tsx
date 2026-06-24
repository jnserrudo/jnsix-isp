import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Info } from 'lucide-react';

export default function Settings() {
  const [dailyLateFee, setDailyLateFee] = useState<number>(3000);
  const [reconnectionFee, setReconnectionFee] = useState<number>(4000);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDailyLateFee(data.dailyLateFee || 3000);
        setReconnectionFee(data.reconnectionFee || 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dailyLateFee, reconnectionFee })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar configuración');
      
      setMessage({ type: 'success', text: 'Configuraciones actualizadas con éxito.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-state"><RefreshCw className="animate-spin" /> Cargando configuración...</div>;
  }

  return (
    <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SettingsIcon size={24} color="var(--accent)" /> Configuraciones Generales
          </h1>
          <p className="page-description">Ajuste los valores globales del sistema.</p>
        </div>
      </div>

      {message && (
        <div className={`form-alert ${message.type}`} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Info size={18} />
          <span>{message.text}</span>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="form-group">
            <label>Mora Diaria (ARS)</label>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Monto que se sumará automáticamente a las facturas vencidas por cada día de atraso.
            </p>
            <input 
              type="number" 
              className="form-control"
              min="0"
              value={dailyLateFee} 
              onChange={e => setDailyLateFee(Number(e.target.value))} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Costo de Reconexión (ARS)</label>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Monto que se cargará a la próxima factura al reanudar un servicio suspendido.
            </p>
            <input 
              type="number" 
              className="form-control"
              min="0"
              value={reconnectionFee} 
              onChange={e => setReconnectionFee(Number(e.target.value))} 
              required 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><RefreshCw size={18} className="animate-spin" /> Guardando...</> : <><Save size={18} /> Guardar Cambios</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
