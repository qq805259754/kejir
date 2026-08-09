/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/**
 * Astro 环境类型声明
 * Environment type declarations for Astro
 */

interface ImportMetaEnv {
  /** 站点 URL */
  readonly PUBLIC_SITE_URL: string;
  /** 站点名称 */
  readonly PUBLIC_SITE_NAME: string;
  /** 站点描述 */
  readonly PUBLIC_SITE_DESCRIPTION: string;
  /** 站点作者 */
  readonly PUBLIC_SITE_AUTHOR: string;
  /** 站点关键词（逗号分隔） */
  readonly PUBLIC_SITE_KEYWORDS: string;
  /** 站点主题色 */
  readonly PUBLIC_SITE_THEME_COLOR: string;
  /** ICP 备案号 */
  readonly PUBLIC_SITE_ICP: string;
  /** 联系邮箱 */
  readonly PUBLIC_SITE_EMAIL: string;
  /** 站点 Logo URL */
  readonly PUBLIC_SITE_LOGO: string;
  /** 后端 API 基础地址 */
  readonly PUBLIC_API_BASE: string;
  /** Google Analytics ID */
  readonly PUBLIC_GOOGLE_ANALYTICS: string;
  /** 构建环境 (local | development | production) */
  readonly PUBLIC_BUILD_ENV: 'local' | 'development' | 'production';
  /** 默认分页大小 */
  readonly PUBLIC_DEFAULT_PAGE_SIZE: string;
  /** HarmonyOS Sans 常规体 CDN 地址 */
  readonly PUBLIC_HARMONYOS_REGULAR_URL: string;
  /** HarmonyOS Sans 粗体 CDN 地址 */
  readonly PUBLIC_HARMONYOS_BOLD_URL: string;
  /** GSAP 动画库 CDN 地址 */
  readonly PUBLIC_GSAP_URL: string;
  /** DiceBear 头像生成服务基础地址 */
  readonly PUBLIC_DICE_BEAR_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** 声明 SVG 模块类型 */
declare module '*.svg' {
  const content: string;
  export default content;
}

/** 声明 GSAP 模块（确保类型可识别） */
declare module 'gsap' {
  export * from 'gsap/types/index.d';
}

/** 声明全局 window 上的自定义属性 */
interface Window {
  /** GSAP 可能挂载的全局对象 */
  gsap?: typeof import('gsap').gsap;
  /** API 基础地址 */
  __API_BASE__: string;
  /** 默认 Logo */
  __DEFAULT_LOGO__: string;
  /** 默认分页大小 */
  __DEFAULT_PAGE_SIZE__: number;
  /** DiceBear 头像基础 URL */
  __DICE_BEAR_BASE__: string;
  /** 本地确定性头像生成器（seed -> data:URL SVG） */
  __genAvatar: (seed: string) => string;
  /** API 工具集 */
  __api: Record<string, (...args: any[]) => Promise<any>>;
}