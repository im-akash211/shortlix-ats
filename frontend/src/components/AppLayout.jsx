import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../lib/authContext';

export default function AppLayout() {
  const { user, handleLogout } = useAuth();

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar user={user} onLogout={handleLogout} />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
