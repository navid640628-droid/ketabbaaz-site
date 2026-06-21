// ═══════════════════════════════════════════════════════
// build.js — ساخت خودکار سایت کتاب‌باز از روی فایل‌های JSON
// این اسکریپت روی هر Push به گیت‌هاب توسط Cloudflare Pages اجرا می‌شود
// (Build command: node build.js | Output directory: dist)
// ═══════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
// ═══════════════════════════════════════════════════════
// کتاب‌باز — اسکریپت ساخت سایت (build.js)
// نسخه: v2.1 — شامل جستجوی fuzzy، رنگ‌های متنوع کاور، پادکست مدرن
// ═══════════════════════════════════════════════════════
const SITE_URL = 'https://YOUR-DOMAIN.com'; // ← بعد از خرید دامین این رو عوض کن

// ───────── خواندن داده‌ها ─────────
const books = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/books.json'), 'utf-8'));
const facts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/facts.json'), 'utf-8'));
const excerpts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/excerpts.json'), 'utf-8'));
const podcast = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/podcast.json'), 'utf-8'));
const audiobooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/audiobooks.json'), 'utf-8'));

const genreNames = {
  all: 'همه کتاب‌ها', roman: 'رمان و داستان', science: 'علمی و آموزشی',
  personal: 'توسعه فردی', history: 'تاریخ و فلسفه', poetry: 'شعر و ادبیات'
};

// ───────── ابزارهای کمکی ─────────
function slugify(str, fallback) {
  return str || fallback;
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function write(relPath, content) {
  const full = path.join(DIST, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, 'utf-8');
}
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function estimateReadingTime(text) {
  const words = (text || '').split(/\s+/).length;
  return Math.max(1, Math.round(words / 120)); // تقریب سرعت مطالعه فارسی
}
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function faToEnDigits(s) {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  return String(s || '').replace(/[۰-۹]/g, d => fa.indexOf(d));
}

// کتاب‌ها رو با id افزایشی به‌عنوان «جدیدترین‌ها» اول لیست کن (بزرگ‌تر id = جدیدتر)
const booksByNewest = [...books].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);

function findBookBySlug(slug) { return books.find(b => (b.slug || `book-${b.id}`) === slug); }
function bookUrl(b) { return `books/${b.slug || 'book-' + b.id}.html`; }
function audiobookUrl(b) { return `audiobooks/${b.slug || 'audiobook-' + b.id}.html`; }
function relatedBooks(book, max = 3) {
  return books.filter(b => b.genre === book.genre && b.id !== book.id).slice(0, max);
}

// ───────── قطعات مشترک HTML ─────────
function renderHead({ title, description, canonicalPath, ogImage, jsonLd, depth = 0 }) {
  const prefix = depth > 0 ? '../'.repeat(depth) : '';
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${SITE_URL}/${canonicalPath}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${SITE_URL}/${canonicalPath}">
<meta property="og:locale" content="fa_IR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>">
<link rel="stylesheet" href="${prefix}static/style.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}`;
}

function renderNav(depth = 0, active = '') {
  const p = depth > 0 ? '../'.repeat(depth) : '';
  const link = (href, label, key) =>
    `<a href="${p}${href}"${active === key ? ' class="active"' : ''}>${label}</a>`;
  return `<nav id="mainNav" class="scrolled">
  <a href="${p}index.html" class="nav-logo">کتاب<span>‌باز</span></a>
  <div class="nav-links" id="navLinks">
    ${link('books.html', 'کتاب‌ها', 'books')}
    ${link('index.html#facts', 'حقایق', '')}
    ${link('index.html#excerpts', 'گزیده', '')}
    ${link('podcast.html', 'پادکست', 'podcast')}
    ${link('audiobooks.html', '🎧 کتاب صوتی', 'audiobooks')}
    <a href="https://t.me/kmketab" target="_blank" class="nav-tg">✈️ کانال تلگرام</a>
  </div>
  <div class="hamburger" id="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>
</nav>
<script>function toggleMenu(){document.getElementById('navLinks').classList.toggle('open');}</script>`;
}

function renderFooter(depth = 0) {
  const p = depth > 0 ? '../'.repeat(depth) : '';
  return `<footer>
  <div class="footer-logo">📚 کتاب‌باز</div>
  <p>کانال تلگرامی کتاب‌باز — معرفی، نقد و خلاصه بهترین کتاب‌ها</p>
  <div class="footer-links">
    <a href="${p}books.html">کتابخانه</a>
    <a href="${p}podcast.html">پادکست</a>
    <a href="${p}audiobooks.html">کتاب صوتی</a>
    <a href="https://t.me/kmketab" target="_blank">کانال تلگرام</a>
  </div>
  <p style="font-size:0.75rem; margin-top:1rem; opacity:0.4">© ۱۴۰۳ کتاب‌باز · با ❤️ برای کتاب‌دوستان · نسخه سایت: v2.1</p>
</footer>`;
}

function revealScript() {
  return `<script>
function revealOnScroll(){document.querySelectorAll('.reveal:not(.visible)').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<window.innerHeight-60)el.classList.add('visible');});}
window.addEventListener('scroll',revealOnScroll);
window.addEventListener('DOMContentLoaded',revealOnScroll);
revealOnScroll();
document.querySelectorAll('#navLinks a').forEach(a=>a.onclick=()=>document.getElementById('navLinks').classList.remove('open'));
</script>`;
}

function starsHtml(rate) {
  const full = Math.round(rate);
  return '★★★★★'.split('').map((s, i) => i < full ? '★' : '☆').join('');
}

// تابع جستجوی تقریبی (fuzzy) — برای استفاده در صفحه کتاب‌ها و کتاب‌های صوتی
function fuzzySearchScript() {
  return `
function normalizeFa(s){
  return String(s||'')
    .replace(/[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]/g,'')
    .replace(/ك/g,'ک').replace(/ي/g,'ی').replace(/ـ/g,'')
    .replace(/\\s+/g,' ').trim().toLowerCase();
}
function levenshtein(a,b){
  const m=a.length,n=b.length;
  if(!m) return n; if(!n) return m;
  const dp=[];
  for(let i=0;i<=m;i++){dp.push(new Array(n+1).fill(0));dp[i][0]=i;}
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]= a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function fuzzyMatch(query,target){
  query=normalizeFa(query); target=normalizeFa(target);
  if(!query) return true;
  if(target.includes(query)) return true;
  let qi=0;
  for(let i=0;i<target.length && qi<query.length;i++) if(target[i]===query[qi]) qi++;
  if(qi===query.length) return true;
  const words=target.split(' ');
  const threshold=Math.max(1,Math.floor(query.length/3));
  for(const w of words){
    if(Math.abs(w.length-query.length)<=threshold+2 && levenshtein(query,w)<=threshold) return true;
  }
  return false;
}`;
}

