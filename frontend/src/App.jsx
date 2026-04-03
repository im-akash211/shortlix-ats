import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import Candidates from './pages/Candidates';
import Approvals from './pages/Approvals';
import Interviews from './pages/Interviews';
import Requisitions from './pages/Requisitions';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { auth, clearAuth } from './lib/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [user, setUser] = useState(() => auth.getUser());

  useEffect(() => {
    const handler = () => {
      setUser(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    auth.logout().catch(() => {});
    clearAuth();
    setUser(null);
  };

  if (!user || !localStorage.getItem('access')) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':    return <Dashboard setActiveTab={setActiveTab} user={user} />;
      case 'Jobs':         return <Jobs user={user} />;
      case 'Candidates':   return <Candidates user={user} />;
      case 'Approvals':    return <Approvals user={user} />;
      case 'Interviews':   return <Interviews user={user} />;
      case 'Requisitions': return <Requisitions user={user} />;
      case 'Settings':     return <Settings user={user} />;
      default:             return <Dashboard setActiveTab={setActiveTab} user={user} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar activeTab={activeTab} user={user} onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-hidden p-6 flex flex-col">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
