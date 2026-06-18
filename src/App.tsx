import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Billing from './pages/Billing';
import Nodes from './pages/Nodes';
import MikrotikTest from './pages/MikrotikTest';
import MikrotikManagementCenter from './pages/MikrotikManagementCenter';
import MigrationWizard from './pages/MigrationWizard';
import Plans from './pages/Plans';
import Audit from './pages/Audit';
import Inventory from './pages/Inventory';
import Tickets from './pages/Tickets';
import PortalDashboard from './pages/PortalDashboard';


// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';

interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isClient?: boolean;
}

const GlobalToast = () => {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'warning' | 'info' }>>([]);

  useEffect(() => {
    (window as any).showToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
      const id = Math.random().toString();
      setToasts([{ id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };
    return () => {
      delete (window as any).showToast;
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{
            width: '6px',
            height: '6px',
            backgroundColor: t.type === 'success' ? 'var(--color-success)' : t.type === 'warning' ? 'var(--accent)' : 'var(--color-info)',
            display: 'inline-block'
          }} />
          {t.message}
        </div>
      ))}
    </div>
  );
};

interface MainLayoutProps {
  token: string | null;
  user: UserSession | null;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isSidebarCollapsed: boolean;
  handleToggleSidebarCollapse: () => void;
  handleLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  token, user, isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, handleToggleSidebarCollapse, handleLogout
}) => {
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.isClient) return <Navigate to="/portal" replace />;
  
  return (
    <div className="app-container">
      <Sidebar 
        onLogout={handleLogout} 
        userRole={user.role} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />
      <div className="main-content">
        <Header 
          userName={user.fullName} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        />
        <Routes>
          <Route path="/" element={<Dashboard token={token} userRole={user.role} />} />
          <Route path="/clients" element={<Clients token={token} userRole={user.role} />} />
          <Route path="/clients/:id" element={<ClientDetail token={token} userRole={user.role} />} />
          <Route path="/billing" element={<Billing token={token} userRole={user.role} />} />
          <Route path="/nodes" element={<Nodes token={token} userRole={user.role} />} />
          <Route path="/mikrotik-test" element={<MikrotikTest />} />
          <Route path="/mikrotik-management" element={
            user.role === 'ADMIN' || user.role === 'OPERATOR' ? <MikrotikManagementCenter /> : <Navigate to="/" replace />
          } />
          <Route path="/migration-wizard" element={
            user.role === 'ADMIN' ? <MigrationWizard /> : <Navigate to="/" replace />
          } />
          <Route path="/plans" element={<Plans token={token} userRole={user.role} />} />
          <Route path="/audit" element={
            user.role === 'ADMIN' ? <Audit token={token} userRole={user.role} /> : <Navigate to="/" replace />
          } />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/tickets" element={<Tickets token={token} userRole={user.role} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

interface ClientLayoutProps {
  token: string | null;
  user: UserSession | null;
  handleLogout: () => void;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ token, user, handleLogout }) => {
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!user.isClient) return <Navigate to="/" replace />;
  
  return <PortalDashboard user={user} onLogout={handleLogout} token={token} />;
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserSession | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  // Desktop sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Mobile sidebar toggle state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLoginSuccess = (newToken: string, sessionUser: UserSession) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(sessionUser));
    setToken(newToken);
    setUser(sessionUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token && !!user;

  return (
    <Router>
      <GlobalToast />

      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to={user?.isClient ? "/portal" : "/"} replace />} />
        <Route path="/portal/*" element={<ClientLayout token={token} user={user} handleLogout={handleLogout} />} />
        <Route path="/*" element={
          <MainLayout 
            token={token} 
            user={user} 
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            handleToggleSidebarCollapse={handleToggleSidebarCollapse}
            handleLogout={handleLogout}
          />
        } />
      </Routes>
    </Router>
  );
};

export default App;
