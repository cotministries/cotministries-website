// Editor (Decap CMS) configuration, generated into dist/admin/config.yml by build.js.
// To add a new section type: add it here AND in lib/render.js (blocks).
const S = (label, name, extra) => Object.assign({ label, name, widget: 'string', required: false }, extra);
const T = (label, name, extra) => Object.assign({ label, name, widget: 'text', required: false }, extra);
const B = (label, name, def) => ({ label, name, widget: 'boolean', default: def !== false, required: false });
const N = (label, name, extra) => Object.assign({ label, name, widget: 'number', value_type: 'float', required: false }, extra);
const IMG = (label, name, hint) => ({ label, name, widget: 'image', required: false, hint });
const MD = (label, name) => ({ label, name, widget: 'markdown', buttons: ['bold', 'italic', 'link', 'bulleted-list'], editor_components: [], modes: ['rich_text', 'raw'], required: false });
const SEL = (label, name, options, def) => ({ label, name, widget: 'select', options, default: def, required: false });
const LIST = (label, name, fields, summary, extra) => Object.assign({ label, name, widget: 'list', required: false, collapsed: true, summary, fields }, extra);
const STRLIST = (label, name, hint) => ({ label, name, widget: 'list', required: false, hint, field: { label: 'Item', name: 'value', widget: 'string' } });
const button = (label, name) => ({ label: label || 'Button', name: name || 'button', widget: 'object', required: false, collapsed: true, fields: [S('Button text', 'label'), S('Link (e.g. /books/ or https://...)', 'url')] });
const buttons = LIST('Buttons', 'buttons', [S('Button text', 'label'), S('Link', 'url')], '{{fields.label}}');
const ICONS = [{ label: 'People', value: 'users' }, { label: 'Open Bible', value: 'bible' }, { label: 'Clock', value: 'clock' }, { label: 'Crown', value: 'crown' }, { label: 'Scissors', value: 'scissors' }, { label: 'Book', value: 'book' }, { label: 'Calendar', value: 'cal' }, { label: 'Heart', value: 'heart' }, { label: 'Flame', value: 'flame' }, { label: 'Globe', value: 'globe' }, { label: 'Location pin', value: 'pin' }, { label: 'Sparkle', value: 'spark' }, { label: 'Praying hands', value: 'hands' }, { label: 'Phone', value: 'phone' }, { label: 'Email', value: 'mail' }];
const BG = SEL('Background', 'bg', [{ label: 'Cream', value: 'cream' }, { label: 'White', value: 'white' }, { label: 'Navy blue', value: 'dark' }], 'cream');
const heading = S('Heading', 'heading'), sub = S('Small line under heading', 'sub');
const block = (name, label, fields) => ({ name, label, widget: 'object', fields });

