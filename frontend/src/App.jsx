import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ROUTES } from './routes/constants';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PageSkeleton from './components/PageSkeleton';

// Eager load Login since it's the entrypoint for users
import Login from './pages/Login';

// Lazy load actual protected features
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Candidates = lazy(() => import('./pages/Candidates'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Interviews = lazy(() => import('./pages/Interviews'));
const Requisitions = lazy(() => import('./pages/Requisitions'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
              
              <Route path={ROUTES.DASHBOARD} element={
                <Suspense fallback={<PageSkeleton />}>
                  <Dashboard />
                </Suspense>
              } />

              <Route path={`${ROUTES.JOBS.ROOT}/*`} element={
                <Suspense fallback={<PageSkeleton />}>
                  <Jobs />
                </Suspense>
              } />

              <Route path={`${ROUTES.CANDIDATES.ROOT}/*`} element={
                <Suspense fallback={<PageSkeleton />}>
                  <Candidates />
                </Suspense>
              } />

              <Route path={ROUTES.APPROVALS} element={
                <Suspense fallback={<PageSkeleton />}>
                  <Approvals />
                </Suspense>
              } />
              
              <Route path={ROUTES.INTERVIEWS} element={
                <Suspense fallback={<PageSkeleton />}>
                  <Interviews />
                </Suspense>
              } />
              
              <Route path={`${ROUTES.REQUISITIONS.ROOT}/*`} element={
                <Suspense fallback={<PageSkeleton />}>
                  <Requisitions />
                </Suspense>
              } />
              
              <Route path={ROUTES.SETTINGS} element={
                <Suspense fallback={<PageSkeleton />}>
                  <Settings />
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
