import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Key, Server } from 'lucide-react';
import { showToast } from '../utils/toast';

const PortalLogin: React.FC = () => {
  const [dni, setDni] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, clientCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      localStorage.setItem('portal_token', data.token);
      showToast('Inicio de sesión exitoso', 'success');
      navigate('/portal/dashboard');
    } catch (error: any) {
      showToast(error.message, 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '50%', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <Server size={32} color="var(--accent)" />
        </div>
        
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Portal de Autogestión</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Ingrese sus datos para consultar sus facturas y servicios.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <User size={14} color="var(--accent)" /> DNI Titular
            </label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ej: 30123456" 
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              required
              disabled={loading}
              style={{ fontSize: '1rem', padding: '0.75rem' }}
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Key size={14} color="var(--accent)" /> Código de Cliente
            </label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="Ingrese su código de acceso" 
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
              required
              disabled={loading}
              style={{ fontSize: '1rem', padding: '0.75rem' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ padding: '0.75rem', fontSize: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <>Cargando...</>
            ) : (
              <>
                <LogIn size={18} />
                Ingresar al Portal
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PortalLogin;
