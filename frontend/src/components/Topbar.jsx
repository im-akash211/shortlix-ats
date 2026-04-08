  import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';

export default function Topbar({ user, onLogout }) {
  const location = useLocation();

  const getTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/jobs')) return 'Manage your Jobs & Applications';
    if (path.startsWith('/candidates')) return 'Talent Pool Search';
    if (path.startsWith('/approvals')) return 'Manage your Approvals';
    if (path.startsWith('/interviews')) return 'Manage your Interviews';
    if (path.startsWith('/requisitions')) return 'Manage your Requisitions';
    if (path.startsWith('/settings')) return 'Manage Settings';
    return 'Manage Dashboard';
  };

  return (
    <header className="h-16 bg-[#212631] text-white flex items-center justify-between px-6 shrink-0 border-b border-slate-700/50">
      <div className="text-sm font-medium opacity-90 flex items-center gap-2">
        <span className="text-slate-400">Shorthills AI</span>
        <span className="text-slate-600">|</span>
        {getTitle()}
      </div>
      <div className="flex items-center gap-6">
        <button className="relative text-slate-300 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-[#212631]"></span>
        </button>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">Welcome, {user?.full_name || 'User'}</span>
          <span className="text-slate-500">|</span>
          <button onClick={onLogout} className="text-slate-300 hover:text-white transition-colors text-sm">Logout</button>
        </div>
      </div>
    </header>
  );
}
