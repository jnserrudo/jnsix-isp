import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Network, 
  LogOut,
  Radio,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
  userRole: string;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, userRole, isOpen, onClose, isCollapsed, onToggleCollapse }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Panel Control', icon: LayoutDashboard, roles: ['ADMIN', 'OPERATOR', 'READONLY'] },
    { path: '/clients', label: 'Clientes', icon: Users, roles: ['ADMIN', 'OPERATOR', 'READONLY'] },
    { path: '/billing', label: 'Facturación y Pagos', icon: CreditCard, roles: ['ADMIN', 'OPERATOR', 'READONLY'] },
    { path: '/nodes', label: 'Nodos / MikroTik', icon: Network, roles: ['ADMIN', 'OPERATOR', 'READONLY'] },
  ];

  const allowedItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile background overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}

      <div className={`app-sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Brand logo header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Radio size={20} color="var(--accent)" />
          </div>
          <div className="sidebar-brand-info">
            <h1 className="sidebar-brand-text">
              JNSIX <span style={{ color: 'var(--accent)' }}>ISP</span>
            </h1>
            <span className="sidebar-brand-sub" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
              Gestor de Red
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="sidebar-nav">
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                <span className="sidebar-link-text">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User block & Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-role" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Rol de Acceso</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>{userRole}</span>
          </div>
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%'
            }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            <span className="logout-btn-text">Cerrar Sesión</span>
          </button>
          
        </div>

        {/* Floating Sidebar Toggle Button (Desktop Only) */}
        <button
          onClick={onToggleCollapse}
          className="sidebar-toggle-btn desktop-only-btn"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </>
  );
};

export default Sidebar;
