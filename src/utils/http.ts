/**
 * 轻量 fetch 封装
 * - 自动拼接 baseURL
 * - 自动注入 Authorization token
 * - 统一处理响应 { code, data, message }
 */
import { API_CONFIG } from './api-config';

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

function getToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export async function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;
  let fullUrl = url.startsWith('http') ? url : API_CONFIG.baseURL + url;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString();
    if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
  }
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeout);
  try {
    // 仅在有 body 时设置 Content-Type: application/json，
    // 避免 POST 无 body（如 logout）时后端报 "Required request body is missing"
    const finalHeaders: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };
    if (rest.body) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    const res = await fetch(fullUrl, {
      ...rest,
      signal: controller.signal,
      headers: finalHeaders,
      // 解决 strict-origin-when-cross-origin：允许跨域携带完整 Referrer
      referrerPolicy: 'no-referrer-when-downgrade',
      credentials: 'include',
      mode: 'cors',
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 先读文本再解析，避免空 body 导致 res.json() 崩溃
    const text = await res.text();
    if (!text || text.trim() === '') return {} as T;
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return {} as T;
    }
    if (data && typeof data === 'object' && 'code' in data && data.code !== 200 && data.code !== 0) {
      throw new Error(data.message || 'Request failed');
    }
    return (data.data ?? data) as T;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export const http = {
  get: <T = any>(url: string, params?: Record<string, any>) =>
    request<T>(url, { method: 'GET', params }),
  post: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(url: string) => request<T>(url, { method: 'DELETE' }),
};
