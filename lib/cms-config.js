// Editor (Decap CMS) configuration, generated into dist/admin/config.yml by build.js.
// To add a new block type: add it here AND in lib/render.js (blocks).
const S = (label, name, extra) => Object.assign({ label, name, widget: 'string' }, extra);
const opt = { required: false };
const button = [S('Button text', 'label', opt), S('Link (e.g. /contact/ or https://...)', 'url', Object.assign({ hint: 'WhatsApp group links automatically show as a green WhatsApp button.' }, opt))];
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
  block('imageText', 'Image + Text', [image('Image', 'image', true), { label: 'Image side', name: 'imageSide', widget: 'select', options: ['left', 'right'], default: 'left' }, { label: 'Image size', name: 'imageSize', widget: 'select', options: [{ label: 'Normal (half and half)', value: 'normal' }, { label: 'Large (image about 50% bigger)', value: 'large' }], default: 'normal', required: false }, heading, sub, rich('Text', 'body'), bg, buttons]),
  block('cards', 'Cards (2–3 columns)', [heading, sub, bg, { label: 'Cards', name: 'items', widget: 'list', summary: '{{fields.title}}', fields: [image('Image', 'image'), S('Title', 'title'), { label: 'Text', name: 'text', widget: 'text', required: false }, { label: 'Button', name: 'button', widget: 'object', required: false, collapsed: true, fields: button }, { label: 'Extra buttons (e.g. WhatsApp)', name: 'buttons', widget: 'list', required: false, summary: '{{fields.label}}', fields: button }] }]),
  block('products', 'Shop products (with photos)', [heading, sub, bg, { label: 'Products', name: 'items', widget: 'list', summary: '{{fields.name}} — {{fields.price}}', fields: [image('Photo', 'image', true), S('Product name', 'name'), S('Price', 'price'), { label: 'Description', name: 'description', widget: 'text', required: false }, S('Sizes / options (e.g. S, M, L, XL)', 'options', opt), S('Checkout link (Square / Stripe / PayPal payment link)', 'buyUrl', Object.assign({ hint: 'Create a payment link in Square (Payment links → Create link) and paste it here. Leave empty to show "Coming soon".' }, opt)), S('Button text', 'buyLabel', Object.assign({ default: 'Buy now' }, opt))] }, { label: 'Note below products', name: 'note', widget: 'text', required: false }]),
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
  block('news', 'News & updates list', [heading, sub, { label: 'How many to show (empty = all)', name: 'limit', widget: 'number', required: false, value_type: 'int', min: 1 }, S('Button text when there are more', 'moreLabel', Object.assign({ default: 'See all updates' }, opt)), S('Text when there are no posts', 'emptyText', opt), bg]),
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
        name: 'news', label: 'News & updates', label_singular: 'news post',
        description: 'Each post appears on the News & updates page (newest first) and gets its own page. Delete old posts with "Delete entry".',
        folder: 'content/news', extension: 'json', format: 'json',
        create: true, delete: true, identifier_field: 'title',
        slug: '{{year}}-{{month}}-{{day}}-{{slug}}',
        summary: '{{date}}  ·  {{title}}', sortable_fields: ['date', 'title'],
        fields: [
          S('Title', 'title'),
          { label: 'Date', name: 'date', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'MMM D, YYYY', time_format: false, picker_utc: true, default: '{{now}}' },
          image('Picture (optional)', 'image'),
          { label: 'Short intro for the list (optional)', name: 'summary', widget: 'text', required: false, hint: 'If empty, the first lines of the text are used.' },
          rich('Text', 'body'),
          S('Video link (optional, YouTube / Facebook / Vimeo)', 'video', opt),
          buttons,
          { label: 'Title font', name: 'titleFont', widget: 'select', required: false, default: 'default', options: [{ label: 'Normal', value: 'default' }, { label: 'Site heading font', value: 'heading' }, { label: 'Site body font', value: 'body' }, { label: 'Other font (type the name below)', value: 'other' }] },
          S('Other title font name (any Google Font, e.g. Playfair Display)', 'titleFontName', opt),
          { label: 'Text font', name: 'textFont', widget: 'select', required: false, default: 'default', options: [{ label: 'Normal', value: 'default' }, { label: 'Site heading font', value: 'heading' }, { label: 'Site body font', value: 'body' }, { label: 'Other font (type the name below)', value: 'other' }] },
          S('Other text font name (any Google Font, e.g. Lora)', 'textFontName', opt),
          { label: 'Hide this post (keeps it, but not shown on the website)', name: 'hidden', widget: 'boolean', default: false, required: false },
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