function bookCardHtml(b, depth) {
  const p = depth > 0 ? '../'.repeat(depth) : '';
  return `<a href="${p}${bookUrl(b)}" class="book-card reveal" data-genre="${b.genre}" data-lang="${b.lang}" data-top="${b.isTop}" data-title="${escapeHtml(b.title)}" data-author="${escapeHtml(b.author)}" style="text-decoration:none;display:block">
  <div class="book-card-top" style="background:${b.coverBg}">
    <div class="book-cover-sm" style="background:${b.coverBg};filter:brightness(1.3)">${b.cover}</div>
    <div class="book-meta">
      <span class="book-genre-tag">${b.tag}</span>
      <div class="book-title-card">${escapeHtml(b.title)}</div>
      <div class="book-author-card">✍️ ${escapeHtml(b.author)}</div>
    </div>
    <div class="book-lang-badge">${b.lang === 'fa' ? '🇮🇷 فارسی' : '🌍 ترجمه'}</div>
  </div>
  <div class="book-card-body">
    <p class="book-summary">${escapeHtml(b.summary).slice(0, 110)}...</p>
  </div>
  <div class="book-card-footer">
    <div class="footer-rating-row">
      <span class="audiobook-stars" style="color:var(--amber)">${starsHtml(b.rate)}</span>
      <span class="rating-avg">${b.rate.toFixed(1)}</span>
    </div>
    <div class="footer-actions-row">
      <span class="pdf-link" style="pointer-events:none">📖 مشاهده کامل</span>
    </div>
  </div>
</a>`;
}

// ═══════════════════════════════════════════════════════
// صفحه مجزای هر کتاب  →  dist/books/{slug}.html
// ═══════════════════════════════════════════════════════
function buildBookPage(book) {
  const readingTime = estimateReadingTime(book.summary + ' ' + book.review + ' ' + (book.content || '').replace(/<[^>]+>/g, ' '));
  const related = relatedBooks(book);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "name": book.title,
    "author": { "@type": "Person", "name": book.author },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": book.rate, "bestRating": "5" },
    "genre": book.tag,
    "inLanguage": book.lang === 'fa' ? 'fa' : 'multi',
    "description": book.summary
  };

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
${renderHead({
  title: `${book.title} (${book.author}) — معرفی، خلاصه و نقد | کتاب‌باز`,
  description: book.summary.slice(0, 150),
  canonicalPath: bookUrl(book),
  jsonLd,
  depth: 1
})}
</head>
<body>
${renderNav(1, 'books')}

<div class="breadcrumb" style="margin-top:5.5rem">
  <a href="../index.html">خانه</a><span class="sep">/</span>
  <a href="../books.html">کتاب‌ها</a><span class="sep">/</span>
  <a href="../books.html?genre=${book.genre}">${book.tag}</a><span class="sep">/</span>
  <span class="current">${escapeHtml(book.title)}</span>
</div>

<section class="book-detail-hero">
  <div class="book-detail-hero-inner">
    <div class="book-detail-cover" style="background:${book.coverBg}">${book.cover}</div>
    <div class="book-detail-info">
      <span class="book-detail-tag">${book.tag}</span>
      <h1 class="book-detail-title">${escapeHtml(book.title)}</h1>
      <p class="book-detail-author">✍️ نویسنده: ${escapeHtml(book.author)}</p>
      <div class="book-detail-meta-row">
        <span class="bd-meta-chip">⭐ ${book.rate.toFixed(1)} از ۵</span>
        <span class="bd-meta-chip">${book.lang === 'fa' ? '🇮🇷 فارسی' : '🌍 ترجمه'}</span>
        <span class="bd-meta-chip">⏱ حدود ${readingTime} دقیقه مطالعه این صفحه</span>
        ${book.isTop ? '<span class="bd-meta-chip">🏆 برترین کتاب‌ها</span>' : ''}
      </div>
      <div class="book-detail-actions">
        <a href="../${book.pdf}" target="_blank" class="pdf-link" download>📄 دریافت PDF</a>
        <a href="${book.tg}" target="_blank" class="tg-link">✈️ کانال تلگرام</a>
      </div>
    </div>
  </div>
</section>

<div class="book-detail-body">
  <div class="bd-section">
    <h2>✍️ خلاصه کتاب</h2>
    <p>${escapeHtml(book.summary)}</p>
  </div>
  ${book.content ? `<div class="bd-section">
    <h2>📖 درباره این کتاب</h2>
    ${book.content}
  </div>` : ''}
  <div class="bd-section review">
    <h2>💬 نقد کتاب‌باز</h2>
    <p>${escapeHtml(book.review)}</p>
  </div>

  <div class="bd-section">
    <div class="bd-rating-box">
      <div style="display:flex;align-items:center;gap:0.5rem">
        <div class="star-rating" data-book-id="${book.id}"></div>
        <span class="rating-avg" id="avgDisplay">${book.rate.toFixed(1)}</span>
        <span class="rating-count" id="countDisplay"></span>
      </div>
      <span style="font-size:0.82rem;color:var(--text-light)">نظرت چیه؟ امتیاز بده 👆</span>
    </div>
    <div class="share-row">
      <button class="share-btn" onclick="shareBook()">🔗 اشتراک‌گذاری لینک</button>
      <a href="https://t.me/share/url?url=${encodeURIComponent(SITE_URL + '/' + bookUrl(book))}&text=${encodeURIComponent('معرفی کتاب «' + book.title + '» در کتاب‌باز')}" target="_blank" class="share-btn">✈️ اشتراک در تلگرام</a>
    </div>
  </div>
</div>