// "Services included" in a package: a pick-list of the services in Shop & lists → Services (filled in by cmsConfig below).
const SERVICES_PICK = { label: 'Services included (selected on the booking page when someone clicks the button)', name: 'includes', widget: 'select', multiple: true, options: ['(none yet)'], required: false };
const blocks = [
  block('cotHero', 'Home banner (wide picture, welcome text on the left)', [IMG('Banner picture', 'image', 'Wide picture (about 2000 × 750). Keep the left side calm so the text is easy to read.'), S('Picture description (for Google / screen readers)', 'alt'), S('Small gold line (e.g. Welcome to)', 'script'), S('Big title', 'title'), T('Text', 'text'), buttons, B('Soft light behind the text', 'dim')]),
  block('features', 'Three boxes with icons', [LIST('Boxes', 'items', [SEL('Icon', 'icon', ICONS, 'users'), S('Title', 'title'), T('Text', 'text'), S('Link (optional)', 'url')], '{{fields.title}}')]),
  block('mandate', 'Text + framed picture (e.g. Our Mandate)', [S('Small gold line', 'eyebrow'), heading, MD('Text', 'text'), button('Gold link under the text', 'link'), buttons, IMG('Picture', 'image'), S('Picture description', 'alt'), SEL('Picture side', 'side', [{ label: 'Right', value: 'right' }, { label: 'Left', value: 'left' }], 'right'), SEL('Background', 'bg', [{ label: 'White', value: 'white' }, { label: 'Cream', value: 'cream' }], 'white'), S('Link name (for menu links like /page/#name)', 'anchor')]),
  block('carry', 'Photo cards (e.g. What We Carry)', [heading, LIST('Cards', 'items', [IMG('Photo', 'image'), S('Photo description', 'alt'), S('Title', 'title'), T('Text', 'text'), S('Link (optional)', 'url')], '{{fields.title}}'), BG]),
  block('verse', 'Scripture band (blue sky)', [T('Scripture', 'quote'), S('Bible reference', 'ref'), IMG('Background picture', 'image')]),
  block('testiSlider', 'Testimonies (one at a time, with dots)', [S('Small gold title', 'heading'), N('Seconds per testimony', 'seconds', { hint: 'Leave empty for 8' }), buttons, BG, { label: 'Note', name: 'note', widget: 'hidden', default: 'Testimonies come from Events & shop → Testimonies.' }]),
  block('promo', 'Picture + short promo (e.g. Prophetic School)', [IMG('Picture', 'image'), S('Picture description', 'alt'), SEL('Picture side', 'side', [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }], 'left'), S('Small gold line', 'eyebrow'), heading, MD('Text', 'text'), buttons, S('Link name (for menu links)', 'anchor')]),
  block('gatherings', 'Upcoming gatherings (cards with photo)', [heading, N('Show at most (empty = all)', 'limit'), S('Card button text', 'detailsLabel', { hint: 'Leave empty for Details' }), T('Text when there are no events (empty = hide section)', 'emptyText'), buttons, BG, { label: 'Note', name: 'note', widget: 'hidden', default: 'Events come from Events & shop → Events. Past events hide automatically.' }]),
  block('sow', 'Blue band with world map (e.g. Sow Into the Vision)', [heading, T('Text', 'text'), buttons, IMG('Background picture', 'image')]),
  block('pageHead', 'Page title band', [S('Small gold line', 'eyebrow'), S('Title', 'title'), T('Text', 'text'), IMG('Background picture', 'image'), buttons]),
  block('faq', 'Questions & answers', [heading, LIST('Questions', 'items', [S('Question', 'question'), MD('Answer', 'answer')], '{{fields.question}}'), BG, S('Link name', 'anchor')]),
  block('checklist', 'List with gold check marks', [heading, sub, STRLIST('Items', 'items'), buttons, BG, S('Link name', 'anchor')]),
  block('register', 'Sign-up form with payment (e.g. Monthly Spiritual Detox)', [S('Small gold line', 'eyebrow'), heading, N('Price ($, empty = the Detox price in Settings → Payments)', 'price'), MD('Text next to the form', 'text'), buttons, S('Form title', 'formTitle'), S('Question in the big text box', 'messageLabel'), S('Button text (empty = Register – $price)', 'button'), T('Small text above the button', 'payNote'), SEL('Background', 'bg', [{ label: 'White', value: 'white' }, { label: 'Cream', value: 'cream' }], 'white'), { label: 'Note', name: 'note', widget: 'hidden', default: 'Sign-ups land in Messages. Ways to pay are set in Settings → Payments.' }]),
  block('payInfo', 'How to pay another way (Cash App, Zelle…)', [heading, MD('Text', 'text'), buttons, { label: 'Note', name: 'note', widget: 'hidden', default: 'The ways to pay come from Settings → Payments.' }]),
  block('buttonRow', 'Heading + text + buttons (centered)', [heading, MD('Text', 'text'), buttons, BG]),
  block('banner', 'Home banner (big picture)', [IMG('Banner picture', 'image', 'Wide picture. The text sits in the middle of it.'), S('Picture description (for Google / screen readers)', 'alt'), S('Small line on top', 'eyebrow'), LIST('Big words (add as many lines as you like)', 'lines', [S('Text', 'text'), SEL('Look', 'style', [{ label: 'White', value: 'white' }, { label: 'Red shiny', value: 'red' }, { label: 'White shiny', value: 'whiteShine' }], 'white'), SEL('Font', 'font', [{ label: 'Heading font (from Settings)', value: 'display' }, { label: 'Body font (from Settings)', value: 'body' }, { label: 'Script / handwriting font (from Settings)', value: 'script' }, { label: 'Other font (type the name below)', value: 'other' }], 'display'), S('Other font name (any Google Font, e.g. Playfair Display, or an uploaded font)', 'fontName')], '{{fields.text}}', { collapsed: false, hint: 'Each item is one line. Long words shrink automatically to fit.' }), T('Text', 'text'), S('Script line', 'script'), button()]),
  block('tiles', 'Four boxes (Ministry / Beauty / Books / Events)', [LIST('Boxes', 'items', [SEL('Icon', 'icon', ICONS, 'crown'), S('Title', 'title'), S('Small line', 'sub'), T('Text', 'text'), button()], '{{fields.title}}')]),
  block('blogLatest', 'Latest from the blog (newest posts)', [heading, sub, N('How many posts (1–6)', 'count', { default: 3 }), S('Button text', 'buttonLabel', { hint: 'Leave empty for "All posts"' }), BG]),
  block('newsletter', 'Newsletter sign-up (gold box)', [S('Script line (empty = none)', 'script', { default: 'Letters from Niki' }), heading, MD('Text', 'text'), STRLIST('Points with a diamond', 'perks'), B('Ask what they are interested in', 'showInterests'), S('Interests question', 'interestsLabel', { hint: 'Leave empty for "I\'d love to hear about"' }), STRLIST('Interests (people can tick several)', 'interests', 'Leave empty for: Ministry, Beauty, Events & new books. You can send letters to just one group later.'), S('Button text', 'button', { hint: 'Leave empty for "Subscribe"' }), S('Small print under the button', 'fine'), S('Thank-you title', 'doneTitle'), S('Thank-you text ({name} = their first name)', 'doneText'), BG, S('Link name (for menu links like /#newsletter)', 'anchor', { hint: 'Leave empty for "newsletter"' })]),
  block('journey', 'My Journey + email sign-up', [S('Left title (script)', 'title'), T('Left text', 'text'), button(), B('Show the email sign-up box (right side)', 'showSignup'), S('Sign-up title', 'newsletterTitle'), S('Sign-up text', 'newsletterText'), S('Sign-up button text', 'newsletterButton')]),
  block('featuredBooks', 'Featured books', [heading, sub, button(), { label: 'Note', name: 'note', widget: 'hidden', default: 'Shows every book marked "Featured" in Shop → Books.' }]),
  block('events', 'Events list', [heading, sub, SEL('Style', 'style', [{ label: 'White cards on dark brown', value: 'light' }, { label: 'Red cards on cream', value: 'red' }], 'light'), N('Show at most (empty = all)', 'limit'), B('Show filter buttons', 'filters', false), button(), T('Text when there are no events (empty = hide section)', 'emptyText')]),
  block('testimonies', 'Testimonies', [heading, sub, BG]),
  block('pageBanner', 'Page title banner', [S('Script line', 'script'), S('Title', 'title'), B('Show signature instead of title', 'useSignature', false), S('Small line', 'sub'), T('Text', 'text'), IMG('Background picture (optional)', 'image'), IMG('Cut-out photo on the right (transparent PNG/WebP, optional)', 'photo'), S('Photo description', 'photoAlt')]),
  block('about', 'About me', [IMG('Photo', 'image'), SEL('Photo size', 'photoSize', [{ label: 'Normal', value: 'normal' }, { label: 'Large', value: 'large' }, { label: 'Extra large', value: 'xl' }], 'normal'), S('Photo description', 'alt'), S('Script title', 'script'), S('Name', 'name'), B('Show signature instead of name', 'useSignature', true), IMG('Signature picture (only for this section; empty = site signature)', 'signatureImage'), MD('Text', 'text'), buttons, LIST('List on the left', 'creds', [SEL('Icon', 'icon', ICONS, 'crown'), S('Text', 'text')], '{{fields.text}}')]),
  block('timeline', 'Timeline / steps', [heading, sub, BG, LIST('Steps', 'items', [S('Title', 'title'), T('Text', 'text')], '{{fields.title}}')]),
  block('tagline', 'Script line (centered)', [S('Text', 'text'), BG]),
  block('pillars', 'Boxes with icon and bullets', [heading, sub, BG, LIST('Boxes', 'items', [SEL('Icon', 'icon', ICONS, 'heart'), S('Title', 'title'), T('Text', 'text'), STRLIST('Bullet points', 'bullets')], '{{fields.title}}')]),
  block('ministryForms', 'Prayer request + Invite Chief Apostle forms', [B('Show prayer request form', 'prayer'), S('Prayer form title', 'prayerTitle'), T('Prayer form text', 'prayerText'), STRLIST('"Prayer for" options', 'prayerCategories'), B('Show speaking form', 'speak'), S('Speaking form title', 'speakTitle'), T('Speaking form text', 'speakText'), STRLIST('"Type of event" options', 'eventTypes'), STRLIST('"Expected audience" options', 'audienceSizes')]),
  block('give', 'Giving / partner', [S('Script line', 'script'), heading, MD('Text', 'text'), { label: 'Amount buttons', name: 'amounts', widget: 'list', required: false, field: { label: 'Amount ($)', name: 'value', widget: 'number' } }, STRLIST('"Designate to" options', 'designations'), B('Offer monthly giving', 'monthly')]),
  block('serviceMenu', 'Beauty service menu', [heading, sub, SEL('Default view', 'defaultView', [{ label: 'Cards', value: 'cards' }, { label: 'Menu list', value: 'menu' }], 'cards'), S('Book button link', 'bookUrl', { default: '/book/' }), { label: 'Note', name: 'note', widget: 'hidden', default: 'Services come from Shop → Beauty services.' }]),
  block('packages', 'Bridal packages (shows the list from "Bridal packages" in the menu)', [heading, sub, S('Link name for the menu (e.g. bridal → /beauty/#bridal)', 'anchor'), { label: 'Note', name: 'note', widget: 'hidden', default: 'The packages themselves are edited under "Bridal packages" in the left menu.' }]),
  block('policies', 'Policies boxes', [heading, sub, LIST('Boxes', 'items', [S('Title', 'title'), MD('Text (dollar amounts get a red tag automatically)', 'text')], '{{fields.title}}')]),
  block('giftCards', 'Gift cards', [heading, sub, S('Card title', 'cardTitle'), T('Text', 'text'), { label: 'Amounts', name: 'amounts', widget: 'list', required: false, field: { label: 'Amount ($)', name: 'value', widget: 'number' } }, { label: 'Note', name: 'note', widget: 'hidden', default: 'Buttons go to the Square gift card link in Settings.' }]),
  block('bookingForm', '1:1 booking calendar (open days and times: 🗓 Schedule)', [S('First step heading', 'title'), S('Payment question', 'payLabel'), LIST('Where options', 'locations', [S('Label', 'label'), N('Extra fee ($)', 'fee'), B('Ask for their address (mobile visit)', 'needsAddress', false)], '{{fields.label}}'), B('Ask for inspiration photos', 'photos', true), S('Photo upload text', 'photoText', { hint: 'Leave empty for: Please upload any inspiration pictures' }), N('Last-minute fee ($, empty = hide)', 'rushFee'), S('Policy checkbox text (links allowed: [text](/beauty/#policies))', 'policyText'), S('Button text', 'submitLabel'), T('Note under button', 'note'), S('Note under the estimate', 'balanceNote'), S('Notes field label', 'notesLabel')]),
  block('bookShop', 'Book shop', [T('Text when there are no books', 'emptyText'), { label: 'Note', name: 'note', widget: 'hidden', default: 'Books come from Shop → Books.' }]),
  block('contact', 'Contact info + form', [S('Script title', 'script'), MD('Extra text under contact info', 'text'), S('Form title', 'formTitle'), STRLIST('Topic options', 'topics')]),
  block('text', 'Text', [heading, sub, MD('Text', 'body'), SEL('Alignment', 'align', ['left', 'center'], 'left'), BG, buttons]),
  block('imageText', 'Picture + text', [IMG('Picture', 'image'), S('Picture description', 'alt'), SEL('Picture side', 'side', ['left', 'right'], 'left'), heading, MD('Text', 'body'), BG, buttons]),
  block('weddingInquiry', 'Wedding inquiry form (quotes)', [heading, sub, MD('Text next to the form', 'text'), S('Form title', 'formTitle'),
    S('"How did you hear about us?" question', 'heardLabel'), STRLIST('"How did you hear about us?" choices', 'heardOptions', 'Empty = Instagram, Facebook, YouTube, TikTok, The Knot/The Wire, Speaking Event, Other'),
    S('Button text', 'submitLabel'), T('Small text under the button', 'note')]),
];

