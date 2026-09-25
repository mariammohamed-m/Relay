import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchRelayData } from '@/lib/validate';

const DATA_URL = '/relay-data.json';

/**
 * The dashboard's only network call. Polls every 2s so `relay compile
 * --watch` feels live during a demo, and keeps the previous successful
 * payload on screen while a refetch is in flight (stale-while-revalidate)
 * so polling never flashes or reflows the UI.
 */
export function useRelayData() {
  return useQuery({
    queryKey: ['relay-data'],
    queryFn: () => fetchRelayData(DATA_URL),
    refetchInterval: 2000,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