${related.length ? `<section class="related-section">
  <div class="section-inner">
    <h2 class="section-title" style="font-size:1.4rem">📚 کتاب‌های مرتبط در همین ژانر</h2>
    <div class="related-grid">
      ${related.map(r => `<a href="${r.slug || 'book-' + r.id}.html" class="related-card">
        <div class="related-cover-sm" style="background:${r.coverBg}">${r.cover}</div>
        <div class="related-info">
          <div class="rt">${escapeHtml(r.title)}</div>
          <div class="ra">✍️ ${escapeHtml(r.author)}</div>
        </div>
      </a>`).join('')}
    </div>
    <div style="text-align:center;margin-top:1.5rem">
      <a href="../books.html" class="view-all-link">مشاهده همه کتاب‌های ${book.tag} ←</a>
    </div>
  </div>
</section>` : ''}

${renderFooter(1)}

<script>
function hasVoted(id){try{return !!localStorage.getItem('voted_'+id);}catch(e){return false;}}
function saveVote(id,v){try{localStorage.setItem('voted_'+id,v);}catch(e){}}
function renderStars(){
  const id=${book.id}, baseRate=${book.rate}, container=document.querySelector('.star-rating');
  let count = 0;
  try { count = parseInt(localStorage.getItem('count_'+id) || '0'); } catch(e){}
  const voted = hasVoted(id);
  const userVal = voted ? parseInt(localStorage.getItem('voted_'+id)) : 0;
  container.innerHTML='';
  for(let i=1;i<=5;i++){
    const s=document.createElement('span');
    const filled = voted ? (i<=userVal) : (i<=Math.round(baseRate));
    s.className='star'+(filled?' filled':'')+(voted?' voted':'');
    s.textContent='★';
    if(!voted){
      s.onmouseenter=()=>{container.querySelectorAll('.star').forEach((st,idx)=>st.classList.toggle('filled',idx<i));};
      s.onmouseleave=()=>{container.querySelectorAll('.star').forEach((st,idx)=>st.classList.toggle('filled',idx<Math.round(baseRate)));};
      s.onclick=()=>{
        saveVote(id,i);
        try{localStorage.setItem('count_'+id, String(count+1));}catch(e){}
        renderStars();
        const thanks=document.createElement('span');
        thanks.className='vote-thanks'; thanks.textContent='✓ ثبت شد';
        container.parentElement.appendChild(thanks);
        setTimeout(()=>thanks.remove(),2000);
      };
    }
    container.appendChild(s);
  }
  document.getElementById('countDisplay').textContent = count > 0 ? '('+count+' رأی)' : '';
}
renderStars();
function shareBook(){
  const url = window.location.href;
  if(navigator.share){ navigator.share({title:document.title, url}); }
  else { navigator.clipboard.writeText(url); alert('لینک کپی شد!'); }
}
</script>
${revealScript()}
</body>
</html>`;

  write(bookUrl(book), html);
}

books.forEach(buildBookPage);
console.log(`✓ ${books.length} صفحه کتاب ساخته شد`);

// ═══════════════════════════════════════════════════════
// صفحه لیست همه کتاب‌ها  →  dist/books.html
// ═══════════════════════════════════════════════════════
function buildBooksListPage() {
  const cardsHtml = booksByNewest.map(b => bookCardHtml(b, 0)).join('\n');
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
${renderHead({
  title: 'کتابخانه کتاب‌باز — معرفی، نقد و خلاصه همه کتاب‌ها',
  description: 'مجموعه کامل کتاب‌های معرفی‌شده در کانال کتاب‌باز؛ رمان، تاریخ، فلسفه، توسعه فردی و شعر فارسی و ترجمه.',
  canonicalPath: 'books.html',
  depth: 0
})}
</head>
<body>
${renderNav(0, 'books')}

<section class="books-page-hero">
  <h1>کتابخانه کتاب‌باز</h1>
  <p>تمام کتاب‌های معرفی‌شده، با امکان فیلتر بر اساس ژانر و زبان</p>
</section>

<section class="library-section" id="library">
  <div class="section-inner">
    <div class="library-layout">
      <div class="filter-sidebar reveal">
        <div class="sidebar-title">📚 ژانر کتاب</div>
        <div class="filter-bar" id="genreFilter">
          <button class="filter-btn active" data-genre="all">🔍 همه کتاب‌ها</button>
          <button class="filter-btn" data-genre="roman">📖 رمان و داستان</button>
          <button class="filter-btn" data-genre="science">🔬 علمی و آموزشی</button>
          <button class="filter-btn" data-genre="personal">🌱 توسعه فردی</button>
          <button class="filter-btn" data-genre="history">🏛️ تاریخ و فلسفه</button>
          <button class="filter-btn" data-genre="poetry">🌺 شعر و ادبیات</button>
        </div>
        <hr class="sidebar-divider">
        <div class="sidebar-title">🌍 زبان</div>
        <div class="filter-bar" id="langFilter">
          <button class="filter-btn lang-btn active" data-lang="all">🌐 همه</button>
          <button class="filter-btn lang-btn" data-lang="fa">🇮🇷 فارسی</button>
          <button class="filter-btn lang-btn" data-lang="tr">🌍 ترجمه</button>
        </div>
        <hr class="sidebar-divider">
        <div class="sidebar-title">📊 امتیاز</div>
        <div class="filter-bar" id="topFilter">
          <button class="filter-btn top-btn active" data-top="all">⭐ همه</button>
          <button class="filter-btn top-btn" data-top="top">🏆 برترین‌ها</button>
        </div>
      </div>

      <div class="library-main">
        <div class="search-box-wrap reveal">
          <span class="search-box-icon">🔍</span>
          <input type="text" id="bookSearchInput" class="search-box-input" placeholder="نام کتاب یا نویسنده را بنویسید... (حتی تقریبی)">
          <button class="search-box-clear" id="bookSearchClear" title="پاک کردن">✕</button>
        </div>
        <div class="library-top-bar reveal">
          <div class="active-genre-label">نمایش: <span id="activeGenreLabel">همه کتاب‌ها</span></div>
        </div>
        <div class="no-results" id="noResults">
          <div class="nr-icon">📭</div>
          <p>کتابی با این مشخصات پیدا نشد</p>
        </div>
        <div class="books-grid" id="booksGrid">
          ${cardsHtml}
        </div>
      </div>
    </div>
  </div>
</section>

${renderFooter(0)}

<script>
${fuzzySearchScript()}
let activeGenre = 'all', activeLang = 'all', activeTop = 'all', searchQuery = '';
const genreNames = ${JSON.stringify(genreNames)};

// از URL اولیه (مثلا books.html?genre=roman) فیلتر اولیه رو بخون
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('genre')) activeGenre = urlParams.get('genre');

function applyFilter(){
  const cards = Array.from(document.querySelectorAll('#booksGrid .book-card'));
  const shouldShow = c => {
    const g = activeGenre==='all' || c.dataset.genre===activeGenre;
    const l = activeLang==='all' || c.dataset.lang===activeLang;
    const t = activeTop==='all' || c.dataset.top==='true';
    const s = !searchQuery || fuzzyMatch(searchQuery, c.dataset.title) || fuzzyMatch(searchQuery, c.dataset.author);
    return g && l && t && s;
  };
  const toShow = cards.filter(shouldShow);
  const toHide = cards.filter(c=>!shouldShow(c));
  toHide.forEach(c=>{c.classList.remove('hide-card');c.classList.add('fading-out');});
  setTimeout(()=>{
    toHide.forEach(c=>{c.classList.add('hide-card');c.classList.remove('fading-out');});
    toShow.forEach(c=>c.classList.remove('hide-card','fading-out'));
    document.getElementById('noResults').style.display = toShow.length===0?'block':'none';
  },350);
  document.getElementById('activeGenreLabel').textContent = (searchQuery ? ('جستجو: «' + searchQuery + '» — ') : '') + (genreNames[activeGenre] || 'همه کتاب‌ها');
}

const searchInput = document.getElementById('bookSearchInput');
const searchClear = document.getElementById('bookSearchClear');
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  searchClear.classList.toggle('show', searchQuery.length > 0);
  applyFilter();
});
searchClear.addEventListener('click', () => {
  searchInput.value = ''; searchQuery = '';
  searchClear.classList.remove('show');
  applyFilter();
  searchInput.focus();
});

document.querySelectorAll('#genreFilter .filter-btn').forEach(btn=>{
  if (btn.dataset.genre === activeGenre) { document.querySelectorAll('#genreFilter .filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
  btn.onclick=()=>{document.querySelectorAll('#genreFilter .filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeGenre=btn.dataset.genre;applyFilter();};
});
document.querySelectorAll('#langFilter .lang-btn').forEach(btn=>{
  btn.onclick=()=>{document.querySelectorAll('#langFilter .lang-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeLang=btn.dataset.lang;applyFilter();};
});
document.querySelectorAll('#topFilter .top-btn').forEach(btn=>{
  btn.onclick=()=>{document.querySelectorAll('#topFilter .top-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeTop=btn.dataset.top;applyFilter();};
});
applyFilter();
</script>
${revealScript()}
</body>
</html>`;
  write('books.html', html);
  console.log('✓ صفحه books.html ساخته شد');
}
buildBooksListPage();

