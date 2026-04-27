import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Users, Plus, X, Shield, Building2, Pencil, Trash2 } from 'lucide-react';
import { users as usersApi, departments as deptApi, roles as rolesApi } from '../lib/api';
import { useAuth } from '../lib/authContext';

// ── Shared helpers ─────────────────────────────────────────────────────────────

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

const STATUS_COLORS = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INVITED: 'bg-yellow-100 text-yellow-700',
  DISABLED: 'bg-slate-100 text-slate-400',
};

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'interviewer', label: 'Interviewer' },
];

// ── Manage Users ──────────────────────────────────────────────────────────────

function ManageUsersSection({ currentUser }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  // Create user modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '', email: '', role: 'recruiter', department: '', password: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Role change modal
  const [roleModal, setRoleModal] = useState({ open: false, user: null, newRole: '' });

  // Remove confirm modal
  const [removeModal, setRemoveModal] = useState({ open: false, user: null });
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([usersApi.list(), deptApi.list()])
      .then(([uRes, dRes]) => {
        setUsersList(uRes.results || uRes);
        setDepartments(dRes.results || dRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (u, newStatus) => {
    try {
      const updated = await usersApi.changeStatus(u.id, newStatus);
      setUsersList((prev) => prev.map((p) => (p.id === u.id ? updated : p)));
    } catch {
      alert('Failed to update status.');
    }
  };

  const openRoleModal = (u) => setRoleModal({ open: true, user: u, newRole: u.role });

  const confirmRoleChange = async () => {
    if (!roleModal.user || roleModal.newRole === roleModal.user.role) {
      setRoleModal({ open: false, user: null, newRole: '' });
      return;
    }
    setActionLoading(true);
    try {
      const updated = await usersApi.changeRole(roleModal.user.id, roleModal.newRole);
      setUsersList((prev) => prev.map((p) => (p.id === roleModal.user.id ? updated : p)));
      setRoleModal({ open: false, user: null, newRole: '' });
    } catch {
      alert('Failed to change role.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeModal.user) return;
    setActionLoading(true);
    try {
      await usersApi.remove(removeModal.user.id);
      setUsersList((prev) => prev.filter((p) => p.id !== removeModal.user.id));
      setRemoveModal({ open: false, user: null });
    } catch {
      alert('Failed to remove user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.full_name || !createForm.email || !createForm.password) return;
    setCreateLoading(true);
    try {
      const newUser = await usersApi.create(createForm);
      setUsersList((prev) => [newUser, ...prev]);
      setIsCreateOpen(false);
      setCreateForm({ full_name: '', email: '', role: 'recruiter', department: '', password: '' });
    } catch (err) {
      alert(err.data?.email?.[0] || err.data?.detail || 'Failed to create user.');
    } finally {
      setCreateLoading(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      <div className="flex items-center justify-between mb-4 mt-2">
        <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4" /> Team Members
        </h3>
        {isAdmin && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Invite User
          </button>
        )}
      </div>

      {loading ? (
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
                {isAdmin && (
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
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[u.status] || STATUS_COLORS['ACTIVE']}`}>
                      {u.status || (u.is_active ? 'ACTIVE' : 'DISABLED')}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {/* Role change */}
                        <button
                          onClick={() => openRoleModal(u)}
                          className="text-xs px-2.5 py-1 rounded font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          Change Role
                        </button>
                        {/* Status toggle */}
                        {u.status !== 'INVITED' && (
                          <button
                            onClick={() => handleStatusChange(u, u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                              u.status === 'ACTIVE'
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Disable' : 'Activate'}
                          </button>
                        )}
                        {/* Remove */}
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setRemoveModal({ open: true, user: u })}
                            className="text-xs px-2.5 py-1 rounded font-medium bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {usersList.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Role change confirmation modal */}
      {roleModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[420px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Change Role</h3>
              <button onClick={() => setRoleModal({ open: false, user: null, newRole: '' })}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Changing role will update access permissions for{' '}
              <span className="font-medium text-slate-700">{roleModal.user?.full_name}</span>.
              The user will need to re-login for the change to take effect.
            </p>
            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-sm font-medium text-slate-700">New Role</label>
              <select
                value={roleModal.newRole}
                onChange={(e) => setRoleModal((m) => ({ ...m, newRole: e.target.value }))}
                className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 bg-white"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmRoleChange}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded text-sm font-medium transition-colors"
              >
                {actionLoading ? 'Saving…' : 'Confirm Change'}
              </button>
              <button
                onClick={() => setRoleModal({ open: false, user: null, newRole: '' })}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[420px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Remove User</h3>
              <button onClick={() => setRemoveModal({ open: false, user: null })}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to remove{' '}
              <span className="font-medium text-slate-700">{removeModal.user?.full_name}</span>?
              Their account will be disabled and they will lose access immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmRemove}
                disabled={actionLoading}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 rounded text-sm font-medium transition-colors"
              >
                {actionLoading ? 'Removing…' : 'Remove User'}
              </button>
              <button
                onClick={() => setRemoveModal({ open: false, user: null })}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite user modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-800 text-lg">Invite New User</h3>
              <button onClick={() => setIsCreateOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Full Name *</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Department</label>
                  <select
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    className="border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateUser}
                disabled={createLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded text-sm font-medium transition-colors"
              >
                {createLoading ? 'Creating…' : 'Create User'}
              </button>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Manage Roles ──────────────────────────────────────────────────────────────

function ManageRolesSection({ isAdmin }) {
  const [rolesData, setRolesData] = useState([]);
  const [allPermKeys, setAllPermKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [checkedKeys, setCheckedKeys] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    rolesApi.list()
      .then((data) => {
        const list = data.results || data;
        setRolesData(list);
        // Derive full permission list from union of all role permissions
        const all = new Set();
        list.forEach((r) => r.permissions.forEach((p) => all.add(JSON.stringify(p))));
        setAllPermKeys([...all].map((s) => JSON.parse(s)));
        if (list.length > 0) {
          setSelectedRoleId(list[0].id);
          setCheckedKeys(new Set(list[0].permissions.map((p) => p.key)));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectRole = (role) => {
    setSelectedRoleId(role.id);
    setCheckedKeys(new Set(role.permissions.map((p) => p.key)));
    setSaved(false);
  };

  const togglePerm = (key) => {
    if (!isAdmin) return;
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setSaved(false);
  };

  const savePermissions = async () => {
    if (!selectedRoleId || !isAdmin) return;
    setSaving(true);
    try {
      const updated = await rolesApi.updatePermissions(selectedRoleId, [...checkedKeys]);
      setRolesData((prev) => prev.map((r) => (r.id === selectedRoleId ? updated : r)));
      setSaved(true);
    } catch (err) {
      alert(err.data?.detail || 'Failed to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = rolesData.find((r) => r.id === selectedRoleId);

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Loading roles…</div>;

  return (
    <div className="mt-2">
      <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4" /> Role Permissions
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Select a role to view or edit its permissions.
        {!isAdmin && ' Only admins can edit permissions.'}
      </p>
      <div className="flex gap-6">
        {/* Role list */}
        <div className="w-48 shrink-0 flex flex-col gap-2">
          {rolesData.map((role) => (
            <button
              key={role.id}
              onClick={() => selectRole(role)}
              className={`text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedRoleId === role.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <div className="capitalize">{role.name.replace('_', ' ')}</div>
              <div className={`text-xs mt-0.5 ${selectedRoleId === role.id ? 'text-blue-100' : 'text-slate-400'}`}>
                {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>

        {/* Permission checkboxes */}
        {selectedRole && (
          <div className="flex-1">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-700 capitalize">
                  {selectedRole.name.replace('_', ' ')} Permissions
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {allPermKeys.map((perm) => (
                  <label
                    key={perm.key}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isAdmin ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedKeys.has(perm.key)}
                      onChange={() => togglePerm(perm.key)}
                      disabled={!isAdmin}
                      className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">{perm.label}</div>
                      <div className="text-xs text-slate-400 font-mono">{perm.key}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {isAdmin && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Department Management ─────────────────────────────────────────────────────

function DepartmentsSection({ isAdmin }) {
  const [deptList, setDeptList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, dept: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    deptApi.list()
      .then((data) => setDeptList((data.results || data).filter((d) => d.is_active !== false)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAddLoading(true);
    setError('');
    try {
      const created = await deptApi.create({ name: newName.trim() });
      setDeptList((prev) => [...prev, created]);
      setNewName('');
    } catch (err) {
      setError(err.data?.name?.[0] || err.data?.detail || 'Failed to create department.');
    } finally {
      setAddLoading(false);
    }
  };

  const startEdit = (dept) => {
    setEditId(dept.id);
    setEditName(dept.name);
    setError('');
  };

  const saveEdit = async (dept) => {
    if (!editName.trim() || editName === dept.name) { setEditId(null); return; }
    setEditLoading(true);
    setError('');
    try {
      const updated = await deptApi.update(dept.id, { name: editName.trim() });
      setDeptList((prev) => prev.map((d) => (d.id === dept.id ? updated : d)));
      setEditId(null);
    } catch (err) {
      setError(err.data?.name?.[0] || err.data?.detail || 'Failed to update department.');
    } finally {
      setEditLoading(false);
    }
  };

  const confirmRemove = async () => {
    if (!deleteModal.dept) return;
    setDeleteLoading(true);
    try {
      await deptApi.remove(deleteModal.dept.id);
      setDeptList((prev) => prev.filter((d) => d.id !== deleteModal.dept.id));
      setDeleteModal({ open: false, dept: null });
    } catch (err) {
      const msg = err.data?.detail || 'Failed to remove department.';
      setError(msg);
      setDeleteModal({ open: false, dept: null });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Loading departments…</div>;

  return (
    <div className="mt-2">
      <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4" /> Departments
      </h3>

      {error && (
        <div className="mb-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3 text-left border-b border-slate-200">Name</th>
              {isAdmin && <th className="px-4 py-3 text-center border-b border-slate-200 w-32">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deptList.map((dept) => (
              <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-800">
                  {editId === dept.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(dept); if (e.key === 'Escape') setEditId(null); }}
                      className="border border-blue-400 rounded px-2 py-1 text-sm outline-none w-full max-w-xs"
                    />
                  ) : (
                    dept.name
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {editId === dept.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(dept)}
                            disabled={editLoading}
                            className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                          >
                            {editLoading ? '…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(dept)}
                            className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, dept })}
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {deptList.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 2 : 1} className="text-center py-8 text-slate-400">
                  No departments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="New department name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 w-64"
          />
          <button
            onClick={handleAdd}
            disabled={addLoading || !newName.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {addLoading ? 'Adding…' : 'Add Department'}
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[420px] max-w-[90vw] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Remove Department</h3>
              <button onClick={() => setDeleteModal({ open: false, dept: null })}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 mb-1">
                  Remove &ldquo;{deleteModal.dept?.name}&rdquo;?
                </p>
                <p className="text-sm text-slate-500">
                  This action cannot be undone. Departments with active users assigned cannot be removed.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmRemove}
                disabled={deleteLoading}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2 rounded text-sm font-medium transition-colors"
              >
                {deleteLoading ? 'Removing…' : 'Remove Department'}
              </button>
              <button
                onClick={() => setDeleteModal({ open: false, dept: null })}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────

const STATIC_SECTIONS = [
  'Email', 'Apply Experience', 'Company Information', 'Employee Referral Configuration',
  'Partner Management', 'Integration', 'Outlook Configurations', 'SEO',
  'Job Settings', 'Offer Template', 'Document Settings',
  'Job Distribution', 'FB Tab Settings', 'Candidate Email Update',
];

export default function Settings() {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState('Manage Users');

  const toggle = (section) => setOpenSection((s) => (s === section ? null : section));
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col max-w-5xl mx-auto">

          <Section
            title="Manage Users"
            isOpen={openSection === 'Manage Users'}
            onToggle={() => toggle('Manage Users')}
          >
            {openSection === 'Manage Users' && <ManageUsersSection currentUser={user} />}
          </Section>

          <Section
            title="Manage Roles"
            isOpen={openSection === 'Manage Roles'}
            onToggle={() => toggle('Manage Roles')}
          >
            {openSection === 'Manage Roles' && <ManageRolesSection isAdmin={isAdmin} />}
          </Section>

          <Section
            title="Department Settings"
            isOpen={openSection === 'Department Settings'}
            onToggle={() => toggle('Department Settings')}
          >
            {openSection === 'Department Settings' && <DepartmentsSection isAdmin={isAdmin} />}
          </Section>

          {STATIC_SECTIONS.map((item) => (
            <Section
              key={item}
              title={item}
              isOpen={openSection === item}
              onToggle={() => toggle(item)}
            >
              <p className="text-sm text-slate-500">Configuration for {item} will be available here.</p>
            </Section>
          ))}

        </div>
      </div>
    </div>
  );
}
