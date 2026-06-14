import React, { useEffect, useState } from 'react';
import { Network, RefreshCw, AlertTriangle, Monitor, Server } from 'lucide-react';
import { showToast } from '../../utils/toast';
import SkeletonTable from '../SkeletonTable';
import TablePagination from './TablePagination';

interface Props {
  nodeId: string;
  token: string;
}

const MikrotikActiveSessions: React.FC<Props> = ({ nodeId, token }) => {
  const [leases, setLeases] = useState<any[]>([]);
  const [arp, setArp] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination for Leases
  const [leasesPage, setLeasesPage] = useState(1);
  const [leasesPerPage, setLeasesPerPage] = useState(5);

  // Pagination for ARP
  const [arpPage, setArpPage] = useState(1);
  const [arpPerPage, setArpPerPage] = useState(5);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/nodes/${nodeId}/mikrotik/ip-dhcp`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al conectar con el router para obtener sesiones.');
      }
      
      const { data } = await response.json();
      setLeases(data.leases || []);
      setArp(data.arp || []);
      
    } catch (err: any) {
      setError(err.message || 'Error de red');
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nodeId) fetchData();
  }, [nodeId]);

  // Derived states for pagination
  const totalLeases = leases.length;
  const leasesStartIndex = (leasesPage - 1) * leasesPerPage;
  const paginatedLeases = leases.slice(leasesStartIndex, leasesStartIndex + leasesPerPage);

  const totalArp = arp.length;
  const arpStartIndex = (arpPage - 1) * arpPerPage;
  const paginatedArp = arp.slice(arpStartIndex, arpStartIndex + arpPerPage);

  useEffect(() => {
    const max = Math.ceil(totalLeases / leasesPerPage);
    if (leasesPage > max && max > 0) setLeasesPage(max);
  }, [totalLeases, leasesPerPage, leasesPage]);

  useEffect(() => {
    const max = Math.ceil(totalArp / arpPerPage);
    if (arpPage > max && max > 0) setArpPage(max);
  }, [totalArp, arpPerPage, arpPage]);

  if (loading) {
    return (
      <div style={{ marginTop: '1rem' }}>
        <SkeletonTable rows={5} columns={['25%', '25%', '25%', '25%']} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--status-error)', border: '1px solid var(--status-error)' }}>
        <AlertTriangle size={32} style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Fallo en lectura de sesiones</h3>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={fetchData} style={{ marginTop: '1rem' }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderLeft: '3px solid var(--color-success)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)', marginBottom: '0.25rem' }}>Equipos Conectados (DHCP / ARP)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Visualice todos los equipos, celulares, computadoras y routers que están conectados físicamente o por Wi-Fi al MikroTik. Útil para identificar dispositivos no autorizados o confirmar que la red local funciona.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ marginRight: '0.4rem' }} />
          Actualizar Listas
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '2rem' }}>
        {/* Tabla DHCP */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <Server color="var(--accent)" />
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Alquileres DHCP (DHCP Leases)</h3>
          </div>
          
          {leases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No hay dispositivos con IP automática.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="mobile-card-list" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Host / Dispositivo</th>
                    <th>IP Asignada</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeases.map((l: any, i) => (
                    <tr key={`lease-${i}`}>
                      <td data-label="Host / Dispositivo">
                        <div style={{ fontWeight: 600 }}>{l['host-name'] || 'Desconocido'}</div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{l['mac-address']}</div>
                      </td>
                      <td data-label="IP Asignada" style={{ fontFamily: 'monospace', color: '#fff' }}>{l.address}</td>
                      <td data-label="Estado">
                        <span className={l.status === 'bound' ? 'badge badge-active' : 'badge badge-suspended'} style={{ fontSize: '0.7rem' }}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalLeases > 0 && (
                <TablePagination
                  currentPage={leasesPage}
                  totalItems={totalLeases}
                  itemsPerPage={leasesPerPage}
                  onPageChange={setLeasesPage}
                  onItemsPerPageChange={setLeasesPerPage}
                />
              )}
            </div>
          )}
        </div>

        {/* Tabla ARP */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <Monitor color="var(--color-success)" />
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Tabla ARP (Direcciones Físicas)</h3>
          </div>

          {arp.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              La tabla ARP está vacía.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="mobile-card-list" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>MAC Address</th>
                    <th>Interfaz</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedArp.map((a: any, i) => (
                    <tr key={`arp-${i}`}>
                      <td data-label="IP" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#fff' }}>{a.address}</td>
                      <td data-label="MAC Address" style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{a['mac-address'] || 'Incompleto'}</td>
                      <td data-label="Interfaz">{a.interface}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalArp > 0 && (
                <TablePagination
                  currentPage={arpPage}
                  totalItems={totalArp}
                  itemsPerPage={arpPerPage}
                  onPageChange={setArpPage}
                  onItemsPerPageChange={setArpPerPage}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MikrotikActiveSessions;
