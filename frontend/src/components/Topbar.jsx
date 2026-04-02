import React from 'react';
import { Bell } from 'lucide-react';

export default function Topbar({ activeTab, user, onLogout }) {
  const getTitle = () => {
    switch(activeTab) {
      case 'Jobs': return 'Manage your Jobs & Applications';
      case 'Candidates': return 'Talent Pool Search';
      case 'Approvals': return 'Manage your Approvals';
      case 'Interviews': return 'Manage your Interviews';
      case 'Requisitions': return 'Manage your Requisitions';
      case 'Settings': return 'Manage Settings';
      default: return `Manage ${activeTab}`;
    }
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
