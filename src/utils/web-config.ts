/**
 * 站点动态配置加载
 * - 启动时调用 loadWebConfig() 拉取后端 webConfig
 * - 失败时静默降级到默认配置
 * - 通过 document 事件 'webconfig:updated' 通知组件
 */
import type { api as ApiT } from './api';

export interface WebConfig {
  id: number;
  logo: string;
  name: string;
  summary: string;
  recordNum: string;
  webUrl: string;
  author: string;
  authorInfo: string;
  authorAvatar: string;
  github?: string;
  gitee?: string;
  qqNumber?: string;
  email?: string;
  wechat?: string;
  showList?: string;
  loginTypeList?: string;
  openComment: number;
  openAdmiration: number;
  bulletin?: string;
  aboutMe?: string;
  visitorCount?: number;
  blogViewsCount?: number;
}

let cachedConfig: WebConfig | null = null;
let configPromise: Promise<WebConfig> | null = null;

export async function loadWebConfig(): Promise<WebConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;
  configPromise = (async () => {
    try {
      // 动态导入避免 SSR 构建时报错
      const { api } = await import('./api');
      const data = await api.getWebConfig();
      cachedConfig = data as WebConfig;
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('webconfig:updated', { detail: data }));
      }
      return data as WebConfig;
    } catch (e) {
      // API 未就绪时使用默认配置
      const fallback: WebConfig = {
        id: 0,
        logo: '',
        name: '科技热',
        summary: '探索前沿科技，分享技术热情',
        recordNum: '',
        webUrl: '',
        author: '科技热团队',
        authorInfo: '',
        authorAvatar: '',
        openComment: 1,
        openAdmiration: 0,
      };
      cachedConfig = fallback;
      return fallback;
    } finally {
      configPromise = null;
    }
  })();
  return configPromise;
}

export function getCachedConfig(): WebConfig | null {
  return cachedConfig;
}

if (typeof window !== 'undefined') {
  (window as any).loadWebConfig = loadWebConfig;
}
