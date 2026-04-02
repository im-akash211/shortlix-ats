import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, Search, ChevronDown, FolderSearch } from 'lucide-react';
import { requisitions as reqApi } from '../lib/api';

export default function Approvals({ user }) {
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [data, setData] = useState([]);
  const [activeStatus, setActiveStatus] = useState('pending_approval');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load counts for each status
    Promise.all([
      reqApi.list({ status: 'pending_approval' }),
      reqApi.list({ status: 'approved' }),
      reqApi.list({ status: 'rejected' }),
    ]).then(([pending, approved, rejected]) => {
      setCounts({
        pending: pending.count || (pending.results || pending).length,
        approved: approved.count || (approved.results || approved).length,
        rejected: rejected.count || (rejected.results || rejected).length,
      });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    reqApi.list({ status: activeStatus })
      .then((res) => setData(res.results || res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeStatus]);

  const handleApprove = async (id) => {
    try {
      await reqApi.approve(id, 'Approved via Approvals page.');
      setData((prev) => prev.filter((r) => r.id !== id));
      setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), approved: c.approved + 1 }));
    } catch (err) {
      alert(err.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    try {
      await reqApi.reject(id, 'Rejected via Approvals page.');
      setData((prev) => prev.filter((r) => r.id !== id));
      setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), rejected: c.rejected + 1 }));
    } catch (err) {
      alert(err.data?.error || 'Failed to reject');
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Counter cards */}
      <div className="grid grid-cols-3 gap-6">
        <button
          onClick={() => setActiveStatus('pending_approval')}
          className={`bg-white border-2 rounded-xl p-6 flex justify-between items-start shadow-sm transition-all ${activeStatus === 'pending_approval' ? 'border-blue-500' : 'border-slate-200 hover:border-blue-300'}`}
        >
          <div className="flex flex-col gap-1">
            <span className="text-5xl font-bold text-blue-600">{counts.pending}</span>
            <span className="text-slate-600 font-medium">Pending</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
        </button>
        <button
          onClick={() => setActiveStatus('approved')}
          className={`bg-white border-2 rounded-xl p-6 flex justify-between items-start shadow-sm transition-all ${activeStatus === 'approved' ? 'border-emerald-500' : 'border-slate-200 hover:border-emerald-300'}`}
        >
          <div className="flex flex-col gap-1">
            <span className="text-5xl font-bold text-emerald-600">{counts.approved}</span>
            <span className="text-slate-600 font-medium">Approved</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </button>
        <button
          onClick={() => setActiveStatus('rejected')}
          className={`bg-white border-2 rounded-xl p-6 flex justify-between items-start shadow-sm transition-all ${activeStatus === 'rejected' ? 'border-rose-500' : 'border-slate-200 hover:border-rose-300'}`}
        >
          <div className="flex flex-col gap-1">
            <span className="text-5xl font-bold text-rose-600">{counts.rejected}</span>
            <span className="text-slate-600 font-medium">Rejected</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <XCircle className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Requisitions list */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-80">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search requisitions" className="bg-transparent outline-none text-sm w-full" />
          </div>
          <div className="ml-auto flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-600 capitalize">{activeStatus.replace('_', ' ')}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-3">
            <FolderSearch className="w-12 h-12 text-slate-300" />
            <p>No {activeStatus.replace('_', ' ')} requisitions.</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200">Requisition</th>
                  <th className="px-4 py-3 border-b border-slate-200">Department</th>
                  <th className="px-4 py-3 border-b border-slate-200">Hiring Manager</th>
                  <th className="px-4 py-3 border-b border-slate-200">Priority</th>
                  <th className="px-4 py-3 border-b border-slate-200">Created</th>
                  {activeStatus === 'pending_approval' && user?.role !== 'recruiter' && (
                    <th className="px-4 py-3 border-b border-slate-200 text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((req) => (
                  <tr key={req.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-800">{req.title}</span>
                        <span className="text-slate-500 text-xs">{req.location}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{req.department_name}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{req.hiring_manager_name}</td>
                    <td className="px-4 py-4 align-top">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                        req.priority === 'critical' ? 'bg-rose-100 text-rose-700' :
                        req.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{req.priority}</span>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-500 text-sm">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                    {activeStatus === 'pending_approval' && user?.role !== 'recruiter' && (
                      <td className="px-4 py-4 align-top text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleApprove(req.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded text-xs font-medium transition-colors">Approve</button>
                          <button onClick={() => handleReject(req.id)} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded text-xs font-medium transition-colors">Reject</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