// ═══════════════════════════════════════════════════════
// صفحه پادکست (با پلیر واقعی)  →  dist/podcast.html
// ═══════════════════════════════════════════════════════
function buildPodcastPage() {
  const f = podcast.featured;
  const totalEpisodes = podcast.episodes.length;
  const episodesHtml = podcast.episodes.map((ep, i) => `
    <div class="pp-ep-item${i===0?' playing':''}" data-audio="${ep.audioFile}" data-title="${escapeHtml(ep.title)}" data-desc="" data-dur="${ep.durationSec}">
      <div class="pp-ep-num">${ep.num}</div>
      <div class="pp-ep-body">
        <div class="pp-ep-title">${escapeHtml(ep.title)}</div>
        <div class="pp-ep-meta"><span>⏱ ${Math.round(ep.durationSec/60)} دقیقه</span><span class="dot">•</span><span>${ep.date}</span></div>
      </div>
      <span class="pp-ep-play-icon">▶</span>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
${renderHead({
  title: 'پادکست کتاب‌باز — معرفی صوتی کتاب',
  description: 'پادکست هفتگی کتاب‌باز؛ گفتگو و نقد صوتی بهترین کتاب‌ها.',
  canonicalPath: 'podcast.html',
  depth: 0
})}
</head>
<body>
${renderNav(0, 'podcast')}

<section class="podcast-hero">
  <div class="podcast-hero-content">
    <div class="podcast-hero-badge">🎙️ پادکست هفتگی</div>
    <h1>پادکست <span>کتاب‌باز</span></h1>
    <p>هر هفته یک کتاب، یک گفتگو، یک نگاه تازه — همراه با صدای کتاب‌باز.</p>
    <div class="podcast-hero-stats">
      <div class="phs-item"><span class="phs-num">${totalEpisodes}</span><span class="phs-lbl">قسمت</span></div>
      <div class="phs-divider"></div>
      <div class="phs-item"><span class="phs-num">هفتگی</span><span class="phs-lbl">انتشار</span></div>
    </div>
  </div>
</section>

<div class="podcast-player-wrap">
  <div class="pp-player-card">
    <div class="pp-now-playing">
      <div class="pp-cover">
        <span class="pp-eq" id="ppEq"><span></span><span></span><span></span><span></span></span>
        🎧
      </div>
      <div class="pp-np-info">
        <span class="pp-np-tag">در حال پخش</span>
        <div class="pp-np-title" id="npTitle">${escapeHtml(f.title)}</div>
        <div class="pp-np-desc" id="npDesc">${escapeHtml(f.desc)}</div>
      </div>
    </div>
    <div class="pp-progress-wrap">
      <div class="pp-bar" id="ppBar"><div class="pp-bar-fill" id="ppBarFill"></div></div>
      <div class="pp-time-row"><span id="ppCurrent">۰۰:۰۰</span><span id="ppTotal">۰۰:۰۰</span></div>
    </div>
    <div class="pp-controls">
      <button class="pp-btn-seek" onclick="seek(-30)">⏪<span class="lbl">۳۰ ثانیه</span></button>
      <button class="pp-btn-main" id="ppPlayBtn" onclick="togglePlay()">▶</button>
      <button class="pp-btn-seek" onclick="seek(30)">⏩<span class="lbl">۳۰ ثانیه</span></button>
    </div>
    <audio id="ppAudio" src="${f.audioFile}" preload="metadata"></audio>
  </div>
</div>

<section class="podcast-episodes-section">
  <div class="section-inner" style="max-width:760px">
    <div class="section-header-row reveal">
      <h2 class="section-title" style="margin-bottom:0">همه قسمت‌ها</h2>
      <span class="ep-count-pill">${totalEpisodes} قسمت</span>
    </div>
    <div class="pp-episode-list">
      ${episodesHtml}
    </div>
    <div class="podcast-platforms reveal">
      <a href="https://t.me/kmketab" target="_blank" class="podcast-platform-btn">✈️ دنبال کردن در تلگرام</a>
      <a href="#" class="podcast-platform-btn">🎵 کست‌باکس</a>
      <a href="#" class="podcast-platform-btn">🟢 اسپاتیفای</a>
    </div>
  </div>
</section>

${renderFooter(0)}

<script>
const audio = document.getElementById('ppAudio');
const playBtn = document.getElementById('ppPlayBtn');
const eqEl = document.getElementById('ppEq');
function fmt(sec){sec=Math.max(0,Math.floor(sec));const m=Math.floor(sec/60),s=sec%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function togglePlay(){ if(audio.paused){audio.play();playBtn.textContent='❙❙';eqEl.classList.add('live');} else {audio.pause();playBtn.textContent='▶';eqEl.classList.remove('live');} }
function seek(d){ audio.currentTime = Math.max(0, audio.currentTime + d); }
audio.addEventListener('timeupdate',()=>{
  const pct = audio.duration ? (audio.currentTime/audio.duration*100) : 0;
  document.getElementById('ppBarFill').style.width = pct+'%';
  document.getElementById('ppCurrent').textContent = fmt(audio.currentTime);
});
audio.addEventListener('loadedmetadata',()=>{ document.getElementById('ppTotal').textContent = fmt(audio.duration); });
audio.addEventListener('ended',()=>{ playBtn.textContent='▶'; eqEl.classList.remove('live'); });
document.getElementById('ppBar').onclick = (e)=>{
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = 1 - ((e.clientX-rect.left)/rect.width); // RTL
  if(audio.duration) audio.currentTime = ratio*audio.duration;
};
document.querySelectorAll('.pp-ep-item').forEach(item=>{
  item.onclick = ()=>{
    document.querySelectorAll('.pp-ep-item').forEach(i=>i.classList.remove('playing'));
    item.classList.add('playing');
    audio.src = item.dataset.audio;
    document.getElementById('npTitle').textContent = item.dataset.title;
    document.getElementById('npDesc').textContent = 'در حال پخش از لیست قسمت‌ها';
    audio.play(); playBtn.textContent='❙❙'; eqEl.classList.add('live');
    window.scrollTo({top:0,behavior:'smooth'});
  };
});
</script>
${revealScript()}
</body>
</html>`;
  write('podcast.html', html);
  console.log('✓ صفحه podcast.html ساخته شد');
}
buildPodcastPage();

// ═══════════════════════════════════════════════════════
// صفحه لیست کتاب‌های صوتی  →  dist/audiobooks.html
// ═══════════════════════════════════════════════════════
function audiobookCardHtml(b, depth) {
  const p = depth > 0 ? '../'.repeat(depth) : '';
  return `<a href="${p}${audiobookUrl(b)}" class="audiobook-card reveal" data-genre="${b.genre}" data-title="${escapeHtml(b.title)}" data-author="${escapeHtml(b.author)}" style="text-decoration:none;color:inherit;display:block">
    <div class="audiobook-cover-wrap" style="background:${b.coverBg}">
      ${b.cover}
      <span class="narrator-badge">${b.narrator}</span>
      <span class="duration-badge">⏱ ${b.duration}</span>
      <div class="audiobook-play-overlay"><div class="play-icon">▶</div></div>
    </div>
    <div class="audiobook-body">
      <span class="audiobook-genre-tag">${b.tag}</span>
      <div class="audiobook-title">${escapeHtml(b.title)}</div>
      <div class="audiobook-author">✍️ ${escapeHtml(b.author)}</div>
      <div class="audiobook-meta-row">
        <span class="audiobook-stars">${starsHtml(parseFloat(faToEnDigits(String(b.rate)).replace(/[^\d.]/g,'')) || 5)}</span>
        <span>${b.rate}</span>
      </div>
    </div>
  </a>`;
}

function buildAudiobooksListPage() {
  const cardsHtml = audiobooks.map(b => audiobookCardHtml(b, 0)).join('\n');
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
${renderHead({
  title: 'کتاب‌های صوتی فارسی و ترجمه | کتاب‌باز',
  description: 'کتابخانه صوتی کتاب‌باز؛ بهترین کتاب‌های صوتی با صدای گویندگان حرفه‌ای.',
  canonicalPath: 'audiobooks.html',
  depth: 0
})}
</head>
<body>
${renderNav(0, 'audiobooks')}

<section class="audio-hero">
  <div class="audio-hero-content">
    <div class="audio-hero-badge">🎧 کتابخانه صوتی کتاب‌باز</div>
    <h1>گوش کن به<span> کتاب‌ها</span></h1>
    <p>وقتی وقت خواندن نداری، بگذار کتاب برایت خوانده شود.</p>
    <div class="waveform-deco" id="heroWave"></div>
  </div>
</section>

<section id="library">
  <div class="section-inner">
    <div class="search-box-wrap reveal">
      <span class="search-box-icon">🔍</span>
      <input type="text" id="audioSearchInput" class="search-box-input" placeholder="نام کتاب صوتی یا نویسنده را بنویسید... (حتی تقریبی)">
      <button class="search-box-clear" id="audioSearchClear" title="پاک کردن">✕</button>
    </div>
    <div class="audio-filter-bar reveal" id="genreFilter">
      <button class="audio-filter-btn active" data-genre="all">🔍 همه</button>
      <button class="audio-filter-btn" data-genre="roman">📖 رمان و داستان</button>
      <button class="audio-filter-btn" data-genre="science">🔬 علمی و آموزشی</button>
      <button class="audio-filter-btn" data-genre="personal">🌱 توسعه فردی</button>
      <button class="audio-filter-btn" data-genre="history">🏛️ تاریخ و فلسفه</button>
      <button class="audio-filter-btn" data-genre="poetry">🌺 شعر و ادبیات</button>
    </div>
    <div class="no-results" id="noResults"><div class="nr-icon">📭</div><p>کتاب صوتی‌ای با این مشخصات پیدا نشد</p></div>
    <div class="audiobook-grid" id="audiobookGrid">${cardsHtml}</div>
  </div>
</section>

${renderFooter(0)}

<script>
${fuzzySearchScript()}
const wave = document.getElementById('heroWave');
for (let i=0;i<24;i++){const bar=document.createElement('span');bar.style.animationDelay=(i*0.08)+'s';wave.appendChild(bar);}

let activeGenre='all', searchQuery='';
function applyFilter(){
  const cards=Array.from(document.querySelectorAll('#audiobookGrid .audiobook-card'));
  const shouldShow=c=>{
    const g = activeGenre==='all'||c.dataset.genre===activeGenre;
    const s = !searchQuery || fuzzyMatch(searchQuery, c.dataset.title) || fuzzyMatch(searchQuery, c.dataset.author);
    return g && s;
  };
  const toShow=cards.filter(shouldShow), toHide=cards.filter(c=>!shouldShow(c));
  toHide.forEach(c=>{c.classList.remove('hide-card');c.classList.add('fading-out');});
  setTimeout(()=>{
    toHide.forEach(c=>{c.classList.add('hide-card');c.classList.remove('fading-out');});
    toShow.forEach(c=>c.classList.remove('hide-card','fading-out'));
    document.getElementById('noResults').style.display=toShow.length===0?'block':'none';
  },350);
}

const audioSearchInput = document.getElementById('audioSearchInput');
const audioSearchClear = document.getElementById('audioSearchClear');
audioSearchInput.addEventListener('input', () => {
  searchQuery = audioSearchInput.value.trim();
  audioSearchClear.classList.toggle('show', searchQuery.length > 0);
  applyFilter();
});
audioSearchClear.addEventListener('click', () => {
  audioSearchInput.value = ''; searchQuery = '';
  audioSearchClear.classList.remove('show');
  applyFilter();
  audioSearchInput.focus();
});

document.querySelectorAll('#genreFilter .audio-filter-btn').forEach(btn=>{
  btn.onclick=()=>{document.querySelectorAll('#genreFilter .audio-filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeGenre=btn.dataset.genre;applyFilter();};
});
</script>
${revealScript()}
</body>
</html>`;
  write('audiobooks.html', html);
  console.log('✓ صفحه audiobooks.html ساخته شد');
}
buildAudiobooksListPage();

// ═══════════════════════════════════════════════════════
// صفحه پخش هر کتاب صوتی  →  dist/audiobooks/{slug}.html
// ═══════════════════════════════════════════════════════
function buildAudiobookPage(ab) {
  const isChapters = ab.mode === 'chapters' && Array.isArray(ab.chapters) && ab.chapters.length > 0;
  const firstSrc = isChapters ? ab.chapters[0].file : ab.audioFile;
  const firstTitle = isChapters ? ab.chapters[0].title : ab.title;

  const chapterListHtml = isChapters ? `
<div class="ab-chapter-list">
  <h2 class="section-title" style="font-size:1.2rem;margin-bottom:1.2rem">📑 فهرست فصل‌ها (${ab.chapters.length} فصل)</h2>
  ${ab.chapters.map((ch, i) => `
  <div class="ab-chapter-item${i===0?' playing':''}" data-src="../${ch.file}" data-title="${escapeHtml(ch.title)}" data-idx="${i}">
    <div class="ab-chapter-num">${i+1}</div>
    <div class="ab-chapter-title">${escapeHtml(ch.title)}</div>
    <div class="ab-chapter-dur">${Math.round(ch.durationSec/60)} دقیقه</div>
  </div>`).join('')}
</div>` : '';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Audiobook",
    "name": ab.title,
    "author": { "@type": "Person", "name": ab.author },
    "duration": ab.duration
  };

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
${renderHead({
  title: `کتاب صوتی ${ab.title} (${ab.author}) | کتاب‌باز`,
  description: `گوش دادن آنلاین به کتاب صوتی ${ab.title} اثر ${ab.author}، ${ab.narrator}.`,
  canonicalPath: audiobookUrl(ab),
  jsonLd,
  depth: 1
})}
</head>
<body>
${renderNav(1, 'audiobooks')}

<div class="breadcrumb" style="margin-top:5.5rem">
  <a href="../index.html">خانه</a><span class="sep">/</span>
  <a href="../audiobooks.html">کتاب‌های صوتی</a><span class="sep">/</span>
  <span class="current">${escapeHtml(ab.title)}</span>
</div>

<section class="ab-play-hero">
  <div class="ab-play-card">
    <div class="ab-play-cover" style="background:${ab.coverBg}">${ab.cover}</div>
    <div class="ab-play-title">${escapeHtml(ab.title)}</div>
    <div class="ab-play-author">✍️ ${escapeHtml(ab.author)} · 🎙️ ${ab.narrator}</div>
    ${isChapters ? `<div class="ab-current-chapter" id="currentChapterLabel">${escapeHtml(firstTitle)}</div>` : ''}

    <div class="pp-controls">
      <button class="pp-btn-seek" onclick="seek(-30)">⏪<span class="lbl">۳۰ ثانیه</span></button>
      <button class="pp-btn-main" id="abPlayBtn" onclick="togglePlay()">▶</button>
      <button class="pp-btn-seek" onclick="seek(30)">⏩<span class="lbl">۳۰ ثانیه</span></button>
    </div>
    <div class="pp-progress-wrap">
      <div class="pp-bar" id="abBar"><div class="pp-bar-fill" id="abBarFill"></div></div>
      <div class="pp-time-row"><span id="abCurrent">۰۰:۰۰</span><span id="abTotal">۰۰:۰۰</span></div>
    </div>
    <audio id="abAudio" src="../${firstSrc}" preload="metadata"></audio>
  </div>
</section>

${chapterListHtml}

<div style="max-width:700px;margin:0 auto;padding:0 1.5rem 3rem;text-align:center">
  <a href="https://t.me/kmketab" target="_blank" class="share-btn">✈️ دنبال کردن کتاب‌باز در تلگرام</a>
</div>

${renderFooter(1)}

<script>
const audio = document.getElementById('abAudio');
const playBtn = document.getElementById('abPlayBtn');
function fmt(sec){sec=Math.max(0,Math.floor(sec||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;const pad=n=>String(n).padStart(2,'0');return h>0?h+':'+pad(m)+':'+pad(s):pad(m)+':'+pad(s);}
function togglePlay(){ if(audio.paused){audio.play();playBtn.textContent='❙❙';} else {audio.pause();playBtn.textContent='▶';} }
function seek(d){ audio.currentTime = Math.max(0, audio.currentTime + d); }
audio.addEventListener('timeupdate',()=>{
  const pct = audio.duration ? (audio.currentTime/audio.duration*100) : 0;
  document.getElementById('abBarFill').style.width = pct+'%';
  document.getElementById('abCurrent').textContent = fmt(audio.currentTime);
});
audio.addEventListener('loadedmetadata',()=>{ document.getElementById('abTotal').textContent = fmt(audio.duration); });
document.getElementById('abBar').onclick = (e)=>{
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = 1 - ((e.clientX-rect.left)/rect.width);
  if(audio.duration) audio.currentTime = ratio*audio.duration;
};
${isChapters ? `
document.querySelectorAll('.ab-chapter-item').forEach(item=>{
  item.onclick = ()=>{
    document.querySelectorAll('.ab-chapter-item').forEach(i=>i.classList.remove('playing'));
    item.classList.add('playing');
    audio.src = item.dataset.src;
    document.getElementById('currentChapterLabel').textContent = item.dataset.title;
    audio.play(); playBtn.textContent='❙❙';
    window.scrollTo({top:0,behavior:'smooth'});
  };
});
audio.addEventListener('ended', ()=>{
  const items = Array.from(document.querySelectorAll('.ab-chapter-item'));
  const current = items.findIndex(i=>i.classList.contains('playing'));
  if(current >= 0 && current < items.length-1){ items[current+1].click(); }
  else { playBtn.textContent='▶'; }
});` : `audio.addEventListener('ended',()=>{ playBtn.textContent='▶'; });`}
</script>
${revealScript()}
</body>
</html>`;
  write(audiobookUrl(ab), html);
  console.log(`✓ صفحه پخش ${ab.title} ساخته شد`);
}
audiobooks.forEach(buildAudiobookPage);

// ═══════════════════════════════════════════════════════
// صفحه اصلی  →  dist/index.html
// ═══════════════════════════════════════════════════════
function buildHomePage() {
  const latest = booksByNewest.slice(0, 6);
  const latestCardsHtml = latest.map(b => bookCardHtml(b, 0)).join('\n');

  const factsHtml = facts.map((f, i) => `
  <div class="fact-card reveal" data-num="${i+1}">
    <div class="fact-icon">${f.icon}</div>
    <h3>${escapeHtml(f.title)}</h3>
    <p>${escapeHtml(f.text)}</p>
    <span class="fact-tag">${escapeHtml(f.tag)}</span>
  </div>`).join('');

  const excerptsHtml = excerpts.map(e => `
  <div class="excerpt-card reveal">
    <div class="excerpt-header">
      <div class="excerpt-cover" style="background:${e.coverBg}">${e.cover}</div>
      <div class="excerpt-book-info">
        <div class="excerpt-book-title">${escapeHtml(e.title)}</div>
        <div class="excerpt-book-author">✍️ ${escapeHtml(e.author)}</div>
      </div>
      <div class="excerpt-rating-big"><div class="num">${e.rating}</div><div class="lbl">امتیاز</div></div>
    </div>
    <div class="excerpt-quotes">${e.quotes.map(q => `<div class="excerpt-quote">${escapeHtml(q)}</div>`).join('')}</div>
  </div>`).join('');

  // نوار اسکرول کتاب‌های پرطرفدار
  const stripColors = ['linear-gradient(135deg,#1E5C9E,#8b1a2f)','linear-gradient(135deg,#1a3a5c,#2e7d9e)','linear-gradient(135deg,#194878,#5A8FB5)','linear-gradient(135deg,#0D2A4A,#194878)','linear-gradient(135deg,#11569A,#1873C4)'];
  const stripBooksData = [
    {title:'صد سال تنهایی', author:'مارکز', emoji:'🦋'}, {title:'مزرعه حیوانات', author:'اورول', emoji:'🐷'},
    {title:'گتسبی بزرگ', author:'فیتزجرالد', emoji:'🥂'}, {title:'کیمیاگر', author:'پائولو کوئلیو', emoji:'✨'},
    {title:'برادران کارامازوف', author:'داستایفسکی', emoji:'📿'}, {title:'هری پاتر', author:'جی کی رولینگ', emoji:'🧙'},
    {title:'شازده کوچولو', author:'سنت اگزوپری', emoji:'🌹'}, {title:'آنا کارنینا', author:'تولستوی', emoji:'🎭'}
  ];
  function stripChips(arr) {
    return [...arr, ...arr].map((b, i) => `
    <div class="book-chip">
      <div class="book-chip-cover" style="background:${stripColors[i % stripColors.length]}">${b.emoji}</div>
      <div class="book-chip-info">
        <div class="book-chip-title">${escapeHtml(b.title)}</div>
        <div class="book-chip-author">${escapeHtml(b.author)}</div>
        <div class="book-chip-rating">★★★★★</div>
      </div>
    </div>`).join('');
  }

  const f = podcast.featured;

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
${renderHead({
  title: 'کتاب‌باز | معرفی، نقد و خلاصه کتاب فارسی و ترجمه',
  description: 'کتاب‌باز؛ کانال تلگرامی معرفی و نقد کتاب. خلاصه، نقد، گزیده و پادکست بهترین کتاب‌های رمان، تاریخ، فلسفه، توسعه فردی و شعر فارسی و ترجمه.',
  canonicalPath: '',
  jsonLd: { "@context":"https://schema.org","@type":"WebSite","name":"کتاب‌باز","url":SITE_URL,"inLanguage":"fa-IR","sameAs":["https://t.me/kmketab"] },
  depth: 0
})}
</head>
<body>
${renderNav(0, '')}

<section class="hero" id="top">
  <div class="hero-particles" id="particles"></div>
  <div class="hero-content">
    <div class="hero-badge">📚 کانال تلگرامی کتاب‌باز</div>
    <h1>دنیای<span>کتاب‌باز</span></h1>
    <p class="hero-sub">با ما سفری به دنیای کلمات، ایده‌ها و داستان‌ها داشته باشید. بهترین کتاب‌ها را کشف، بخوانید و به اشتراک بگذارید.</p>
    <div class="hero-btns">
      <a href="books.html" class="btn-primary pulse">🔍 کاوش کتاب‌ها</a>
      <a href="https://t.me/kmketab" target="_blank" class="btn-outline">✈️ ورود به کانال</a>
    </div>
    <div class="hero-stats">
      <div class="stat"><div class="stat-num">${books.length}+</div><div class="stat-lbl">کتاب معرفی‌شده</div></div>
      <div class="stat"><div class="stat-num">۵</div><div class="stat-lbl">دسته‌بندی</div></div>
      <div class="stat"><div class="stat-num">۴.۸</div><div class="stat-lbl">میانگین امتیاز</div></div>
      <div class="stat"><div class="stat-num">۱۵K+</div><div class="stat-lbl">مخاطب فعال</div></div>
    </div>
  </div>
</section>

<div class="books-strip-section">
  <p class="strip-title">✦ کتاب‌های پرطرفدار ✦</p>
  <div class="strip-track-wrap">
    <div class="strip-track">${stripChips(stripBooksData)}</div>
    <div class="strip-track reverse">${stripChips([...stripBooksData].reverse())}</div>
  </div>
</div>

<section class="library-section" id="library">
  <div class="section-inner">
    <div class="latest-books-bar reveal">
      <div>
        <div class="section-label">📚 تازه‌ترین‌ها</div>
        <h2 class="section-title">جدیدترین کتاب‌های معرفی‌شده</h2>
      </div>
      <a href="books.html" class="view-all-link">مشاهده همه کتاب‌ها ←</a>
    </div>
    <div class="books-grid">${latestCardsHtml}</div>
  </div>
</section>

<section class="facts-section" id="facts">
  <div class="section-inner">
    <div class="reveal">
      <div class="section-label">💡 حقایق</div>
      <h2 class="section-title">حقایق و حاشیه‌های جالب کتاب</h2>
      <p class="section-desc">چیزهایی که شاید درباره کتاب‌ها و نویسندگان ندانید.</p>
    </div>
    <div class="facts-grid">${factsHtml}</div>
  </div>
</section>

<section class="excerpts-section" id="excerpts">
  <div class="section-inner">
    <div class="reveal">
      <div class="section-label">📝 گزیده</div>
      <h2 class="section-title">گزیده و بخش‌های ماندگار</h2>
      <p class="section-desc">برترین جملات و بخش‌های کلیدی از کتاب‌های برگزیده.</p>
    </div>
    <div class="excerpts-grid">${excerptsHtml}</div>
  </div>
</section>

<section id="podcast">
  <div class="section-inner" style="text-align:center">
    <div class="section-label" style="justify-content:center">🎙️ پادکست</div>
    <h2 class="section-title">پادکست معرفی کتاب</h2>
    <p class="section-desc" style="margin:0 auto 2rem">هر هفته یک کتاب را با صدا کاوش می‌کنیم.</p>
    <a href="podcast.html" class="podcast-teaser-card">
      <div class="podcast-teaser-cover">🎧</div>
      <div class="podcast-teaser-info">
        <span class="podcast-teaser-label">قسمت تازه</span>
        <div class="podcast-teaser-title">${escapeHtml(f.title)}</div>
        <div class="podcast-teaser-desc">${escapeHtml(f.desc.slice(0,80))}...</div>
      </div>
      <div class="podcast-teaser-arrow">▶</div>
    </a>
  </div>
</section>

<div class="cta-band">
  <h2>🎧 کتاب‌های صوتی هم داریم</h2>
  <p>وقتی وقت خواندن نداری، بگذار کتاب برایت خوانده شود.</p>
  <a href="audiobooks.html" class="btn-primary" style="text-decoration:none;display:inline-block">🎧 مشاهده کتاب‌های صوتی</a>
</div>

${renderFooter(0)}

<script>
(function(){const c=document.getElementById('particles');for(let i=0;i<30;i++){const s=document.createElement('span');s.style.cssText='left:'+(Math.random()*100)+'%;width:'+(Math.random()*5+2)+'px;height:'+(Math.random()*5+2)+'px;animation-duration:'+(Math.random()*15+8)+'s;animation-delay:'+(Math.random()*10)+'s;opacity:'+(Math.random()*0.6+0.2);c.appendChild(s);}})();
</script>
${revealScript()}
</body>
</html>`;
  write('index.html', html);
  console.log('✓ صفحه index.html ساخته شد');
}
buildHomePage();

// ═══════════════════════════════════════════════════════
// sitemap.xml — همیشه خودکار از روی دیتای فعلی ساخته می‌شود
// (هیچوقت دستی ویرایش نکن — هر بار build از نو می‌سازدش)
// ═══════════════════════════════════════════════════════
function buildSitemap() {
  const staticUrls = [
    { loc: '', priority: '1.0', changefreq: 'daily' },
    { loc: 'books.html', priority: '0.9', changefreq: 'daily' },
    { loc: 'podcast.html', priority: '0.7', changefreq: 'weekly' },
    { loc: 'audiobooks.html', priority: '0.7', changefreq: 'weekly' }
  ];
  const bookUrls = books.map(b => ({ loc: bookUrl(b), priority: '0.8', changefreq: 'monthly', lastmod: b.date }));
  const audiobookUrls = audiobooks.map(b => ({ loc: audiobookUrl(b), priority: '0.6', changefreq: 'monthly' }));

  const all = [...staticUrls, ...bookUrls, ...audiobookUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url>
    <loc>${SITE_URL}/${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  write('sitemap.xml', xml);
  console.log(`✓ sitemap.xml ساخته شد (${all.length} URL)`);
}
buildSitemap();

function buildRobots() {
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  console.log('✓ robots.txt ساخته شد');
}
buildRobots();

// ═══════════════════════════════════════════════════════
// کپی فایل‌های ثابت (CSS, PDF ها، فایل‌های صوتی)
// ═══════════════════════════════════════════════════════
copyDir(path.join(ROOT, 'static'), path.join(DIST, 'static'));
copyDir(path.join(ROOT, 'files'), path.join(DIST, 'files'));
copyDir(path.join(ROOT, 'audio'), path.join(DIST, 'audio'));
console.log('✓ فایل‌های ثابت (CSS/PDF/Audio) کپی شدند');

console.log('\n🎉 ساخت سایت با موفقیت کامل شد — خروجی در پوشه dist/');
