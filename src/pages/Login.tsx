import React, { useState } from 'react';
import { Radio } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: { id: string; email: string; fullName: string; role: string }) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fallo de autenticación');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor');
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
      backgroundColor: 'var(--bg-primary)',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        zIndex: 1,
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        {/* Brand */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            border: '1px solid var(--border-color)',
            padding: '0.75rem',
            backgroundColor: 'var(--bg-tertiary)'
          }}>
            <Radio size={36} color="var(--accent)" />
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            JNSIX <span style={{ color: 'var(--accent)' }}>ISP</span>
          </h1>
          <span style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '-0.25rem'
          }}>
            Sistema de Gestión y Corte Automático
          </span>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--color-danger)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.88rem',
            marginBottom: '1.25rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="ejemplo@jnsix.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
          </button>
        </form>

        {/* First time help notice */}
       {/*  <div style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--border-color)'
        }}>
          Nota: <strong>Primer acceso:</strong> Si es la primera vez que inicias, ingresa con: <br />
          <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>admin@jnsix.com</span> / <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>admin123</span>
        </div> */}
      </div>
    </div>
  );
};

export default Login;
