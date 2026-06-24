import React, { useState, useEffect, useRef } from 'react';
import { User, Menu, Bell, Check, Info, AlertTriangle, AlertCircle, Loader } from 'lucide-react';
import { fetchWithRetry } from '../utils/apiFetch';
import { useBilling } from '../contexts/BillingContext';

interface HeaderProps {
  userName: string;
  onToggleSidebar: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR';
  isRead: boolean;
  createdAt: string;
}

const Header: React.FC<HeaderProps> = ({ userName, onToggleSidebar }) => {
  const { isBillingRunning, billingProgress } = useBilling();
  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetchWithRetry('http://localhost:4000/api/notifications?limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // 1 min poll
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetchWithRetry(`http://localhost:4000/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetchWithRetry('http://localhost:4000/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'WARNING': return <AlertTriangle size={16} color="var(--warning-color, #f59e0b)" />;
      case 'ERROR': return <AlertCircle size={16} color="var(--danger-color, #ef4444)" />;
      default: return <Info size={16} color="var(--primary-color, #3b82f6)" />;
    }
  };

  return (
    <header className="app-header">
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

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        {isBillingRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-warning-bg, #fffbeb)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm, 0.375rem)', border: '1px solid var(--warning-color, #f59e0b)', color: 'var(--warning-color, #f59e0b)', fontSize: '0.85rem', fontWeight: 600 }}>
            <Loader size={14} className="animate-spin" />
            <span>Facturando: {billingProgress?.percentage || 0}%</span>
          </div>
        )}

        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button 
            className="btn btn-secondary"
            style={{ 
              padding: '0.4rem', 
              borderRadius: '50%', 
              position: 'relative',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Bell size={20} color="var(--text-muted)" />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 0,
                right: 0,
                backgroundColor: 'var(--danger-color, #ef4444)',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'translate(25%, -25%)'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              width: '320px',
              backgroundColor: 'var(--bg-secondary, #1e1e2d)',
              border: '1px solid var(--border-color, #2b2b40)',
              borderRadius: '0.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 50,
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border-color, #2b2b40)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Notificaciones</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-color, #3b82f6)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Marcar todas leídas
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>No hay notificaciones</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id}
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color, #2b2b40)',
                        backgroundColor: notif.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{ marginTop: '0.1rem' }}>
                        {getIconForType(notif.type)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ 
                          margin: '0 0 0.25rem 0', 
                          fontSize: '0.85rem', 
                          fontWeight: notif.isRead ? 500 : 600,
                          color: notif.isRead ? 'var(--text-muted)' : '#ffffff'
                        }}>
                          {notif.title}
                        </h4>
                        <p style={{ 
                          margin: '0 0 0.25rem 0', 
                          fontSize: '0.8rem', 
                          color: 'var(--text-muted)',
                          lineHeight: 1.4
                        }}>
                          {notif.message}
                        </p>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                          {new Date(notif.createdAt).toLocaleString('es-ES')}
                        </span>
                      </div>
                      {!notif.isRead && (
                        <button 
                          onClick={() => markAsRead(notif.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-color, #3b82f6)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Marcar como leída"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
            <div style={{ 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 'clamp(100px, 15vw, 200px)'
            }}>
              {userName}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
