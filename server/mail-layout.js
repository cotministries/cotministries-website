// Email layout for personal emails (replies from Messages) – same look as Niki's newsletter:
// blush background, cream card with a gold frame, Niki's signature on top, soft footer with the brand's website.
import settings from '../content/settings.json';
import { esc } from './util.js';

const C = { ink: '#14254a', muted: '#5a6680', ruby: '#0F2A5E', blush: '#f5efe2', gold: '#c9a23a', line: '#e6dcc4', paper: '#faf5f0' };
const SITE = { beauty: 'https://cotministries.com', ministry: 'https://cotministries.com', main: 'https://cotministries.com' };
const abs = (u, origin) => { u = String(u || '').trim(); if (/^https?:\/\//i.test(u)) return u; return u.startsWith('/') ? origin + u : ''; };
// plain text → paragraphs; links clickable; **bold**
export const textToHtml = (t) => String(t || '').trim().split(/\n\s*\n/).map((p) => `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:${C.ink}">${esc(p)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(>])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (m, a, u) => `${a}<a href="${u}" style="color:${C.ruby};font-weight:bold">${u}</a>`)
  .replace(/\n/g, '<br>')}</p>`).join('');

export function mailHtml({ subject, body, quoted, origin, brand, preheader }) {
  const b = brand || {};
  const site = SITE[b.id] || origin;
  const sig = abs(settings.signature, origin);
  const name = b.name || settings.name || 'City Of Testimonies';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:${C.blush};padding:24px 10px">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.paper};border:2px solid ${C.gold}">
<tr><td align="center" style="padding:26px 32px 4px">${sig ? `<img src="${esc(sig)}" alt="${esc(name)}" width="230" style="display:block;width:230px;max-width:70%;height:auto;border:0">` : `<span style="font-family:Georgia,serif;font-weight:bold;font-size:30px;color:${C.ruby}">${esc(name)}</span>`}
${settings.tagline ? `<div style="font-family:Georgia,serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};padding-top:8px">${esc(String(settings.tagline).replace(/\s+/g, ' '))}</div>` : ''}</td></tr>
<tr><td style="padding:14px 32px 0"><div style="height:1px;background:${C.line};font-size:0;line-height:0">&nbsp;</div></td></tr>
<tr><td style="padding:22px 32px 6px">${body}</td></tr>
${quoted ? `<tr><td style="padding:0 32px 22px"><div style="border-left:3px solid ${C.gold};background:${C.blush};padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${C.muted}">${quoted}</div></td></tr>` : ''}
<tr><td align="center" style="padding:14px 32px 24px;border-top:1px solid ${C.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${C.muted}">
<span style="font-family:Georgia,serif;font-size:14px;color:${C.ink}">${esc(name)}</span><br>
<a href="${esc(site)}" style="color:${C.ruby};text-decoration:none">${esc(site.replace(/^https?:\/\//, ''))}</a><br>
You can simply reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
}
