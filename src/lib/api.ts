const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://giggifi.com";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  authToken?: string;
}

// Talks to the existing GiggFi Next.js backend (see the giggifi-website repo) —
// this app has no backend of its own, every screen goes through these routes.
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authToken, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error ?? "Request failed.");
  }

  return response.json() as Promise<T>;
}
