// Blog: posts, comments and uploaded pictures live in the D1 database (binding "DB"), so publishing is instant (no redeploy).
// Pages are rendered by functions/blog/[[path]].js inside the site's normal header/footer (dist/blog-shell.html, made by build.js).
import { db, esc } from './util.js';
import settings from '../content/settings.json';

let ready = false;
export async function bdb(env) {
  const DB = await db(env);
  if (!ready) {
    await DB.batch([
      DB.prepare(`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT, cat TEXT, tags TEXT,
        cover TEXT, cover_alt TEXT, blocks TEXT, status TEXT NOT NULL DEFAULT 'draft', publish_at TEXT, featured INTEGER DEFAULT 0, comments_on INTEGER DEFAULT 1,
        show_home INTEGER DEFAULT 0, nl_send INTEGER DEFAULT 0, nl_audience TEXT, nl_brand TEXT, nl_sent_at TEXT, seo_title TEXT, seo_desc TEXT,
        views INTEGER DEFAULT 0, amens INTEGER DEFAULT 0, author TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS post_comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, name TEXT, email TEXT, text TEXT, approved INTEGER DEFAULT 0, created_at TEXT NOT NULL)`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, type TEXT, size INTEGER, w INTEGER, h INTEGER, data BLOB NOT NULL, by_user TEXT, created_at TEXT NOT NULL)`),
    ]);
    ready = true;
  }
  return DB;
}

export const BLOG = Object.assign({ script: 'The Blog', title: 'Faith, beauty & becoming', intro: 'Devotionals, prayers, bridal tips and stories from the chair.',
  categories: ['Devotional', 'Prayer', 'Beauty', 'Bridal', "Women's Empowerment", 'Books & Events'], perPage: 9,
  authorName: '', authorBio: '', authorPhoto: '' }, settings.blog || {});
const list = (v) => (Array.isArray(v) ? v : []).map((x) => (x && typeof x === 'object' && 'value' in x ? x.value : x)).filter(Boolean);
export const CATS = list(BLOG.categories).length ? list(BLOG.categories) : ['Devotional', 'Prayer', 'Beauty', 'Bridal', "Women's Empowerment", 'Books & Events'];
export const AUTHOR = BLOG.authorName || ((settings.logoTop ? settings.logoTop + ' ' : '') + (settings.name || ''));

export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const parse = (s, d) => { try { return JSON.parse(s || ''); } catch (e) { return d; } };
export function rowToPost(r) {
  if (!r) return null;
  return { id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt || '', cat: r.cat || '', tags: parse(r.tags, []), cover: r.cover || '', coverAlt: r.cover_alt || '',
    blocks: parse(r.blocks, []), status: r.status, publishAt: r.publish_at || '', featured: !!r.featured, comments: !!r.comments_on, home: !!r.show_home,
    nlSend: !!r.nl_send, nlAudience: r.nl_audience || 'All', nlBrand: r.nl_brand || 'ministry', nlSentAt: r.nl_sent_at || '', seoTitle: r.seo_title || '', seoDesc: r.seo_desc || '',
    views: r.views || 0, amens: r.amens || 0, author: r.author || '', created: r.created_at, updated: r.updated_at };
}
export const isLive = (p, now) => p.status === 'pub' && p.publishAt && new Date(p.publishAt).getTime() <= (now || Date.now());
export const LIVE_SQL = "status = 'pub' AND publish_at IS NOT NULL AND publish_at <= ?";

export function readMinutes(p) {
  const words = [p.excerpt].concat((p.blocks || []).map((b) => [b.text, b.caption, b.cite].filter(Boolean).join(' '))).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' }) : '';

/* ---------- content blocks -> web HTML (blog posts) ---------- */
const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
  .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (m, a, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${a}</a>`)
  .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
const safeUrl = (u) => (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(String(u || '').trim()) ? String(u).trim() : '');
const img = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async">`;
// text size chosen with A− / A+ in the block editor (b.fs, e.g. 1.3)
const F = (b, html) => { const v = Number(b && b.fs); return html && v >= 0.5 && v <= 2.5 && v !== 1 ? `<span style="font-size:${v}em">${html}</span>` : html; };
export function blocksHtml(blocks) {
  return (blocks || []).map((b) => {
    switch (b.type) {
      case 'heading': return b.text ? `<h2 class="bp-h">${F(b, esc(b.text))}</h2>` : '';
      case 'text': return b.text ? String(b.text).trim().split(/\n\s*\n/).map((p) => `<p>${F(b, inline(p).replace(/\n/g, '<br>'))}</p>`).join('') : '';
      case 'image': {
        if (!safeUrl(b.src)) return '';
        const cls = b.wrap === 'left' || b.wrap === 'right' ? 'fl-' + b.wrap : 'w-' + (['small', 'medium'].includes(b.size) ? b.size : 'full');
        let im = img(b.src, b.alt); const link = safeUrl(b.url); if (b.link && link) im = `<a href="${esc(link)}">${im}</a>`;
        return `<figure class="bp-fig ${cls}">${im}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
      }
      case 'pair': {
        const a = safeUrl(b.a), c = safeUrl(b.b); if (!a && !c) return '';
        return `<figure class="bp-fig w-full"><div class="bp-pair">${a ? img(a, b.altA) : '<span></span>'}${c ? img(c, b.altB) : '<span></span>'}</div>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
      }
      case 'quote': return b.text ? `<blockquote class="bp-q"><p>${F(b, esc(b.text))}</p>${b.cite ? `<cite>${esc(b.cite)}</cite>` : ''}</blockquote>` : '';
      case 'button': { const u = safeUrl(b.url); return u ? `<p class="bp-cta"><a class="btn" href="${esc(u)}">${F(b, esc(b.label || 'Learn more'))} <span class="arr">&rarr;</span></a></p>` : ''; }
      case 'divider': return '<hr class="bp-hr">';
      case 'video': { const u = safeUrl(b.url); return u ? `<p class="bp-cta"><a class="bp-video" href="${esc(u)}" target="_blank" rel="noopener"><span>&#9654;</span> ${F(b, esc(b.label || 'Watch the video'))}</a></p>` : ''; }
      default: return '';
    }
  }).join('') + '<div class="bp-clear"></div>';
}
