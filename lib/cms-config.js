// Editor (Decap CMS) configuration, generated into dist/admin/config.yml by build.js.
// To add a new block type: add it here AND in lib/render.js (blocks).
const S = (label, name, extra) => Object.assign({ label, name, widget: 'string' }, extra);
const opt = { required: false };
const button = [S('Button text', 'label', opt), S('Link (e.g. /contact/ or https://...)', 'url', opt)];
const buttons = { label: 'Buttons', name: 'buttons', widget: 'list', required: false, summary: '{{fields.label}}', fields: button };
const bg = { label: 'Background', name: 'background', widget: 'select', options: ['light', 'white', 'dark'], default: 'light', required: false };
const heading = S('Heading', 'heading', opt);
const sub = S('Small title', 'subheading', opt);
const rich = (label, name, req) => ({ label, name, widget: 'markdown', buttons: ['bold', 'italic', 'link', 'bulleted-list'], editor_components: [], modes: ['rich_text'], required: !!req });
const image = (label, name, req) => ({ label, name, widget: 'image', required: !!req });
const block = (name, label, fields) => ({ name, label, widget: 'object', fields });

const blocks = [
  block('hero', 'Banner / Hero', [
    { label: 'Style', name: 'style', widget: 'select', default: 'image', options: [{ label: 'Full image (no cropping)', value: 'image' }, { label: 'Photo with text on top', value: 'overlay' }] },
    image('Image', 'image', true), S('Heading (text-on-photo style only)', 'heading', opt),
    { label: 'Text (text-on-photo style only)', name: 'text', widget: 'text', required: false }, buttons]),
  block('text', 'Text', [heading, sub, rich('Text', 'body'), { label: 'Alignment', name: 'align', widget: 'select', options: ['left', 'center'], default: 'left' }, bg, buttons]),
  block('imageText', 'Image + Text', [image('Image', 'image', true), { label: 'Image side', name: 'imageSide', widget: 'select', options: ['left', 'right'], default: 'left' }, heading, sub, rich('Text', 'body'), bg, buttons]),
  block('cards', 'Cards (2–3 columns)', [heading, sub, bg, { label: 'Cards', name: 'items', widget: 'list', summary: '{{fields.title}}', fields: [image('Image', 'image'), S('Title', 'title'), { label: 'Text', name: 'text', widget: 'text', required: false }, { label: 'Button', name: 'button', widget: 'object', required: false, collapsed: true, fields: button }] }]),
  block('pricing', 'Services & Prices', [heading, bg, { label: 'Services / products', name: 'items', widget: 'list', summary: '{{fields.name}} — {{fields.price}}', fields: [S('Name', 'name'), { label: 'Description', name: 'description', widget: 'text', required: false }, S('Duration (optional)', 'duration', opt), S('Price', 'price'), { label: 'Button (Book / Buy link)', name: 'button', widget: 'object', required: false, collapsed: true, fields: button }] }, { label: 'Note below list', name: 'note', widget: 'text', required: false }]),
  block('list', 'Checklist', [heading, bg, { label: 'Items', name: 'items', widget: 'list', summary: '{{fields.title}}', fields: [S('Title', 'title'), S('Extra text', 'text', opt)] }, buttons]),
  block('quote', 'Quote / Scripture', [{ label: 'Quote', name: 'quote', widget: 'text' }, S('Source', 'source', opt), bg]),
  block('testimonials', 'Testimonials / Reviews', [heading, sub, bg, { label: 'Testimonials', name: 'items', widget: 'list', summary: '{{fields.name}}', fields: [{ label: 'Quote', name: 'quote', widget: 'text' }, S('Name', 'name')] }]),
  block('faq', 'FAQ', [heading, bg, { label: 'Questions', name: 'items', widget: 'list', summary: '{{fields.question}}', fields: [S('Question', 'question'), rich('Answer', 'answer', true)] }]),
  block('gallery', 'Gallery', [heading, bg, { label: 'Images', name: 'images', widget: 'list', fields: [image('Image', 'image', true), S('Caption', 'caption', opt)] }]),
  block('image', 'Single image', [heading, image('Image', 'image', true), { label: 'Width', name: 'width', widget: 'select', options: ['narrow', 'full'], default: 'narrow' }, bg, buttons]),
  block('video', 'Video', [heading, S('YouTube / Vimeo / Facebook link', 'url', Object.assign({ hint: 'Paste the video link. Or leave empty and upload a video file below.' }, opt)), { label: 'Or upload a video file (MP4, keep it small)', name: 'file', widget: 'file', required: false }, S('Caption', 'caption', opt), bg]),
  block('downloads', 'Downloads (PDF, files)', [heading, rich('Text', 'text'), bg, { label: 'Files', name: 'files', widget: 'list', summary: '{{fields.label}}', fields: [S('Button text', 'label'), { label: 'File', name: 'file', widget: 'file' }] }]),
  block('embed', 'Embed (form, map, widget)', [heading, S('Embed link (e.g. Jotform or Google Maps embed URL)', 'url', opt), { label: 'Height in pixels', name: 'height', widget: 'number', default: 700, required: false }, { label: 'Or paste embed code (advanced)', name: 'code', widget: 'code', default_language: 'html', output_code_only: true, required: false }, { label: 'Width', name: 'width', widget: 'select', options: ['narrow', 'full'], default: 'narrow' }, bg]),
  block('cta', 'Call-to-action band', [heading, { label: 'Text', name: 'text', widget: 'text', required: false }, Object.assign({}, bg, { default: 'dark' }), buttons]),
  block('contact', 'Contact info + form', [heading, sub, { label: 'Show contact form', name: 'showForm', widget: 'boolean', default: true }, bg]),
];

