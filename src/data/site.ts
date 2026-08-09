/**
 * 站点全局配置
 * 注意：name/author/logo/icp 等会被 /api/webConfig 接口返回的数据覆盖
 * 这里仅作为默认值（接口不可用时的兜底）
 * 所有配置项优先从环境变量读取，环境变量未设置时使用硬编码兜底
 */

const env = import.meta.env;

export const siteConfig = {
  title: env.PUBLIC_SITE_NAME || '科技热',
  description: env.PUBLIC_SITE_DESCRIPTION || '探索科技前沿，洞察产业变革',
  author: env.PUBLIC_SITE_AUTHOR || '科技热团队',
  keywords: (env.PUBLIC_SITE_KEYWORDS || '科技,人工智能,互联网,AI,编程,开发者,技术博客').split(',').map(k => k.trim()),
  language: 'zh-CN',
  themeColor: env.PUBLIC_SITE_THEME_COLOR || '#667eea',
  defaultAccent: 'violet',
  icp: env.PUBLIC_SITE_ICP || '',
  email: env.PUBLIC_SITE_EMAIL || '',
  social: {
    github: '',
    twitter: '',
    weibo: '',
  },
  // PC/PAD 左侧导航：首页/归档/留言/友链/关于 （竖排居中）
  navItems: [
    { href: '/', label: '首页', icon: 'home', description: '返回网站首页' },
    { href: '/archive', label: '归档', icon: 'archive', description: '按时间归档' },
    { href: '/message', label: '留言', icon: 'message', description: '留言板' },
    { href: '/links', label: '友链', icon: 'link', description: '友情链接' },
    { href: '/about', label: '关于', icon: 'info', description: '关于本站' },
  ],
  // 移动端底部导航：首页/归档/留言/友链/我的
  mobileNav: [
    { href: '/', label: '首页', icon: 'home' },
    { href: '/archive', label: '归档', icon: 'archive' },
    { href: '/message', label: '留言', icon: 'message' },
    { href: '/links', label: '友链', icon: 'link' },
    { href: '/about', label: '我的', icon: 'user' },
  ],
};

export const siteUrl = env.PUBLIC_SITE_URL || 'http://localhost:4321';