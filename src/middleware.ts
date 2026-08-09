/**
 * Astro 中间件 — API 请求代理
 *
 * 在路由匹配之前拦截所有后端 API 请求，转发到后端服务器。
 * 后端地址通过环境变量 PUBLIC_API_BASE 配置：
 *   开发环境: .env / .env.local  -> PUBLIC_API_BASE=http://localhost:8080/kj
 *   生产环境: .env.production    -> PUBLIC_API_BASE=http://kejir.com/kj
 *
 * 优势（相比 src/pages/api/[...path].ts）：
 *   - 不需要 getStaticPaths，避免 GetStaticPathsRequired 错误
 *   - 在路由匹配之前执行，不会与 Astro 页面路由冲突
 *   - 统一处理所有后端路径前缀（/api、/addComment、/auth、/protal、/sys）
 */
import { defineMiddleware } from 'astro:middleware';

// 需要代理的后端路径前缀
// /file/ 用于文章封面/正文图片上传（后端 POST /file/upload 返回图片 URL）
// /monitor/ 用于监控中心模块（服务器/缓存/在线用户/定时任务）
// /tool/ 用于系统工具模块（代码生成）
const PROXY_PREFIXES = ['/api/', '/addComment', '/auth/', '/protal/', '/sys/', '/file/', '/monitor/', '/tool/'];

// 后端地址（从环境变量读取，去除末尾斜杠）
const API_BASE = (import.meta.env.PUBLIC_API_BASE || '').replace(/\/+$/, '');

// 未配置 API_BASE 时，开发环境给出警告但不阻止
// 生产构建时若未配置 API_BASE，代理请求将返回 502
if (!API_BASE && import.meta.env.DEV) {
  console.warn('[middleware] PUBLIC_API_BASE 未配置，后端 API 代理将不可用。请在 .env 文件中设置 PUBLIC_API_BASE。');
}

/**
 * 判断请求路径是否需要代理到后端
 */
function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some(function (prefix) {
    // /addComment 是精确匹配前缀（可能带 query string），其余是 startsWith
    if (prefix === '/addComment') {
      return pathname === '/addComment' || pathname.startsWith('/addComment/');
    }
    return pathname.startsWith(prefix);
  });
}

/**
 * 重写 Set-Cookie 头中的 Path 和 Domain，使 cookie 在代理域名下生效
 * 后端可能设置 Path=/kj，需要改写为 Path=/
 */
function rewriteSetCookie(headers: Headers): void {
  const cookies = headers.getSetCookie?.() || [];
  if (cookies.length === 0) return;

  headers.delete('Set-Cookie');
  cookies.forEach(function (rawCookie) {
    // 重写 Path=/kj -> Path=/ ，移除 Domain 属性
    const rewritten = rawCookie
      .replace(/[Pp]ath=\/[^;,]*/g, 'Path=/')
      .replace(/[Dd]omain=[^;,]*/g, '')
      .replace(/;\s*;/g, ';')
      .replace(/;\s*$/g, '');
    headers.append('Set-Cookie', rewritten);
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  // 非 API 请求，交给后续路由处理
  if (!shouldProxy(pathname)) {
    return next();
  }

  // 直接响应 OPTIONS 预检请求，避免转发到后端产生 403/405
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization',
        'Access-Control-Max-Age': '1728000',
      },
    });
  }

  // 未配置 API_BASE 时返回 502
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ code: 502, message: '后端服务未配置，请联系管理员', data: null }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 拼接后端完整 URL
  const targetUrl = API_BASE + pathname + search;

  // 构建转发请求头
  const forwardHeaders = new Headers();
  // 转发必要的请求头
  // origin 也要转发：后端若做跨域/日志记录时可依赖该头
  const headersToForward = [
    'content-type', 'authorization', 'cookie', 'accept', 'accept-language',
    'user-agent', 'referer', 'origin',
  ];
  headersToForward.forEach(function (key) {
    const val = context.request.headers.get(key);
    if (val) forwardHeaders.set(key, val);
  });

  // 构建转发请求。
  // 直接复用原请求的 body ReadableStream，避免在 SSR 容器内把请求体完整读入内存后再转发，
  // 彻底解决 Node.js 22 下 arrayBuffer/buffer 二次包装导致的 body 丢失问题。
  const fetchOptions: RequestInit = {
    method: context.request.method,
    headers: forwardHeaders,
    redirect: 'manual',
  };

  // Node.js fetch 在请求可能携带 body 时必须声明 duplex: 'half'
  // GET/HEAD 请求无 body，其余方法直接传递原 body 流（无 body 时为 null）
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    (fetchOptions as any).duplex = 'half';
    fetchOptions.body = context.request.body;
  }

  try {
    const backendResponse = await fetch(targetUrl, fetchOptions);

    // 构建响应头（过滤掉 hop-by-hop 头）
    const responseHeaders = new Headers();
    backendResponse.headers.forEach(function (value, key) {
    const lower = key.toLowerCase();
      if (['transfer-encoding', 'content-encoding', 'content-length', 'connection', 'keep-alive'].includes(lower)) {
        return; // 跳过 hop-by-hop 头
      }
      responseHeaders.set(key, value);
    });

    // 重写 Set-Cookie 的 Path/Domain
    rewriteSetCookie(responseHeaders);
    responseHeaders.set('X-MW-Version', 'stream-duplex');

    // 缓冲响应体，避免流式传输时抛出未捕获异常
    const buf = await backendResponse.text();

    // 后端返回空响应体时，返回有意义的 JSON 错误（如 418 拦截）
    if (!buf || buf.trim() === '') {
      return new Response(
        JSON.stringify({ code: backendResponse.status, message: '后端返回空响应（可能被安全策略拦截）', data: null }),
        { status: backendResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(buf, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[middleware] 后端代理失败:', targetUrl, err);
    // 不向客户端泄露后端地址与堆栈，仅返回通用错误
    return new Response(
      JSON.stringify({ code: 502, message: '后端服务不可用，请稍后重试', data: null }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});