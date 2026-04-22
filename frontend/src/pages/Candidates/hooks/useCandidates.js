import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { candidatesApi, jobsApi } from '../services/candidatesApi';

export function useCandidates() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-backed list state
  const search = searchParams.get('search') || '';
  const setSearch = (val) => setSearchParams(p => { if (val) p.set('search', val); else p.delete('search'); return p; }, { replace: true });

  // URL-backed filters — join arrays to stable string primitives for useCallback deps.
  const urlSources  = searchParams.getAll('source');
  const urlStages   = searchParams.getAll('stage');
  const urlJob      = searchParams.get('job') || '';
  const sourcesKey  = urlSources.join(',');
  const stagesKey   = urlStages.join(',');

  // URL-backed exp/date filters
  const expMin   = searchParams.get('exp_min')   || '';
  const expMax   = searchParams.get('exp_max')   || '';
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo   = searchParams.get('date_to')   || '';
  const setExpFilter = (key, val) => setSearchParams(p => { if (val) p.set(key, val); else p.delete(key); return p; }, { replace: true });

  // URL-backed sort
  const sortKey = searchParams.get('sort') || '-created_at';
  const setSort = (field) => {
    const next = sortKey === field ? `-${field}` : field;
    setSearchParams(p => { p.set('sort', next); return p; }, { replace: true });
  };

  const activeFilterCount =
    urlSources.length +
    urlStages.length +
    (urlJob ? 1 : 0) +
    (expMin ? 1 : 0) + (expMax ? 1 : 0) +
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const candidatesQueryKey = ['candidates', 'list', { search, sources: sourcesKey, stages: stagesKey, job: urlJob, exp_min: expMin, exp_max: expMax, date_from: dateFrom, date_to: dateTo, sort: sortKey }];
  const { data: candidatesQueryData, isLoading: loading } = useQuery({
    queryKey: candidatesQueryKey,
    queryFn: () => {
      const params = { page_size: 500 };
      if (search)     params.search    = search;
      if (sourcesKey) params.source    = sourcesKey;
      if (stagesKey)  params.stage     = stagesKey;
      if (urlJob)     params.job       = urlJob;
      if (expMin)     params.exp_min   = expMin;
      if (expMax)     params.exp_max   = expMax;
      if (dateFrom)   params.date_from = dateFrom;
      if (dateTo)     params.date_to   = dateTo;
      if (sortKey)    params.ordering  = sortKey;
      return candidatesApi.list(params);
    },
    placeholderData: (previousData) => previousData,
  });

  const candidates = candidatesQueryData ? (candidatesQueryData.results || candidatesQueryData) : [];
  const total = candidatesQueryData?.count ?? candidates.length;

  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: () => jobsApi.list({ page_size: 200 }),
    staleTime: Infinity,
    select: (res) => res.results || res,
  });

  const toggleArrayFilter = (key, value) => {
    setSearchParams(prev => {
      const current = prev.getAll(key);
      prev.delete(key);
      if (current.includes(value)) {
        current.filter(v => v !== value).forEach(v => prev.append(key, v));
      } else {
        [...current, value].forEach(v => prev.append(key, v));
      }
      return prev;
    }, { replace: true });
  };

  const clearAllFilters = () => {
    setSearchParams(prev => {
      ['source', 'stage', 'job', 'exp_min', 'exp_max', 'date_from', 'date_to'].forEach(k => prev.delete(k));
      return prev;
    }, { replace: true });
  };

  return {
    candidates,
    total,
    loading,
    allJobs,
    // filter state
    search,
    urlSources,
    urlStages,
    urlJob,
    sourcesKey,
    stagesKey,
    expMin,
    expMax,
    dateFrom,
    dateTo,
    sortKey,
    activeFilterCount,
    // setters
    setSearch,
    setSearchParams,
    setExpFilter,
    setSort,
    toggleArrayFilter,
    clearAllFilters,
  };
}
