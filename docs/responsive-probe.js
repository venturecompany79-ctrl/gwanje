// Responsive-layout probe — measures layout bugs across viewport × persisted state.
// Run with the dev-browser CLI:  dev-browser --headless --timeout 120 run probe.js
// (Adapt to Playwright/Puppeteer if dev-browser is unavailable — the page.evaluate
//  body is the portable part.)
//
// EDIT CONFIG for your target, then read the ⚠ lines. Every ⚠ is a candidate bug;
// open the implicated element's CSS and confirm before reporting it (verify, don't
// pattern-match).

const CONFIG = {
  base: 'http://localhost:3001',
  // 「관제」의 레이아웃 변형 축. ★ 이 프로젝트에는 localStorage/sessionStorage/쿠키가
  // 단 한 건도 없다(전수 grep 확인) — 앱 셸은 전부 서버 렌더다. 따라서 영속 토글 대신
  // 실제로 레이아웃을 바꾸는 축인 "라우트"와 "빌링 배너 행"을 매트릭스로 돌린다.
  routes: [
    ['dashboard',    '/app'],
    ['companies',    '/app/companies'],
    ['companyDetail','/app/companies/00000000-0000-0000-0000-0000000000c1'],
    ['board',        '/app/board'],
    ['campaigns',    '/app/campaigns'],
    ['notifications','/app/notifications'],
    ['settings',     '/app/settings'],
  ],
  widths: [360, 390, 768, 1280],
  // {} = 빈 상태(기본). banner = 셸에 행을 하나 더 얹는 상태.
  // 데모 모드에선 getSubscriptionGate()가 "off"라 서버가 배너를 못 그리므로
  // app/app/layout.tsx 와 동일한 마크업을 주입해 같은 레이아웃 효과를 재현한다.
  states: [{}, { billingBanner: '1' }],
};


const page = await browser.getPage('probe');

const PROBE = () => {
  const vw = document.documentElement.clientWidth;
  const out = { overflow: null, overWide: [], floaty: [], insetScroll: [] };
  out.overflow = document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : null;
  const seen = new Set();
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const b = e.getBoundingClientRect();
    const key = e.tagName + (e.className ? '.' + e.className.toString().trim().split(/\s+/)[0] : '');
    // 1) rendered wider than viewport, with no scroll container to absorb it
    if (b.width > vw + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll'
        && !/tab|nav|carousel|scroll|marquee/i.test(key) && !seen.has('w' + key)) {
      seen.add('w' + key); out.overWide.push(`${key} = ${Math.round(b.width)}px`);
    }
    // 2) narrow floating box: margin:auto inside a flex parent → shrinks to content,
    //    leaves side gaps, and its scrollbar sits inset from the edge
    const p = e.parentElement;
    if (p) {
      const pp = getComputedStyle(p);
      if ((pp.display === 'flex' || pp.display === 'inline-flex')
          && (cs.marginInlineStart === 'auto' || cs.marginLeft === 'auto' || cs.marginRight === 'auto')
          && b.width < p.clientWidth - 24 && !seen.has('f' + key)) {
        seen.add('f' + key); out.floaty.push(`${key} ${Math.round(b.width)}px inside ${Math.round(p.clientWidth)}px parent`);
      }
    }
    // 3) inner scroll container narrower than the viewport → scrollbar floats mid-screen
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 1
        && e.clientWidth < vw - 8 && !seen.has('s' + key)) {
      seen.add('s' + key); out.insetScroll.push(`${key} clientW ${e.clientWidth} < vw ${vw}`);
    }
  }
  return out;
};

const INJECT_BANNER = () => {
  if (document.querySelector('.billing-banner')) return;
  const main = document.querySelector('.shell-main');
  const content = document.querySelector('.shell-content');
  if (!main || !content) return;
  const a = document.createElement('a');
  a.className = 'billing-banner';
  a.href = '/app/billing';
  a.innerHTML = '<svg width="16" height="16"></svg>결제에 실패했습니다. 서비스 중단을 막으려면 결제수단을 확인해 주세요.<span class="billing-banner-cta">결제 관리 \u2192</span>';
  main.insertBefore(a, content);
};

for (const state of CONFIG.states) {
  for (const [name, path] of CONFIG.routes) {
    for (const w of CONFIG.widths) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(CONFIG.base + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      if (state.billingBanner) { await page.evaluate(INJECT_BANNER); await page.waitForTimeout(200); }
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { e.scrollLeft = 0; }); });
      await page.waitForTimeout(200);
      const r = await page.evaluate(PROBE);
      const bugs = [];
      if (r.overflow) bugs.push(`horizontal overflow: doc ${r.overflow} > vw ${w}`);
      r.overWide.forEach((x) => bugs.push(`over-wide, no scroll container: ${x}`));
      r.floaty.forEach((x) => bugs.push(`narrow floating box (margin:auto in flex): ${x}`));
      r.insetScroll.forEach((x) => bugs.push(`inset scroll container (scrollbar off the edge): ${x}`));
      const tag = `${name} ${w}px state=${JSON.stringify(state)}`;
      if (bugs.length) console.log(`\n=== ${tag} ===\n` + bugs.map((b) => '  \u26a0 ' + b).join('\n'));
      else console.log(`ok  ${tag}`);
    }
  }
}

// Resize WITHOUT reload — reproduces DevTools device-mode. Catches JS that sets a
// layout class on load (from innerWidth/localStorage) but never updates on resize.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(CONFIG.base + '/app/companies', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(400);
const resize = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log('\n=== resize 1280→375 (no reload) ===');
console.log(resize ? '  ⚠ overflow appears only after resize — JS layout state not reacting to width' : '  ok');
