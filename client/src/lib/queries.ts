import { useQueryClient } from '@tanstack/react-query';

/** Invalidates every cached query whose first key segment is in `roots`. */
export function useInvalidate() {
  const queryClient = useQueryClient();
  return (...roots: string[]) =>
    queryClient.invalidateQueries({ predicate: (q) => roots.includes(q.queryKey[0] as string) });
}
