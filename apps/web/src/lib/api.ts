import type { ApiResponse, AuthUser, AuthResult } from "@zhixue/shared";
let accessToken: string | null = null;
let user: AuthUser | null = null;
let refreshPromise: Promise<AuthUser | null> | null = null;
const events = new EventTarget();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("zhixue-session")
    : null;
channel?.addEventListener("message", (event) => {
  if (event.data === "signed-out") setSession(null, null);
});
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function currentUser() {
  return user;
}
export function subscribeSession(callback: () => void) {
  events.addEventListener("change", callback);
  return () => events.removeEventListener("change", callback);
}
function setSession(nextUser: AuthUser | null, token: string | null) {
  user = nextUser;
  accessToken = token;
  events.dispatchEvent(new Event("change"));
}
export function clearSession() {
  setSession(null, null);
  channel?.postMessage("signed-out");
}
async function raw<T>(
  path: string,
  method = "GET",
  body?: unknown,
  authorized = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        ...(body instanceof File
          ? { "X-File-Name": encodeURIComponent(body.name) }
          : {}),
        ...(body !== undefined
          ? {
              "Content-Type":
                body instanceof Blob ? body.type : "application/json",
            }
          : {}),
        ...(method !== "GET" ? { "X-Zhixue-Client": "web" } : {}),
        ...(authorized && accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
      ...(body !== undefined
        ? { body: body instanceof Blob ? body : JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new ApiError(0, "无法连接服务，请稍后再试。");
  }
  let result: ApiResponse<T>;
  try {
    result = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(response.status, "服务返回了无效内容，请稍后再试。");
  }
  if (!response.ok || result.code !== 0)
    throw new ApiError(
      response.status,
      result.message || "操作未完成，请稍后再试。",
    );
  return result.data;
}
export function refreshSession(): Promise<AuthUser | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = async () => {
    const result = await raw<AuthResult>("/api/auth/refresh", "POST");
    setSession(result.user, result.accessToken);
    return result.user;
  };
  const task = (async () =>
    navigator.locks
      ? await navigator.locks.request("zhixue-refresh", refresh)
      : await refresh())();
  const promise = task
    .catch((error) => {
      setSession(null, null);
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  refreshPromise = promise;
  return promise;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  try {
    return await raw<T>(path, method, body, true);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (await refreshSession()) return raw<T>(path, method, body, true);
    }
    throw error;
  }
}
export async function signIn(input: unknown) {
  const result = await raw<AuthResult>("/api/auth/login", "POST", input);
  setSession(result.user, result.accessToken);
  return result;
}
export async function signUp(input: unknown) {
  const result = await raw<AuthResult>("/api/auth/register", "POST", input);
  setSession(result.user, result.accessToken);
  return result;
}
export function recover(input: unknown) {
  return raw<{ recoveryCode: string }>("/api/auth/recover", "POST", input);
}
export async function signOut() {
  await raw("/api/auth/logout", "POST");
  clearSession();
}
export function setProfile(nextUser: AuthUser) {
  setSession(nextUser, accessToken);
}
