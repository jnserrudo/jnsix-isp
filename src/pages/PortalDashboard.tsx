import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, FileText, Wifi, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { showToast } from '../utils/toast';

interface ClientPortalData {
  id: string;
  fullName: string;
  status: string;
  contracts: Array<any>;
  invoices: Array<any>;
}

const PortalDashboard: React.FC = () => {
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInfo = async () => {
      const token = localStorage.getItem('portal_token');
      if (!token) {
        navigate('/portal');
        return;
      }

      try {
        const response = await fetch('/api/portal/my-info', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
          localStorage.removeItem('portal_token');
          navigate('/portal');
          return;
        }

        const json = await response.json();
        setData(json);
      } catch (err: any) {
        showToast('Error de conexión', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    navigate('/portal');
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ACTIVE': return <span className="badge badge-success">Activo</span>;
      case 'SUSPENDED': return <span className="badge badge-danger">Suspendido</span>;
      case 'DELINQUENT': return <span className="badge badge-warning">Moroso</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getInvoiceStatus = (status: string) => {
    switch(status) {
      case 'PAID': return <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={14}/> Pagado</span>;
      case 'PENDING': return <span style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={14}/> Pendiente</span>;
      case 'OVERDUE': return <span style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={14}/> Vencido</span>;
      default: return <span>{status}</span>;
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="ring-spinner" /></div>;
  }

  if (!data) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'var(--bg-secondary)', 
        borderBottom: '1px solid var(--border-color)',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>
            {data.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{data.fullName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              Estado General: {getStatusBadge(data.status)}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogOut size={16} /> Salir
        </button>
      </header>

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Mis Servicios */}
        <section>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <Wifi size={20} color="var(--accent)" /> Mis Servicios
          </h3>
          <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
            {data.contracts.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No tienes servicios contratados.</div>
            ) : (
              data.contracts.map(contract => (
                <div key={contract.id} className="card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent)' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{contract.plan?.name || 'Plan de Internet'}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Nodo: {contract.node?.name} • IP: {contract.staticIp || 'Dinámica'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>Día de Vencimiento: <strong>{contract.billingDay} de cada mes</strong></span>
                    <span>Velocidad: <strong>{contract.plan?.downloadSpeed} Mbps</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Mis Facturas */}
        <section>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <FileText size={20} color="var(--accent)" /> Últimas Facturas
          </h3>
          
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nº Factura</th>
                    <th>Período</th>
                    <th>Vencimiento</th>
                    <th>Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No hay facturas registradas.</td></tr>
                  ) : (
                    data.invoices.map(inv => (
                      <tr key={inv.id}>
                        <td><strong style={{ color: 'var(--accent)' }}>{inv.invoiceNumber}</strong></td>
                        <td>{new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}</td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={14} />
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>${Number(inv.amount).toLocaleString('es-AR')}</td>
                        <td>{getInvoiceStatus(inv.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default PortalDashboard;
