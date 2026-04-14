import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, Check, CheckCheck, Trash2 } from 'lucide-react';
import { notifications as notificationsApi } from '../lib/api';
import { ROUTES } from '../routes/constants';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Topbar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen]   = useState(false);
  const [notifs, setNotifs]         = useState([]);
  const notifRef                    = useRef(null);

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const fetchNotifs = () => {
    if (!localStorage.getItem('access')) return;
    notificationsApi.list().then(data => setNotifs(Array.isArray(data) ? data : (data?.results || []))).catch(console.error);
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) { console.error(err); }
  };

  const deleteNotif = async (e, id) => {
    e.stopPropagation();
    try {
      await notificationsApi.delete(id);
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch (err) { console.error(err); }
  };

  const deleteAll = async () => {
    try {
      await notificationsApi.deleteAll();
      setNotifs([]);
    } catch (err) { console.error(err); }
  };

  const handleNotifClick = async (n) => {
    if (!n.is_read) await markRead(n.id);
    if (n.candidate_id) {
      setNotifOpen(false);
      navigate(ROUTES.CANDIDATES.DETAIL(n.candidate_id));
    }
  };

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
        {/* Bell icon + dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative text-slate-300 hover:text-white transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-[#212631] text-[10px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-[500] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">
                  Notifications {unreadCount > 0 && <span className="text-blue-600">({unreadCount})</span>}
                </span>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                  {notifs.length > 0 && (
                    <button onClick={deleteAll} className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete all
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto max-h-96">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                    <Bell className="w-8 h-8 text-slate-200" />
                    <p className="text-xs">No notifications yet</p>
                  </div>
                ) : notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors cursor-pointer group ${!n.is_read ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {!n.is_read && (
                        <button onClick={(e) => { e.stopPropagation(); markRead(n.id); }} className="text-slate-300 hover:text-blue-600 transition-colors" title="Mark as read">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={(e) => deleteNotif(e, n.id)} className="text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">Welcome, {user?.full_name || 'User'}</span>
          <span className="text-slate-500">|</span>
          <button onClick={onLogout} className="text-slate-300 hover:text-white transition-colors text-sm">Logout</button>
        </div>
      </div>
    </header>
  );
}
