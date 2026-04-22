import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '../services/jobsApi';

export function useJobs({ activeTab, statusFilter, search, filters, dateFrom, dateTo, ordering }) {
  const jobsQueryKey = [
    'jobs', 'list',
    { tab: activeTab, status: statusFilter, search, dept: filters.department, hm: filters.hiring_manager, loc: filters.location, dateFrom, dateTo, ordering },
  ];
  const { data: jobsQueryData, isLoading: loading } = useQuery({
    queryKey: jobsQueryKey,
    queryFn: () => {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (activeTab === 'My Jobs') params.tab = 'mine';
      if (search)                              params.search         = search;
      if (filters.department.length > 0)       params.department     = filters.department.join(',');
      if (filters.hiring_manager.length > 0)   params.hiring_manager = filters.hiring_manager.join(',');
      if (filters.location.length > 0)         params.location       = filters.location.join(',');
      if (dateFrom)                            params.date_from      = dateFrom;
      if (dateTo)                              params.date_to        = dateTo;
      params.ordering = ordering || '-created_at';
      return jobsApi.list(params);
    },
    placeholderData: (previousData) => previousData,
  });

  const jobsList = jobsQueryData ? (jobsQueryData.results || jobsQueryData) : [];
  const total    = jobsQueryData?.count ?? jobsList.length;

  return { jobsList, total, loading };
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ['jobs', 'filterOptions'],
    queryFn: () => jobsApi.list({ page_size: 100 }),
    staleTime: Infinity,
    select: (res) => {
      const all = res.results || res;
      const deptMap = {}, hmMap = {};
      const locSet = new Set();
      all.forEach((j) => {
        if (j.department && j.department_name) deptMap[j.department] = j.department_name;
        if (j.hiring_manager && j.hiring_manager_name) hmMap[j.hiring_manager] = j.hiring_manager_name;
        if (j.location) locSet.add(j.location);
      });
      return {
        departments:    Object.entries(deptMap).map(([id, label]) => ({ id, label })),
        hiringManagers: Object.entries(hmMap).map(([id, label]) => ({ id, label })),
        locations:      [...locSet].map((l) => ({ id: l, label: l })),
      };
    },
  });
}
