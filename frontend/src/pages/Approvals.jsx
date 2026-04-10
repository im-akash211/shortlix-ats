import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, Search, ChevronDown, FolderSearch } from 'lucide-react';
import { PageLoader } from '../components/LoadingDots';
import { requisitions as reqApi } from '../lib/api';

export default function Approvals({ user }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Phase D: activeStatus URL-backed — tab state survives refresh and navigation
  const activeStatus = searchParams.get('status') || 'pending_approval';
  const setActiveStatus = (val) => setSearchParams(p => { p.set('status', val); return p; });

  // Phase B: one query per status — all three are fetched on mount and cached independently.
  // Switching tabs instantly restores cached data; no reload needed.
  const { data: res_pending, isLoading: pendingLoading } = useQuery({
    queryKey: ['approvals', 'pending_approval'],
    queryFn: () => reqApi.list({ status: 'pending_approval' }),
    placeholderData: (prev) => prev,
  });
  const { data: res_approved, isLoading: approvedLoading } = useQuery({
    queryKey: ['approvals', 'approved'],
    queryFn: () => reqApi.list({ status: 'approved' }),
    placeholderData: (prev) => prev,
  });
  const { data: res_rejected, isLoading: rejectedLoading } = useQuery({
    queryKey: ['approvals', 'rejected'],
    queryFn: () => reqApi.list({ status: 'rejected' }),
    placeholderData: (prev) => prev,
  });

  const toList = (res) => res ? (res.results || res) : [];
  const toCount = (res) => res?.count ?? toList(res).length;

  const counts = {
    pending:  toCount(res_pending),
    approved: toCount(res_approved),
    rejected: toCount(res_rejected),
  };

  const data = activeStatus === 'pending_approval' ? toList(res_pending)
             : activeStatus === 'approved'         ? toList(res_approved)
             : toList(res_rejected);

  const isLoading = activeStatus === 'pending_approval' ? pendingLoading
                  : activeStatus === 'approved'         ? approvedLoading
                  : rejectedLoading;

  const handleApprove = async (id) => {
    try {
      await reqApi.approve(id, 'Approved via Approvals page.');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    } catch (err) {
      alert(err.data?.error || 'Failed to approve');
    }
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const STATUS_OPTIONS = [
    { value: 'pending_approval', label: 'Pending Approval' },
    { value: 'approved',         label: 'Approved' },
    { value: 'rejected',         label: 'Rejected' },
  ];

  const handleReject = async (id) => {
    try {
      await reqApi.reject(id, 'Rejected via Approvals page.');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
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
          <div className="ml-auto relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm text-slate-600 capitalize">{STATUS_OPTIONS.find(o => o.value === activeStatus)?.label}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setActiveStatus(opt.value); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeStatus === opt.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1"><PageLoader label="Loading requisitions…" /></div>
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
