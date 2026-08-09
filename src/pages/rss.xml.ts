/**
 * RSS 订阅源
 * 手写 XML 避免依赖 @astrojs/rss
 */
import { getAllPosts } from '../data/posts';
import { siteConfig, siteUrl } from '../data/site';

export async function GET({ site }: { site?: URL }) {
  const posts = getAllPosts();
  const base = (site?.toString() || siteUrl).replace(/\/$/, '');
  const items = posts
    .map(
      (p) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${base}/article/${p.slug}</link>
      <description><![CDATA[${p.excerpt}]]></description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <category>${p.category}</category>
    </item>`
    )
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title><![CDATA[${siteConfig.title}]]></title>
  <link>${base}</link>
  <description><![CDATA[${siteConfig.description}]]></description>
  <language>${siteConfig.language}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${items}
</channel>
</rss>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
