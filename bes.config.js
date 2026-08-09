/**
 * ==========================================================================
 * 科技热 (Tech Heat) - BES (ByteDance Enterprise Server) 部署配置
 * 适用于字节跳动内部 BES 平台 / 火山引擎静态网站托管
 * ==========================================================================
 *
 * 使用方法：
 * 1. 在 BES 平台创建静态站点应用
 * 2. 构建命令：npm run build
 * 3. 输出目录：dist/
 * 4. 将此配置文件放在项目根目录
 */

export default {
  // 应用基本信息
  app: {
    name: 'tech-heat-blog',
    title: '科技热',
    description: '探索科技前沿，解读行业热点',
    version: '1.0.0',
    framework: 'astro',
    frameworkVersion: '4.x',
  },

  // 构建配置
  build: {
    command: 'npm run build',
    outputDir: 'dist',
    installCommand: 'npm install',
    nodeVersion: '18',
    environment: {
      NODE_ENV: 'production',
    },
  },

  // 路由配置（静态站点 SPA-like 回退）
  routes: [
    // 静态资源直接返回
    {
      match: '/assets/*',
      strategy: 'static',
      cache: {
        maxAge: 31536000, // 1年（带hash的资源永久缓存）
        immutable: true,
      },
    },
    {
      match: '/*.js',
      strategy: 'static',
      cache: { maxAge: 31536000, immutable: true },
    },
    {
      match: '/*.css',
      strategy: 'static',
      cache: { maxAge: 31536000, immutable: true },
    },
    {
      match: '/*.woff2',
      strategy: 'static',
      cache: { maxAge: 31536000, immutable: true },
    },
    {
      match: '/*.svg',
      strategy: 'static',
      cache: { maxAge: 2592000 }, // 30天
    },
    {
      match: '/*.png',
      strategy: 'static',
      cache: { maxAge: 2592000 },
    },
    {
      match: '/*.jpg',
      strategy: 'static',
      cache: { maxAge: 2592000 },
    },
    {
      match: '/*.ico',
      strategy: 'static',
      cache: { maxAge: 604800 }, // 7天
    },
    // HTML页面 - 不缓存
    {
      match: '/',
      strategy: 'static',
      file: '/index.html',
      cache: { maxAge: 0 },
    },
    {
      match: '/blog',
      strategy: 'static',
      file: '/blog/index.html',
      cache: { maxAge: 0 },
    },
    {
      match: '/blog/*',
      strategy: 'static',
      file: '/blog/[slug]/index.html',
      cache: { maxAge: 300 }, // 5分钟
    },
    {
      match: '/about',
      strategy: 'static',
      file: '/about/index.html',
      cache: { maxAge: 0 },
    },
    {
      match: '/categories',
      strategy: 'static',
      file: '/categories/index.html',
      cache: { maxAge: 0 },
    },
    {
      match: '/tags/*',
      strategy: 'static',
      file: '/tags/[tag]/index.html',
      cache: { maxAge: 300 },
    },
    // 404 回退
    {
      match: '/*',
      strategy: 'spa',
      file: '/index.html',
      statusCode: 200,
    },
  ],

  // 自定义响应头
  headers: [
    {
      match: '/*',
      headers: {
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      },
    },
    {
      match: '/assets/*',
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
    {
      match: '/*.html',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  ],

  // 重定向规则
  redirects: [
    {
      from: '/post/:slug',
      to: '/blog/:slug',
      statusCode: 301,
    },
    {
      from: '/category/:tag',
      to: '/tags/:tag',
      statusCode: 301,
    },
  ],

  // 环境变量（在 BES 平台配置面板中也可覆盖）
  envVars: {
    PUBLIC_SITE_URL: 'https://keji.re',
    PUBLIC_SITE_NAME: '科技热',
    PUBLIC_SITE_DESCRIPTION: '探索科技前沿，解读行业热点',
    PUBLIC_BUILD_ENV: 'production',
  },

  // 自定义域名
  domains: ['keji.re', 'www.keji.re'],

  // HTTPS 配置
  https: {
    enabled: true,
    forceRedirect: true,
    hsts: {
      enabled: true,
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
  },

  // 压缩配置
  compression: {
    gzip: true,
    brotli: true,
  },
};
