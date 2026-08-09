import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import node from '@astrojs/node';

// 重要：Astro 4 的 defineConfig 只接受「配置对象」，不支持函数形式（函数形式是 Astro 5 特性）。
//
// 构建命令 npm run build 使用 --mode production，确保加载 .env.production：
//   开发环境: astro dev                        -> .env.local      -> PUBLIC_API_BASE=http://localhost:8080/kj
//   生产环境: astro build --mode production     -> .env.production  -> PUBLIC_API_BASE=http://blog:8080/kj
//
// Vite 环境变量加载优先级（高 -> 低）：
//   .env.[mode].local > .env.[mode] > .env.local > .env
// 所以 mode=production 时 .env.production 会覆盖 .env.local 的值
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const env = loadEnv(mode, process.cwd(), '');

export default defineConfig({
  site: env.PUBLIC_SITE_URL || env.SITE_URL || 'http://localhost:4321',
  // 全站 SSR：动态路由（如 /blog/88）按需渲染，无需 getStaticPaths 预生成
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  build: {
    assets: 'assets',
    inlineStylesheets: 'auto',
  },
  server: {
    port: 4321,
    host: true,
  },
  // Astro 7 默认开启 checkOrigin，会拦截非 GET 请求（POST/PUT/DELETE/PATCH）。
  // 本项目所有 API 均通过 Nginx -> SSR -> 后端同源代理，浏览器 origin 为 https://kejir.com，
  // 而 SSR 容器内 url.origin 为 http://ssr:4321，导致 Astro 误判为跨站表单提交并返回 403。
  // 由于所有非 GET 请求均通过 fetch 发送，并使用后端 Authorization token 鉴权，关闭该检查是安全的。
  security: {
    checkOrigin: false,
  },
  vite: {
    ssr: {
      noExternal: ['gsap'],
    },
  },
});
