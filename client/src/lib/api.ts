export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues?: FieldIssue[];

  constructor(status: number, message: string, issues?: FieldIssue[]) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

type Options = Omit<RequestInit, 'body'> & { json?: unknown };

export async function api<T>(path: string, { json, headers, ...init }: Options = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText, data.issues);
  return data as T;
}

export function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** First field-level message if the server sent one, otherwise the general error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string | undefined {
  if (!err) return undefined;
  if (err instanceof ApiError) return err.issues?.[0]?.message ?? err.message;
  return fallback;
}
