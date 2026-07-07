import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client. Generation is async and polled (SPEC §6), so we
 * keep retries conservative and let individual queries own their poll interval.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  },
});
