import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Calendar, CheckSquare, FileText, Settings, ChevronLeft, ChevronRight, GitMerge } from 'lucide-react';
import { cn } from '../lib/utils';
import { ROUTES } from '../routes/constants';
import { useAuth } from '../lib/authContext';
import { hasPermission } from '../lib/permissions';

export default function Sidebar() {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [width, setWidth] = useState(80);
  const isResizing = useRef(false);
  const sidebarRef = useRef(null);

  const MIN_WIDTH = 200;
  const MAX_WIDTH = 400;
  const COLLAPSED_WIDTH = 80;

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      
      let newWidth = e.clientX;
      
      if (newWidth < MIN_WIDTH / 2) {
        setIsCollapsed(true);
        setWidth(COLLAPSED_WIDTH);
      } else {
        setIsCollapsed(false);
        if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
        if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const toggleCollapse = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setWidth(256);
    } else {
      setIsCollapsed(true);
      setWidth(COLLAPSED_WIDTH);
    }
  };

  const allNavItems = [
    { name: 'Dashboard',    icon: LayoutDashboard, path: ROUTES.DASHBOARD,           perm: 'VIEW_REPORTS' },
    { name: 'Jobs',         icon: Briefcase,        path: ROUTES.JOBS.ROOT,           perm: 'VIEW_JOBS' },
    { name: 'Candidates',   icon: Users,            path: ROUTES.CANDIDATES.ROOT,     perm: 'VIEW_CANDIDATES' },
    { name: 'Interviews',   icon: Calendar,         path: ROUTES.INTERVIEWS,          perm: 'GIVE_FEEDBACK' },
    { name: 'Approvals',    icon: CheckSquare,      path: ROUTES.APPROVALS,           perm: 'APPROVE_REQUISITIONS' },
    { name: 'Requisitions', icon: FileText,         path: ROUTES.REQUISITIONS.ROOT,   perm: 'MANAGE_REQUISITIONS' },
    { name: 'Referrals',    icon: GitMerge,         path: ROUTES.REFERRALS,           perm: 'VIEW_REPORTS' },
    { name: 'Settings',     icon: Settings,         path: ROUTES.SETTINGS,            perm: 'MANAGE_USERS' },
  ];
  const navItems = allNavItems.filter(item => hasPermission(user, item.perm));

  return (
    <aside 
      ref={sidebarRef}
      className="bg-[#212631] text-slate-300 flex flex-col h-full shrink-0 relative z-20"
      style={{ 
        width: isCollapsed ? COLLAPSED_WIDTH : width, 
        transition: isResizing.current ? 'none' : 'width 300ms ease-in-out' 
      }}
    >
      <div className={cn("h-16 flex items-center border-b border-slate-700/50 shrink-0", isCollapsed ? "justify-center px-0" : "px-6")}>
        <div className="flex items-center gap-2 text-white font-semibold text-lg overflow-hidden whitespace-nowrap">
          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          {!isCollapsed && <span>Shorthills AI</span>}
        </div>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) => cn(
              "flex items-center gap-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full text-left",
              isActive
                ? "bg-slate-700/50 text-white"
                : "hover:bg-slate-800/50 hover:text-white",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <item.icon className="w-5 h-5 opacity-70 shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      <button 
        onClick={toggleCollapse}
        className="absolute -right-3 top-5 bg-slate-800 text-slate-300 rounded-full p-1 border border-slate-600 hover:text-white hover:bg-slate-700 z-30 shadow-sm"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Resizer handle */}
      <div 
        className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 z-10 transition-colors"
        onMouseDown={startResizing}
      />
    </aside>
  );
}
