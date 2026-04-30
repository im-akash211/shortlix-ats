import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { ROUTES } from '../routes/constants';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { handleLogin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await auth.login(email, password);
      auth.saveSession(data);
      handleLogin(data.user);
      const landing = data.user.role === 'interviewer' ? ROUTES.INTERVIEWS : ROUTES.DASHBOARD;
      navigate(landing, { replace: true });
    } catch (err) {
      setError(err.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">ATS Platform</h1>
          <p className="text-sm text-slate-500">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ats.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Demo accounts for testing:</p>
          <div className="flex flex-col gap-1.5">
            {[
              { email: 'admin@ats.com',        password: 'Admin@123', role: 'Admin' },
              { email: 'nikhil.bhatia@ats.com', password: 'Admin@123',  role: 'Recruiter' },
              { email: 'vikash.sharma@ats.com',  password: 'Admin@123',  role: 'Hiring Manager' },
              { email: 'rajat.mehra@ats.com',    password: 'Pass@123',   role: 'Interviewer' },
            ].map(acc => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword(acc.password); }}
                className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-100 transition-colors"
              >
                <span className="font-mono">{acc.email}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400">{acc.password}</span>
                  <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{acc.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-center text-xs text-slate-400 mb-3">Are you an employee?</p>
          <button
            type="button"
            onClick={() => navigate(ROUTES.EMPLOYEE_PORTAL)}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <span>👥</span> Employee Referral Portal
          </button>
        </div>
      </div>
    </div>
  );
}
