import { getApiBase } from "./api-base.ts";

export class AuthenticatedApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AuthenticatedApiError";
    this.status = status;
  }
}

type AuthenticatedJsonRequestOptions = {
  getToken: () => Promise<string | null>;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function joinApiUrl(apiBase: string, path: string) {
  const normalizedBase = apiBase.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === "string" && payload.error.trim()
    ? payload.error.trim()
    : `Request failed (${response.status})`;
}

function createRequestSignal(signal?: AbortSignal, timeoutMs?: number) {
  if (signal || !timeoutMs) {
    return { signal, cleanup: () => {} };
  }

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => {} };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId) };
}

export async function authenticatedFetch({
  getToken,
  path,
  method = "GET",
  body,
  apiBase = getApiBase(),
  fetchImpl = fetch,
  headers: inputHeaders,
  signal,
  timeoutMs,
}: AuthenticatedJsonRequestOptions): Promise<Response> {
  if (!apiBase) {
    throw new AuthenticatedApiError(
      "The app is not connected to the API. Check the API base URL and try again.",
    );
  }

  const token = await getToken();
  if (!token) {
    throw new AuthenticatedApiError("Please sign in again to continue.", 401);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...inputHeaders,
  };
  const requestBody = body === undefined ? undefined : JSON.stringify(body);
  if (requestBody !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const requestSignal = createRequestSignal(signal, timeoutMs);
  try {
    return await fetchImpl(joinApiUrl(apiBase, path), {
      method,
      headers,
      body: requestBody,
      signal: requestSignal.signal,
    });
  } finally {
    requestSignal.cleanup();
  }
}

export async function authenticatedJsonRequest<TResponse>(
  options: AuthenticatedJsonRequestOptions,
): Promise<TResponse> {
  const response = await authenticatedFetch(options);

  if (!response.ok) {
    throw new AuthenticatedApiError(await readErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
