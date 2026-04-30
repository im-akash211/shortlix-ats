import { useQuery } from '@tanstack/react-query';
import { activity } from '../../lib/api';

export function useActivityLog({ page = 1, pageSize = 20, dateFrom, dateTo, actor, action, entityType }) {
  const params = { page, page_size: pageSize };
  if (dateFrom)    params.date_from   = dateFrom;
  if (dateTo)      params.date_to     = dateTo;
  if (actor)       params.actor       = actor;
  if (action)      params.action      = action;
  if (entityType)  params.entity_type = entityType;

  return useQuery({
    queryKey: ['activity-log', params],
    queryFn: () => activity.list(params),
    placeholderData: (prev) => prev,
  });
}
