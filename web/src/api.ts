const tokenKey = "qcfa_admin_jwt";

export function getToken(): string | null {
  return localStorage.getItem(tokenKey);
}

export function setToken(t: string | null): void {
  if (t) localStorage.setItem(tokenKey, t);
  else localStorage.removeItem(tokenKey);
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (opts.token !== false && getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