module.exports = function cmsConfig({ demo, services }) {
  if (services && services.length) SERVICES_PICK.options = services;
  return {
    // Login with GitHub (handled by functions/api/auth.js + callback.js). base_url is set to the current domain in admin/index.html.
    backend: demo ? { name: 'test-repo' } : { name: 'github', repo: process.env.GITHUB_REPO || 'cotministries/cotministries-website', branch: process.env.GITHUB_BRANCH || 'main', auth_endpoint: 'api/auth', api_root: '/api/github' },
    site_url: '/', display_url: '/', logo_url: '/uploads/favicon.png',
    media_folder: 'static/uploads', public_folder: '/uploads',
    collections: [
      {
        name: 'pages', label: 'Pages', label_singular: 'page', folder: 'content/pages', extension: 'json', format: 'json',
        create: true, delete: true, identifier_field: 'title', slug: '{{fields.slug}}', summary: '{{title}}  ·  /{{slug}}', sortable_fields: ['title'],
        fields: [
          S('Page title', 'title', { required: true }),
          S('Web address', 'slug', { required: true, hint: 'Lowercase words with dashes, e.g. about-us → yoursite.com/about-us/. The home page must be "index". Add new pages to the menu in Settings.', pattern: ['^[a-z0-9-]+$', 'Only lowercase letters, numbers and dashes'] }),
          S('Google description', 'description'),
          B('Hide this page', 'hidden', false),
          { label: 'Sections', name: 'sections', widget: 'list', label_singular: 'section', summary: '{{fields.heading}}{{fields.title}}', types: blocks, required: false },
        ],
      },
      {
        name: 'shop', label: 'Events & shop',
        files: [
          { name: 'books', label: 'Shop items', file: 'content/data/books.json', fields: [LIST('Shop items', 'items', [
            S('Title', 'title', { required: true }), S('Short line on the cover', 'subtitle'), S('Brand line (empty = City Of Testimonies)', 'author'),
            SEL('Category', 'category', ['Shirt', 'Hoodie', 'Hat', 'Book', 'Ebook', 'Gift', 'Bundle'], 'Shirt'),
            SEL('Cover color (when there is no cover picture)', 'coverStyle', [{ label: 'Navy', value: 'espresso' }, { label: 'Cream', value: 'cream' }], 'espresso'),
            IMG('Front cover picture (optional)', 'cover', 'Leave empty to use the designed cover.'), IMG('Real cover photo (shows when hovering)', 'realCover'),
            S('Badge (e.g. New, Pre-order, Save $8)', 'badge'), B('Featured on home page', 'featured', false), B('Show in shop', 'show'),
            T('Description', 'description'),
            LIST('Sizes / formats & prices', 'formats', [S('Name (e.g. S, M, L or Paperback)', 'name'), N('Price ($)', 'price'), B('Digital (ebook, emailed after purchase)', 'digital', false), { label: 'Ebook file (PDF)', name: 'file', widget: 'file', ebook: true, required: false, hint: 'Stored privately. Buyers get a personal download link after paying (30 days, up to 10 downloads).' }], '{{fields.name}} · ${{fields.price}}', { collapsed: false, open_items: true }),
          ], '{{fields.title}}')] },
          { name: 'events', label: 'Events', file: 'content/data/events.json', fields: [LIST('Events', 'items', [
            S('Title', 'title', { required: true }), { label: 'Date', name: 'date', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'MM/DD/YYYY', time_format: false, required: true },
            S('Time (e.g. 7:00 PM – 9:00 PM)', 'time'), S('Type (e.g. Worship, Workshop, Online)', 'kind'), T('Place (two lines are fine)', 'place'), IMG('Photo (for the event card)', 'image'), S('Details button link (empty = the event on the Events page)', 'link'), T('Description', 'description'),
            B('Free event (RSVP instead of tickets)', 'free', false), LIST('Tickets', 'tickets', [S('Ticket name', 'name'), N('Price ($)', 'price')], '{{fields.name}} · ${{fields.price}}'),
            B('Show on website', 'show'), { label: 'Note', name: 'note', widget: 'hidden', default: 'Past events hide automatically.' },
          ], '{{fields.date}} · {{fields.title}}')] },
          { name: 'services', label: '1:1 sessions & prices', file: 'content/data/services.json', fields: [
            STRLIST('Categories', 'categories'),
            LIST('Sessions', 'items', [S('Category (must match one above)', 'category'), S('Session name', 'name', { required: true }), S('Price ($, number)', 'price'), N('Length in minutes', 'minutes'), T('Description', 'description'), B('Show on website', 'show')], '{{fields.name}} · ${{fields.price}}'),
          ] },
          { name: 'testimonies', label: 'Testimonies', file: 'content/data/testimonies.json', fields: [LIST('Testimonies', 'items', [T('Quote', 'quote'), S('Name / who', 'name'), B('Show on website', 'show')], '{{fields.name}}')] },
        ],
      },
      {
        name: 'settings', label: 'Settings',
        files: [{
          name: 'settings', label: 'Logo, colors, fonts, menu, contact & payments', file: 'content/settings.json',
          fields: [
            S('Name', 'name'), IMG('Logo', 'logo'), IMG('Logo for dark areas (optional, empty = same logo)', 'logoLight'), S('Tagline', 'tagline'),
            IMG('Logo in emails (PNG)', 'signature'),
            IMG('Browser tab icon', 'favicon'), IMG('Picture when shared on social media', 'shareImage'),
            S('Google title (home page)', 'seoTitle'), S('Name used in page titles', 'seoName'), T('Google description', 'description'), S('Copyright name', 'copyright'),
            button('Gold button in the menu bar (e.g. Give)', 'topButton'),
            { label: 'Footer', name: 'footer', widget: 'object', collapsed: true, fields: [T('Text under the logo', 'text'), S('Gold scripture line', 'verses'), S('Links title', 'linksTitle'), S('Contact title', 'contactTitle'), S('Social title', 'socialTitle'), S('Newsletter title', 'newsletterTitle'), S('Newsletter button', 'newsletterButton')] },
            { label: 'Colors, fonts & text size', name: 'theme', widget: 'object', collapsed: true, fields: [
              SEL('Text size – whole website (both sites)', 'textScale', [{ label: 'A bit smaller', value: '0.9' }, { label: 'Normal', value: '1' }, { label: 'A bit bigger', value: '1.1' }, { label: 'Bigger', value: '1.2' }, { label: 'Much bigger', value: '1.3' }], '1'),
              
              { label: 'Navy (menu, dark areas)', name: 'dark', widget: 'color' }, { label: 'Main color (links, accents)', name: 'primary', widget: 'color' }, { label: 'Light background', name: 'light', widget: 'color' },
              { label: 'Cream (soft highlights)', name: 'blush', widget: 'color' }, { label: 'Light gold', name: 'accent', widget: 'color' }, { label: 'Text color', name: 'text', widget: 'color' },
              S('Heading font (any Google Font name)', 'displayFont'), S('Body font (any Google Font name)', 'bodyFont'), S('Script font (any Google Font name)', 'scriptFont'),
              LIST('Uploaded fonts (.ttf / .otf / .woff2)', 'customFonts', [S('Font name (use this name above)', 'name'), { label: 'Font file', name: 'file', widget: 'file' }], '{{fields.name}}')] },
            { label: 'Blog', name: 'blog', widget: 'object', collapsed: true, required: false, fields: [S('Script line on top', 'script', { hint: 'Leave empty for "The Blog"' }), S('Big title', 'title', { hint: 'Leave empty for "Faith, beauty & becoming"' }), T('Text under the title', 'intro'), STRLIST('Topics (categories)', 'categories', 'Leave empty for: Devotional, Prayer, Beauty, Bridal, Women\'s Empowerment, Books & Events'), N('Posts per page', 'perPage', { hint: 'Leave empty for 9' }), S('Author name', 'authorName', { hint: 'Leave empty for Prophetess + your name' }), T('Author text under each post', 'authorBio'), IMG('Author photo', 'authorPhoto'), S('Sign-up box script line', 'subscribeScript'), B('Show the "Get new posts in your inbox" sign-up box on the blog', 'showSubscribe'), S('Sign-up box title', 'subscribeTitle')] },
            { label: 'Moving scripture line (above the footer, every page)', name: 'ticker', widget: 'object', collapsed: true, required: false, fields: [B('Show it', 'show'), S('Text', 'text', { hint: 'Leave empty for: Those who sow in tears, shall reap in joy.' }), S('Bible reference', 'ref', { hint: 'Leave empty for: Psalm 126:5' }), N('Seconds for one full scroll (higher = slower)', 'seconds', { hint: 'Leave empty for 48' })] },
            LIST('Menu', 'nav', [S('Text', 'label'), S('Link', 'url'), LIST('Dropdown links', 'children', [S('Text', 'label'), S('Link', 'url')], '{{fields.label}}')], '{{fields.label}} → {{fields.url}}'),
            LIST('Footer links (empty = same as menu)', 'footerLinks', [S('Text', 'label'), S('Link', 'url')], '{{fields.label}}'),
            LIST('Social links', 'social', [SEL('Network', 'network', ['Facebook', 'Instagram', 'YouTube', 'TikTok', 'X', 'Email'], 'Facebook'), S('Name (shown when pointing at the icon)', 'label'), S('Link (or email address)', 'url')], '{{fields.network}} · {{fields.label}}'),
            { label: '"Message us" chat bubble (bottom right of every page)', name: 'chat', widget: 'object', collapsed: true, fields: [B('Hide the chat bubble', 'off', false), S('Bubble text', 'label', { hint: 'e.g. Message us' }), IMG('Photo in the bubble (optional, round)', 'photo'), S('Window title', 'title'), S('Small line under the title', 'status', { hint: 'e.g. Usually replies within a day' }), T('Greeting message', 'text'), STRLIST('Topics', 'topics', 'Leave empty for the same topics as the contact form'), S('Heading after sending', 'doneTitle'), T('Text after sending', 'doneText')] },
            { label: 'Contact details', name: 'contact', widget: 'object', fields: [S('Phone', 'phone'), S('Email', 'email'), T('Location (two lines are fine)', 'location'), S('Website', 'website')] },
            { label: 'Brands & email (where messages go and replies come from)', name: 'brands', widget: 'object', collapsed: true, fields: [
              { label: 'Beauty (bookings, beauty questions)', name: 'beauty', widget: 'object', fields: [S('Name', 'name'), S('Email address', 'email'), S('Newsletter sends from', 'newsletterEmail', { hint: 'Leave empty for newsletter@ + this brand\'s domain. Replies still go to the email address above.' })] },
              { label: 'Ministry (prayer, speaking, giving)', name: 'ministry', widget: 'object', fields: [S('Name', 'name'), S('Email address', 'email'), S('Email for speaking invitations', 'bookingEmail'), S('Newsletter sends from', 'newsletterEmail', { hint: 'Leave empty for newsletter@ + this brand\'s domain. Replies still go to the email address above.' })] },
              { label: 'General (contact, books, events, sign-ups)', name: 'main', widget: 'object', fields: [S('Name', 'name'), S('Email address (empty = use the beauty address)', 'email'), S('Newsletter sends from', 'newsletterEmail', { hint: 'Leave empty for newsletter@ + this brand\'s domain. Replies still go to the email address above.' })] }] },
            { label: 'Payments (Detox sign-up and 1:1 sessions)', name: 'payment', widget: 'object', collapsed: true, fields: [B('Offer card payment online (Stripe)', 'card'), N('Monthly Spiritual Detox price ($)', 'detoxPrice'), S('Name on the card receipt for the Detox', 'detoxName'), LIST('Other ways to pay', 'others', [S('Name (e.g. Cash App)', 'name'), MD('How to send (e.g. Send to $Txnow3)', 'how')], '{{fields.name}}')] },
            N('Shipping fee for shop items ($)', 'shippingFee'), S('Pickup option text', 'pickupLabel'), T('Note in the cart', 'checkoutNote'),
                        S('"How did you hear about us?" question (all forms)', 'heardLabel', { hint: 'Leave empty for "How did you hear about us?"' }), STRLIST('"How did you hear about us?" answers', 'heardOptions', 'Leave empty for: Instagram, Facebook, TikTok, YouTube, Google search, Friend or family, Church or event, Other'), S('Thank-you heading (forms)', 'thanksHeading'), T('Thank-you text (forms)', 'thanksMessage'), S('Thank-you heading (orders)', 'orderThanksHeading'), T('Thank-you text (orders)', 'orderThanksMessage'), S('Thank-you heading (donations)', 'giveThanksHeading'), T('Thank-you text (donations)', 'giveThanksMessage'),
          ],
        }],
      },
    ],
  };
};
