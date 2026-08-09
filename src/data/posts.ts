/**
 * 文章数据 - 统一管理所有文章元信息
 * - getAllPosts(): 返回全部文章（按日期倒序）
 * - formatDate(date: string): 格式化 YYYY-MM-DD 为中文日期显示
 * - getPostsByTag(tag): 按标签过滤
 * - getPostsByCategory(cat): 按分类过滤
 */

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // YYYY-MM-DD
  tags: string[];
  category: string;
}

// 默认文章数据已清空，统一从后端 API（/api/article/list）动态加载
export const allPosts: Post[] = [];

/** 返回全部文章（按日期倒序） */
export function getAllPosts(): Post[] {
  return [...allPosts].sort((a, b) => b.date.localeCompare(a.date));
}

/** 格式化 YYYY-MM-DD 为 "YYYY年MM月DD日" 或 "MM.DD" */
export function formatDate(date: string, style: 'full' | 'short' = 'full'): string {
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return date;
  if (style === 'short') return `${m}.${d}`;
  return `${y}年${m}月${d}日`;
}

/** 按标签过滤文章 */
export function getPostsByTag(tag: string): Post[] {
  const lower = tag.toLowerCase();
  return getAllPosts().filter((p) =>
    p.tags.some((t) => t.toLowerCase() === lower) || p.category.toLowerCase() === lower
  );
}

/** 按分类过滤文章 */
export function getPostsByCategory(cat: string): Post[] {
  if (cat === '全部') return getAllPosts();
  return getAllPosts().filter((p) => p.category === cat);
}

/** 获取所有分类及其文章数 */
export function getAllCategories(): { name: string; count: number }[] {
  const posts = getAllPosts();
  const map = new Map<string, number>();
  posts.forEach((p) => {
    map.set(p.category, (map.get(p.category) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}

/** 获取所有标签及其文章数 */
export function getAllTags(): { name: string; count: number }[] {
  const posts = getAllPosts();
  const map = new Map<string, number>();
  posts.forEach((p) => {
    p.tags.forEach((t) => {
      map.set(t, (map.get(t) || 0) + 1);
    });
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** 按年月分组归档 */
export function getArchiveByMonth(): { year: string; month: string; posts: Post[] }[] {
  const posts = getAllPosts();
  const map = new Map<string, Post[]>();
  posts.forEach((p) => {
    const [y, m] = p.date.split('-');
    const key = `${y}-${m}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, posts]) => {
      const [year, month] = key.split('-');
      return { year, month, posts };
    });
}

/** 本地搜索（API未就绪时降级使用） */
export function searchPosts(keyword: string): Post[] {
  if (!keyword) return [];
  const kw = keyword.toLowerCase().trim();
  return getAllPosts().filter(
    (p) =>
      p.title.toLowerCase().includes(kw) ||
      p.excerpt.toLowerCase().includes(kw) ||
      p.tags.some((t) => t.toLowerCase().includes(kw)) ||
      p.category.toLowerCase().includes(kw)
  );
}
