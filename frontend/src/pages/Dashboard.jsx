import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '../components/LoadingDots';
import RecruitmentProgress from '../components/RecruitmentProgress';
import { dashboard } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { ROUTES } from '../routes/constants';
import { TrendingUp, Users, CheckSquare, Calendar, ChevronRight, Layers, Award, Clock, ThumbsUp, GitMerge, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const summaryParams = {};

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['dashboard', 'summary', summaryParams, user?.id],
    queryFn: () => dashboard.summary(summaryParams),
    placeholderData: (previousData) => previousData,
    enabled: !!user,
  });

  const { data: pendingActions } = useQuery({
    queryKey: ['dashboard', 'pendingActions', user?.id],
    queryFn: dashboard.pendingActions,
    enabled: !!user,
  });

  const getMetric = (title) => summaryData?.metrics?.find((m) => m.title === title);

  const jobsMetric        = getMetric('Jobs');
  const appliesMetric     = getMetric('Applies');
  const offeredMetric     = getMetric('Offered');
  const joinedMetric      = getMetric('Joined');
  const shortlistedMetric = getMetric('Shortlisted');
  const interviewsMetric  = getMetric('Interviews');

  const totalApplies  = Number(appliesMetric?.value  ?? 0);
  const totalOffered  = Number(offeredMetric?.value  ?? 0);
  const totalJoined   = Number(joinedMetric?.value   ?? 0);

  const totalEverOffered = totalOffered + totalJoined; // joined candidates were also offered
  const offerJoinRate = totalEverOffered > 0 ? Math.min(100, Math.round((totalJoined / totalEverOffered) * 100)) : 0;

  const stageApplied     = Number(getMetric('Applied')?.value     ?? 0);
  const stageShortlisted = Number(shortlistedMetric?.value        ?? 0);
  const stageInterview   = Number(getMetric('Interview')?.value   ?? 0);
  const stageDropped     = Number(getMetric('Dropped')?.value     ?? 0);

  const funnelStages = [
    { label: 'Applied',     count: stageApplied + stageShortlisted + stageInterview + totalOffered + totalJoined + stageDropped },
    { label: 'Shortlisted', count: stageShortlisted + stageInterview + totalOffered + totalJoined },
    { label: 'Interview',   count: stageInterview + totalOffered + totalJoined },
    { label: 'Offered',     count: totalOffered + totalJoined },
    { label: 'Joined',      count: totalJoined },
  ];
  const maxFunnelCount = funnelStages[0].count || 1;

  const allBreakdown = summaryData?.recruitment_progress?.all_breakdown || {};
  const topSource    = Object.entries(allBreakdown).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="h-full overflow-y-auto" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#f8f9fa' }}>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
          Recruitment Overview
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-[#565e72]">Track your hiring pipeline at a glance</p>
          {user?.role !== 'admin' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#dae2fa] text-[#0058be]">
              {user?.role === 'hiring_manager' ? 'Your Jobs' : user?.role === 'recruiter' ? 'Your Assigned Jobs' : 'Your Interviews'}
            </span>
          )}
          {user?.role === 'admin' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              All Jobs
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <PageLoader label="Loading metrics…" />
      ) : (
        <>
          {/* ── Hero Metrics ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            {/* Active Jobs */}
            <div
              className="bg-white rounded-xl relative overflow-hidden cursor-pointer group transition-all hover:bg-[#f0f5ff] hover:shadow-lg"
              style={{ padding: '2rem', boxShadow: '0 12px 32px rgba(25,28,29,0.06)' }}
              onClick={() => navigate(ROUTES.JOBS.ROOT)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0058be]" />
              <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-[#0058be] opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[#565e72] text-sm font-medium mb-1">Active Jobs</p>
              <h2 className="text-4xl font-bold text-[#191c1d] mb-2" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
                {jobsMetric?.value ?? '—'}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0058be]">
                <TrendingUp className="w-4 h-4" />
                <span>{jobsMetric?.trend_pct ?? 0}% this week</span>
              </div>
            </div>

            {/* Pipeline Candidates */}
            <div
              className="bg-white rounded-xl relative overflow-hidden cursor-pointer group transition-all hover:bg-[#f0f5ff] hover:shadow-lg"
              style={{ padding: '2rem', boxShadow: '0 12px 32px rgba(25,28,29,0.06)' }}
              onClick={() => navigate(ROUTES.CANDIDATES.ROOT)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0058be]" />
              <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-[#0058be] opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[#565e72] text-sm font-medium mb-1">Pipeline Candidates</p>
              <h2 className="text-4xl font-bold text-[#191c1d] mb-2" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
                {totalApplies.toLocaleString()}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0058be]">
                <Users className="w-4 h-4" />
                <span>{Number(shortlistedMetric?.value ?? 0)} shortlisted</span>
              </div>
            </div>

            {/* Offer to Join Rate */}
            <div className="bg-white rounded-xl relative overflow-hidden" style={{ padding: '2rem', boxShadow: '0 12px 32px rgba(25,28,29,0.06)' }}>
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#924700]" />
              <p className="text-[#565e72] text-sm font-medium mb-1">Offer to Join Rate</p>
              <div className="flex items-end gap-3 mb-2">
                <h2 className="text-4xl font-bold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
                  {offerJoinRate}%
                </h2>
                <span className="text-xs bg-[#924700] text-white px-2 py-0.5 rounded mb-2 uppercase tracking-tight font-semibold">
                  {totalJoined} Joined
                </span>
              </div>
              <div className="w-full h-1 bg-[#f3f4f5] rounded-full overflow-hidden">
                <div className="h-full bg-[#924700] transition-all" style={{ width: `${offerJoinRate}%` }} />
              </div>
            </div>
          </section>

          {/* ── Bento Grid ── */}
          <div className="grid grid-cols-12 gap-6 mb-8">

            {/* Recruitment Funnel */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-xl" style={{ padding: '2rem', boxShadow: '0 12px 32px rgba(25,28,29,0.06)', minHeight: '360px' }}>
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-semibold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
                  Recruitment Funnel
                </h3>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#f3f4f5] text-[#424754]">
                  Current Period
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {funnelStages.map((stage, i) => {
                  const widthPct  = Math.max(Math.round((stage.count / maxFunnelCount) * 100), stage.count > 0 ? 15 : 4);
                  const prevCount = i > 0 ? funnelStages[i - 1].count : null;
                  const convPct   = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : null;
                  const bgAlpha   = [1, 0.8, 0.6, 0.4, 0.2][i];
                  const isLight   = bgAlpha < 0.4;
                  return (
                    <div key={stage.label} className="flex items-center gap-4">
                      <div className="w-24 text-right shrink-0">
                        <span className="text-xs font-bold text-[#565e72] uppercase tracking-wider">{stage.label}</span>
                      </div>
                      <div className="flex-1 bg-[#0058be]/10 rounded-lg h-12 relative overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center px-4 justify-between transition-all"
                          style={{ width: `${widthPct}%`, backgroundColor: `rgba(0,88,190,${bgAlpha})` }}
                        >
                          <span className={`text-sm font-bold ${isLight ? 'text-[#0058be]' : 'text-white'}`}>
                            {stage.count.toLocaleString()}
                          </span>
                          {convPct !== null && (
                            <span className={`text-[10px] font-medium uppercase hidden sm:block ${isLight ? 'text-[#0058be]/60' : 'text-white/60'}`}>
                              {convPct}% Conv.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Immediate Actions */}
            <div className="col-span-12 lg:col-span-4 rounded-xl flex flex-col gap-6" style={{ padding: '2rem', backgroundColor: '#f3f4f5' }}>
              <h3 className="text-xl font-semibold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
                Immediate Actions
              </h3>
              <div className="space-y-4">

                <div
                  className="bg-white p-4 rounded-lg cursor-pointer group hover:shadow-md transition-shadow"
                  style={{ border: '1px solid rgba(194,198,214,0.15)' }}
                  onClick={() => navigate(ROUTES.REQUISITIONS.ROOT)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,88,190,0.05)' }}>
                      <CheckSquare className="w-5 h-5 text-[#0058be]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#191c1d]">Approve Requisitions</p>
                      <p className="text-xs text-[#565e72]">{pendingActions?.pending_approvals ?? 0} pending approvals</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#0058be] transition-colors shrink-0" />
                  </div>
                </div>

                <div
                  className="bg-white p-4 rounded-lg cursor-pointer group hover:shadow-md transition-shadow"
                  style={{ border: '1px solid rgba(194,198,214,0.15)' }}
                  onClick={() => navigate(ROUTES.INTERVIEWS)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(146,71,0,0.05)' }}>
                      <Calendar className="w-5 h-5 text-[#924700]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#191c1d]">Interview Feedback</p>
                      <p className="text-xs text-[#565e72]">{pendingActions?.pending_feedback ?? 0} pending feedback</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#0058be] transition-colors shrink-0" />
                  </div>
                </div>

                <div
                  className="bg-white p-4 rounded-lg cursor-pointer group hover:shadow-md transition-shadow"
                  style={{ border: '1px solid rgba(194,198,214,0.15)' }}
                  onClick={() => navigate(ROUTES.JOBS.ROOT)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,88,190,0.05)' }}>
                      <Layers className="w-5 h-5 text-[#0058be]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#191c1d]">View Pipeline</p>
                      <p className="text-xs text-[#565e72]">{jobsMetric?.value ?? 0} active jobs in pipeline</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#0058be] transition-colors shrink-0" />
                  </div>
                </div>

                {user?.role === 'admin' && (
                  <div
                    className="bg-white p-4 rounded-lg cursor-pointer group hover:shadow-md transition-shadow"
                    style={{ border: '1px solid rgba(194,198,214,0.15)' }}
                    onClick={() => navigate(ROUTES.REFERRALS)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(124,58,237,0.05)' }}>
                        <GitMerge className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#191c1d]">Pending Referrals</p>
                        <p className="text-xs text-[#565e72]">{pendingActions?.pending_referrals ?? 0} awaiting review</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#0058be] transition-colors shrink-0" />
                    </div>
                  </div>
                )}

                {(pendingActions?.stale_candidates ?? 0) > 0 && (
                  <div
                    className="bg-white p-4 rounded-lg cursor-pointer group hover:shadow-md transition-shadow"
                    style={{ border: '1px solid rgba(194,198,214,0.15)' }}
                    onClick={() => navigate(ROUTES.CANDIDATES.ROOT)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(220,38,38,0.05)' }}>
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#191c1d]">Stale Candidates</p>
                        <p className="text-xs text-[#565e72]">{pendingActions.stale_candidates} stuck for 7+ days</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#0058be] transition-colors shrink-0" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom Insight Cards ── */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

            <div className="bg-white p-6 rounded-xl" style={{ boxShadow: '0 12px 32px rgba(25,28,29,0.06)' }}>
              <p className="text-[#565e72] text-xs font-bold uppercase tracking-wider mb-4">Shortlisted</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center bg-[#dae2fa]">
                  <Award className="w-4 h-4 text-[#0058be]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {Number(shortlistedMetric?.value ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-[#565e72]">{shortlistedMetric?.trend_pct ?? 0}% this week</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl" style={{ boxShadow: '0 12px 32px rgba(25,28,29,0.06)' }}>
              <p className="text-[#565e72] text-xs font-bold uppercase tracking-wider mb-4">Interviews</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center bg-[#dae2fa]">
                  <Clock className="w-4 h-4 text-[#0058be]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {Number(interviewsMetric?.value ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-[#0058be] font-semibold">{interviewsMetric?.trend_pct ?? 0}% vs last week</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl" style={{ boxShadow: '0 12px 32px rgba(25,28,29,0.06)' }}>
              <p className="text-[#565e72] text-xs font-bold uppercase tracking-wider mb-4">Avg. Time to Hire</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center bg-[#dae2fa]">
                  <ThumbsUp className="w-4 h-4 text-[#0058be]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {summaryData?.avg_days_to_hire != null ? `${summaryData.avg_days_to_hire} days` : '—'}
                  </p>
                  <p className="text-xs text-[#565e72]">Applied → Offered/Joined</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl" style={{ boxShadow: '0 12px 32px rgba(25,28,29,0.06)' }}>
              <p className="text-[#565e72] text-xs font-bold uppercase tracking-wider mb-4">Top Source</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center bg-[#dae2fa]">
                  <Users className="w-4 h-4 text-[#0058be]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#191c1d]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {topSource?.[0] ?? '—'}
                  </p>
                  <p className="text-xs text-[#565e72]">{topSource?.[1] ?? 0} candidates</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Recruitment Progress Chart ── */}
          <RecruitmentProgress progress={summaryData?.recruitment_progress} />
        </>
      )}
    </div>
  );
}
