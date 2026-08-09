/**
 * 业务 API 封装（基于 http 模块）
 */
import { http } from './http';
import { ENDPOINTS } from './api-config';

export const api = {
  // 文章
  getCarousels: () => http.get(ENDPOINTS.carousels),
  getArticles: (params?: any) => http.get(ENDPOINTS.articleList, params),
  getArticle: (id: string | number) => http.get(ENDPOINTS.articleDetail(id)),
  searchArticles: (keyword: string) => http.get(ENDPOINTS.articleSearch, { keyword }),
  getArchive: () => http.get(ENDPOINTS.articleArchive),
  likeArticle: (id: string | number) => http.post(ENDPOINTS.articleLike(id)),
  getCategoriesAll: () => http.get(ENDPOINTS.categoriesAll),
  // 标签
  getTags: () => http.get(ENDPOINTS.tagList),
  getTagArticles: (tag: string) => http.get(ENDPOINTS.tagArticles(tag)),
  // 分类
  getCategories: () => http.get(ENDPOINTS.categoryList),
  // 评论
  getComments: (postId: string | number) => http.get(ENDPOINTS.comments(postId)),
  addComment: (data: any) => http.post(ENDPOINTS.addComment, data),
  delComment: (id: string | number) => http.del(ENDPOINTS.deleteComment(id)),
  // 留言
  getMessages: () => http.get(ENDPOINTS.messageList),
  addMessage: (data: any) => http.post(ENDPOINTS.addMessage, data),
  // 用户
  login: (data: { username: string; password: string }) => http.post(ENDPOINTS.login, data),
  register: (data: any) => http.post(ENDPOINTS.register, data),
  sendCode: (email: string) => http.get(ENDPOINTS.sendCode, { email }),
  logout: () => http.post(ENDPOINTS.logout),
  getMe: () => http.get(ENDPOINTS.userMe),
  getProfile: () => http.get(ENDPOINTS.userProfile),
  updateProfile: (data: any) => http.put(ENDPOINTS.updateProfile, data),
  updatePwd: (data: any) => http.post(ENDPOINTS.updatePwd, data),
  myArticles: () => http.get(ENDPOINTS.myArticles),
  myComments: () => http.get(ENDPOINTS.myComments),
  myReplies: () => http.get(ENDPOINTS.myReplies),
  myLikes: () => http.get(ENDPOINTS.myLikes),
  // 配置
  getWebConfig: () => http.get(ENDPOINTS.webConfig),
  // 订阅
  subscribe: (email: string) => http.post(ENDPOINTS.subscribe, { email }),
  // 统计
  getStats: () => http.get(ENDPOINTS.stats),
  // 后台
  getAdminMenus: () => http.get(ENDPOINTS.adminMenus),
};
