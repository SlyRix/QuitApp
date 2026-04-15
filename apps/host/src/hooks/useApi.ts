import { useAuthStore } from "../store/authStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export function useApi() {
  const token = useAuthStore((s) => s.token);

  async function request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json() as { success: boolean; data?: T; error?: string };

    if (!response.ok || !data.success) {
      throw new Error((data as { error?: string }).error ?? `Request failed: ${response.status}`);
    }

    return data.data as T;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}
