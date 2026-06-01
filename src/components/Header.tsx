import React from 'react';
import { User, Menu } from 'lucide-react';

interface HeaderProps {
  userName: string;
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ userName, onToggleSidebar }) => {
  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="app-header">
      {/* Menu button & Date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={onToggleSidebar}
          className="btn btn-secondary btn-sm mobile-menu-btn"
          style={{
            padding: '0.4rem',
            display: 'none'
          }}
        >
          <Menu size={18} />
        </button>
        <span className="header-date" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 500 }}>
          {currentDate}
        </span>
      </div>

      {/* User Info Block */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem'
      }}>
        {/* User profile */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            padding: '0.4rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-color)'
          }}>
            <User size={14} color="var(--text-muted)" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
              {userName}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
