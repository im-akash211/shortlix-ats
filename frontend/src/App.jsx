import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/authContext';
import { ROUTES } from './routes/constants';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PageSkeleton from './components/PageSkeleton';
import { hasPermission } from './lib/permissions';
import ForbiddenPage from './pages/ForbiddenPage';

// Eager load Login and EmployeePortal (public entrypoints)
import Login from './pages/Login';
import EmployeePortal from './pages/EmployeePortal';

// Lazy load actual protected features
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Jobs = lazy(() => import('./pages/Jobs'));
const JobPipelinePage = lazy(() => import('./pages/Jobs/JobPipelinePage'));
const Candidates = lazy(() => import('./pages/Candidates'));
const CandidateProfile = lazy(() => import('./pages/CandidateProfile'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Interviews = lazy(() => import('./pages/Interviews'));
const Requisitions = lazy(() => import('./pages/Requisitions'));
const Settings = lazy(() => import('./pages/Settings'));
const Referrals = lazy(() => import('./pages/Referrals'));

function PermissionRoute({ permission, children }) {
  const { user } = useAuth();
  if (!hasPermission(user, permission)) return <ForbiddenPage />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path={ROUTES.EMPLOYEE_PORTAL} element={<EmployeePortal />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />

              <Route path={ROUTES.DASHBOARD} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="VIEW_REPORTS">
                    <Dashboard />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={ROUTES.JOBS.PIPELINE_PATTERN} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="VIEW_JOBS">
                    <JobPipelinePage />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={`${ROUTES.JOBS.ROOT}/*`} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="VIEW_JOBS">
                    <Jobs />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={ROUTES.CANDIDATES.PROFILE_PATTERN} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="VIEW_CANDIDATES">
                    <CandidateProfile />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={`${ROUTES.CANDIDATES.ROOT}/*`} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="VIEW_CANDIDATES">
                    <Candidates />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={ROUTES.APPROVALS} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="APPROVE_REQUISITIONS">
                    <Approvals />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={ROUTES.INTERVIEWS} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="GIVE_FEEDBACK">
                    <Interviews />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={`${ROUTES.REQUISITIONS.ROOT}/*`} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="MANAGE_REQUISITIONS">
                    <Requisitions />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={ROUTES.SETTINGS} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="MANAGE_USERS">
                    <Settings />
                  </PermissionRoute>
                </Suspense>
              } />

              <Route path={ROUTES.REFERRALS} element={
                <Suspense fallback={<PageSkeleton />}>
                  <PermissionRoute permission="VIEW_REPORTS">
                    <Referrals />
                  </PermissionRoute>
                </Suspense>
              } />

              {/* Catch-all route to dashboard */}
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
