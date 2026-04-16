import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Users, Plus, X } from 'lucide-react';
import { users as usersApi, departments as deptApi } from '../lib/api';
import { useAuth } from '../lib/authContext';

function Section({ title, isOpen, onToggle, children }) {
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <span className="text-lg text-slate-700">{title}</span>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {isOpen && <div className="pb-6">{children}</div>}
    </div>
  );
}

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  hiring_manager: 'bg-blue-100 text-blue-700',
  recruiter: 'bg-emerald-100 text-emerald-700',
  interviewer: 'bg-amber-100 text-amber-700',
};

export default function Settings() {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState('Manage Users');
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', role: 'recruiter', department: '', password: '' });
  const [createLoading, setCreateLoading] = useState(false);

  const toggleSection = (section) => setOpenSection(openSection === section ? null : section);

  useEffect(() => {
    if (openSection === 'Manage Users') {
      setUsersLoading(true);
      Promise.all([usersApi.list(), deptApi.list()])
        .then(([uRes, dRes]) => {
          setUsersList(uRes.results || uRes);
          setDepartments(dRes.results || dRes);
        })
        .catch(console.error)
        .finally(() => setUsersLoading(false));
    }
  }, [openSection]);

  const handleToggleActive = async (u) => {
    try {
      if (u.is_active) {
        await usersApi.deactivate(u.id);
      } else {
        await usersApi.activate(u.id);
      }
      setUsersList((prev) =>
        prev.map((p) => (p.id === u.id ? { ...p, is_active: !p.is_active } : p))
      );
    } catch (err) {
      alert('Failed to update user status');
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.full_name || !createForm.email || !createForm.password) return;
    setCreateLoading(true);
    try {
      const newUser = await usersApi.create(createForm);
      setUsersList((prev) => [newUser, ...prev]);
      setIsCreateUserOpen(false);
      setCreateForm({ full_name: '', email: '', role: 'recruiter', department: '', password: '' });
    } catch (err) {
      alert(err.data?.email?.[0] || err.data?.detail || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const staticSections = [
    'Email', 'Apply Experience', 'Company Information', 'Employee Referral Configuration',
    'Partner Management', 'Integration', 'Outlook Configurations', 'SEO',
    'Job Settings', 'Offer Template', 'Document Settings', 'Department Settings',
    'Job Distribution', 'FB Tab Settings', 'Candidate Email Update'
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col max-w-5xl mx-auto">
          {/* Manage Users — wired to API */}
          <Section
            title="Manage Users"
            isOpen={openSection === 'Manage Users'}
            onToggle={() => toggleSection('Manage Users')}
          >
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Team Members
              </h3>
              {user?.role === 'admin' && (
                <button
                  onClick={() => setIsCreateUserOpen(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" /> Invite User
                </button>
              )}
            </div>

            {usersLoading ? (
              <div className="text-slate-400 text-sm py-8 text-center">Loading users…</div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-4 py-3 text-left border-b border-slate-200">Name</th>
                      <th className="px-4 py-3 text-left border-b border-slate-200">Email</th>
                      <th className="px-4 py-3 text-left border-b border-slate-200">Role</th>
                      <th className="px-4 py-3 text-left border-b border-slate-200">Department</th>
                      <th className="px-4 py-3 text-center border-b border-slate-200">Status</th>
                      {user?.role === 'admin' && (
                        <th className="px-4 py-3 text-center border-b border-slate-200">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{u.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                            {u.role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{u.department_name || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {user?.role === 'admin' && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`text-xs px-3 py-1 rounded font-medium transition-colors ${u.is_active ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {usersList.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-400">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Static accordion sections */}
          {staticSections.map((item) => (
            <Section
              key={item}
              title={item}
              isOpen={openSection === item}
              onToggle={() => toggleSection(item)}
            >
              <p className="text-sm text-slate-500">Configuration for {item} will be available here.</p>
            </Section>
          ))}
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-800 text-lg">Invite New User</h3>
              <button onClick={() => setIsCreateUserOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Full Name *</label>
                <input type="text" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Email *</label>
                <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Password *</label>
                <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Role</label>
                  <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="recruiter">Recruiter</option>
                    <option value="hiring_manager">Hiring Manager</option>
                    <option value="admin">Admin</option>
                    <option value="interviewer">Interviewer</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Department</label>
                  <select value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })} className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 bg-white">
                    <option value="">None</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreateUser} disabled={createLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded text-sm font-medium transition-colors">
                {createLoading ? 'Creating…' : 'Create User'}
              </button>
              <button onClick={() => setIsCreateUserOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
