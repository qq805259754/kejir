/**
 * API 配置与端点定义
 *
 * baseURL 设为空字符串：所有请求走同源路径（/api/xxx），
 * 由 src/middleware.ts 统一代理转发到后端（PUBLIC_API_BASE）。
 * 这样开发环境无跨域问题，生产环境也由 Astro Node 服务器代理。
 */
export const API_CONFIG = {
  baseURL: '',
  timeout: 10000,
};

export const ENDPOINTS = {
  // 文章
  carousels: '/api/article/getCarousels',
  articleList: '/api/article/list',
  articleDetail: (id: string | number) => `/api/article/${id}`,
  articleSearch: '/api/article/search',
  articleArchive: '/api/article/archive',
  articleLike: (id: string | number) => `/api/article/${id}/like`,
  categoriesAll: '/api/article/categorie-all',
  // 标签
  tagList: '/api/tag/list',
  tagArticles: (tag: string) => `/api/tag/${tag}/articles`,
  // 分类
  categoryList: '/api/category/list',
  // 评论
  comments: (postId: string | number) => `/api/comment/list?articleId=${postId}`,
  addComment: '/api/comment',
  addCommentAlt: '/addComment',
  deleteComment: (id: string | number) => `/api/comment/${id}`,
  // 留言
  messageList: '/api/message/list',
  addMessage: '/api/message/add',
  // 用户
  login: '/auth/login',
  register: '/api/email/register',
  sendCode: '/api/sendEmailCode',
  logout: '/auth/logout',
  userMe: '/api/user/me',
  userProfile: '/sys/user/profile',
  updateProfile: '/sys/user/profile',
  updateUser: '/api/user/me',
  updatePwd: '/sys/user/updatePwd',
  myArticles: '/protal/user/myArticle',
  myComments: '/protal/user/myComment',
  myReplies: '/protal/user/myReply',
  myLikes: '/protal/user/myCollect',
  delMyComment: (id: string | number) => `/protal/user/delMyComment/${id}`,
  delMyArticle: (id: string | number) => `/sys/article/delete/${id}`,
  // 配置
  webConfig: '/api/webConfig',
  // 订阅
  subscribe: '/api/subscribe',
  // 统计
  stats: '/api/stats',
  // 后台
  adminMenus: '/sys/menu/routers',
  adminArticleList: '/sys/article/list',
  adminArticleDetail: (id: string | number) => `/sys/article/${id}`,
  adminDelArticle: (id: string | number) => `/sys/article/${id}`,
  adminBatchDel: '/sys/article/batch-delete',
  adminCategories: '/sys/category/list',
  adminTags: '/sys/tag/list',
  adminDict: '/sys/dictData/getDiceData',
};