module.exports = function cmsConfig({ demo }) {
  return {
    backend: demo ? { name: 'test-repo' } : { name: 'git-gateway', branch: 'main' },
    site_url: '/',
    display_url: '/',
    logo_url: '',
    media_folder: 'static/uploads',
    public_folder: '/uploads',
    collections: [
      {
        name: 'pages', label: 'Pages', label_singular: 'page',
        folder: 'content/pages', extension: 'json', format: 'json',
        create: true, delete: true, identifier_field: 'title', slug: '{{fields.slug}}',
        summary: '{{title}}  ·  /{{slug}}', sortable_fields: ['title'],
        fields: [
          S('Page title', 'title'),
          S('Web address', 'slug', { hint: 'Lowercase words with dashes, e.g. about-us → yoursite.com/about-us/. The home page must be "index". Add new pages to the menu in Site settings.', pattern: ['^[a-z0-9-]+$', 'Only lowercase letters, numbers and dashes'] }),
          S('Google description', 'description', opt),
          { label: 'Sections', name: 'sections', widget: 'list', label_singular: 'section', summary: '{{fields.heading}}', types: blocks, required: false },
        ],
      },
      {
        name: 'settings', label: 'Site settings',
        files: [{
          name: 'settings', label: 'Logo, colors, contact & menu', file: 'content/settings.json',
          fields: [
            S('Site name', 'name'), S('Tagline', 'tagline', opt), S('Google title (home page)', 'seoTitle', opt),
            { label: 'Google description', name: 'description', widget: 'text', required: false },
            image('Logo', 'logo'),
            { label: 'Colors & fonts', name: 'theme', widget: 'object', fields: [
              { label: 'Accent color', name: 'primary', widget: 'color' }, { label: 'Dark color (header/footer)', name: 'dark', widget: 'color' },
              { label: 'Light background', name: 'light', widget: 'color' }, { label: 'Text color', name: 'text', widget: 'color' },
              S('Heading font (any Google Font name)', 'headingFont'), S('Body font (any Google Font name)', 'bodyFont')] },
            { label: 'Menu', name: 'nav', widget: 'list', summary: '{{fields.label}} → {{fields.url}}', fields: button },
            { label: 'Contact details', name: 'contact', widget: 'object', fields: [S('Address', 'address', opt), S('Service / opening times', 'serviceTimes', opt), S('Phone', 'phone', opt), S('Email', 'email', opt)] },
            { label: 'Social links', name: 'social', widget: 'list', summary: '{{fields.label}}', fields: button },
          ],
        }],
      },
    ],
  };
};
