// 카드 렌더링: 건수에 따라 레이아웃 자동 선택.
//  - 2건 이상: 흰 배경 + "오늘의 소셜매치!" + 가로 카드 목록(왼쪽 구장사진 / 오른쪽 키컬러 블록: 구장명+시간)
//  - 1건    : 구장 사진 전체 배경 + TODAY'S SOCIAL MATCH + 하단 띠 (사진이 저해상도면 흐림배경+사진 띠로 대체)
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = path.join(ROOT, 'photos');
const C = '#FF445F'; // 아이엠그라운드 로고 키컬러(rgb 255,68,95)

export const hm = (s) => s.slice(11, 16);
export const sortKey = (m) => { const h = +hm(m.start_at).slice(0, 2); return (h < 6 ? h + 24 : h) * 60 + +hm(m.start_at).slice(3); };
export const short = (n) => (n || '').replace(/로꼬\s?풋살스타디움/g, '').replace(/풋살스타디움/g, '').replace(/실내풋살장/g, '').replace(/\s+/g, ' ').trim().replace(/점$/, '');
export const venueName = (m) => `${short(m.facility_name)} ${m.stadium_name}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const photoFiles = fs.existsSync(PHOTO_DIR) ? fs.readdirSync(PHOTO_DIR) : [];
const strip = (f) => f.replace(/^\d+_/, '').replace(/\.\w+$/, '');
const cache = new Map();
export const missingPhotos = new Set();
function photoFor(m) {
  const fac = m.facility_name.replace(/\s+/g, '');
  const exact = photoFiles.find((x) => strip(x) === `${fac}_${m.stadium_name}`);
  const sameFac = photoFiles.find((x) => strip(x).startsWith(fac + '_'));
  const f = exact || sameFac || photoFiles.find((x) => strip(x) === 'default') || photoFiles[0];
  if (!exact) missingPhotos.add(`${m.facility_name} ${m.stadium_name}${sameFac ? ' (같은 시설 다른 구장 사진으로 대체)' : ' (기본 사진으로 대체)'}`);
  if (!f) return '';
  if (!cache.has(f)) cache.set(f, 'data:image/jpeg;base64,' + fs.readFileSync(path.join(PHOTO_DIR, f)).toString('base64'));
  return cache.get(f);
}
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'logo.png')).toString('base64');

function jpegHeight(dataUrl) {
  const b = Buffer.from(dataUrl.split(',')[1], 'base64');
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const mk = b[i + 1];
    if (mk >= 0xc0 && mk <= 0xc3) return b.readUInt16BE(i + 5);
    i += 2 + b.readUInt16BE(i + 2);
  }
  return 0;
}

function courtSvg(H) {
  return `<svg width="1080" height="${H}" viewBox="0 0 1080 ${H}" style="position:absolute;left:0;top:0" fill="none" stroke="${C}" stroke-opacity=".13" stroke-width="5">
<line x1="-20" y1="${H * 0.5}" x2="1100" y2="${H * 0.5}"/>
<circle cx="540" cy="${H * 0.5}" r="230"/>
<circle cx="540" cy="${H * 0.5}" r="14" fill="${C}" fill-opacity=".13" stroke="none"/>
<path d="M 240 -10 A 300 300 0 0 0 840 -10"/>
<path d="M 240 ${H + 10} A 300 300 0 0 1 840 ${H + 10}"/>
<rect x="-60" y="${H * 0.5 - 300}" width="150" height="600" rx="4" stroke-opacity=".07"/>
<rect x="990" y="${H * 0.5 - 300}" width="150" height="600" rx="4" stroke-opacity=".07"/>
</svg>`;
}

function listHtml(matches, S) {
  const H = S ? 1920 : 1350;
  const MAX = S ? 5 : 4;
  const shown = matches.slice(0, MAX), more = matches.length - shown.length;
  const LOGO_TOP = S ? 150 : 56, LOGO_H = S ? 56 : 46;
  const TITLE_SIZE = S ? 92 : 70;
  const TITLE_TOP = LOGO_TOP + LOGO_H + (S ? 56 : 30);
  const BOTTOM_SAFE = S ? 290 : 90; // 스토리: 하단 UI/링크 스티커 영역 비움
  const GAP = S ? 34 : 24;
  const moreH = more > 0 ? 64 : 0;
  const availTop = TITLE_TOP + Math.round(TITLE_SIZE * 1.15) + (S ? 70 : 36);
  const avail = H - BOTTOM_SAFE - availTop;
  const n = shown.length;
  const rowCap = n === 2 ? (S ? 230 : 190) : (S ? 190 : 150);
  const rowH = Math.min(rowCap, Math.floor((avail - (n - 1) * GAP - moreH) / n));
  const listH = n * rowH + (n - 1) * GAP + moreH;
  const cardTop = availTop + Math.floor((avail - listH) / 2);
  const W = 1080 - 128;
  const blockW = Math.round(W * 0.4);
  const textPadL = Math.round(rowH * 0.34);
  const nameMax = blockW - textPadL - 22;
  const fs_ = Math.min(rowH, S ? 200 : 160);

  const rows = shown.map((m) => {
    const name = venueName(m);
    const nf = Math.min(Math.round(fs_ * 0.19), Math.floor(nameMax / name.length));
    return `<div class="r"><div class="ph" style="background-image:url('${photoFor(m)}')"></div>
<div class="blk"><b style="font-size:${nf}px">${esc(name)}</b><em>${hm(m.start_at)}</em></div></div>`;
  }).join('');

  return `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=block">
<style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:${H}px;background:radial-gradient(90% 55% at 50% 0%,#ffffff 0%,#f2f2f3 60%,#e9e9eb 100%);font-family:"Noto Sans KR","Malgun Gothic",sans-serif;position:relative;overflow:hidden;color:#fff}
.logo{position:absolute;left:0;right:0;top:${LOGO_TOP}px;text-align:center}
.logo img{height:${LOGO_H}px}
.card{position:absolute;left:64px;right:64px;top:${cardTop}px;height:${listH}px}
.r{position:relative;height:${rowH}px;margin-bottom:${GAP}px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 12px 30px rgba(20,20,30,.16)}
.ph{position:absolute;left:0;top:0;bottom:0;right:${blockW - Math.round(blockW * 0.14)}px;background:#ccc center/cover}
.blk{position:absolute;right:0;top:0;bottom:0;width:${blockW}px;background:${C};clip-path:polygon(14% 0,100% 0,100% 100%,0 100%);display:flex;flex-direction:column;justify-content:center;padding-left:${textPadL}px;padding-right:20px}
.blk b{display:block;white-space:nowrap;font-weight:700;line-height:1.15}
.blk em{font-style:normal;font-family:"Poppins",sans-serif;font-weight:800;font-size:${Math.round(fs_ * 0.36)}px;line-height:1.05;letter-spacing:-1px;margin-top:${Math.round(fs_ * 0.03)}px}
.more{text-align:center;font-size:28px;font-weight:700;color:${C};padding-top:14px}
.title{position:absolute;left:0;right:0;top:${TITLE_TOP}px;text-align:center;font-family:'Black Han Sans','Noto Sans KR','Malgun Gothic',sans-serif;font-size:${TITLE_SIZE}px;line-height:1.1;color:#17171b;letter-spacing:-1px}
.title b{color:${C};font-weight:400}
</style><body>
${courtSvg(H)}
<div class="logo"><img src="${logo}"></div>
<div class="title">오늘의 소셜매치<b>!</b></div>
<div class="card">${rows}${more > 0 ? `<div class="more">+ ${more}개 매치 더보기</div>` : ''}</div>
</body>`;
}

function heroHtml(m, S) {
  const H = S ? 1920 : 1350;
  const LT = S ? 150 : 56, LH = S ? 56 : 46;
  const name = venueName(m);
  const ph = photoFor(m);
  const lowRes = jpegHeight(ph) < 1000; // 세로 1000px 미만은 전체 배경으로 늘리면 흐림 → 흐림 배경 + 사진 띠
  const rH = S ? 190 : 150, rBottom = H - (S ? 290 : 90), rTop = rBottom - rH, bW = Math.round((1080 - 128) * 0.4);
  const nF = Math.min(Math.round(Math.min(rH, 200) * 0.19), Math.floor((bW - Math.round(rH * 0.34) - 22) / name.length));

  if (!lowRes) {
    return `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Noto+Sans+KR:wght@400;700&display=block">
<style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:${H}px;background:#222;position:relative;overflow:hidden;color:#fff;font-family:"Poppins","Noto Sans KR","Malgun Gothic",sans-serif}
.ph{position:absolute;inset:0;background:url('${ph}') center/cover}
.ph:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.5) 0%,rgba(0,0,0,.1) 30%,rgba(0,0,0,.16) 100%)}
.logo{position:absolute;left:0;right:0;top:${LT}px;text-align:center}
.logo img{height:${LH}px;filter:brightness(0) invert(1) drop-shadow(0 2px 10px rgba(0,0,0,.45))}
.kick{position:absolute;left:0;right:0;top:${S ? 275 : 150}px;text-align:center;font-weight:700;font-size:50px;letter-spacing:12px;text-shadow:0 2px 14px rgba(0,0,0,.55)}
.match{position:absolute;left:0;right:0;top:${S ? 325 : 195}px;text-align:center;font-weight:800;font-size:292px;line-height:1.1;letter-spacing:-8px;text-shadow:0 6px 40px rgba(0,0,0,.35)}
.r{position:absolute;left:64px;right:64px;top:${rTop}px;height:${rH}px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 12px 30px rgba(0,0,0,.35)}
.rp{position:absolute;left:0;top:0;bottom:0;right:${bW - Math.round(bW * 0.14)}px;background:#ccc url('${ph}') center/cover}
.blk{position:absolute;right:0;top:0;bottom:0;width:${bW}px;background:${C};clip-path:polygon(14% 0,100% 0,100% 100%,0 100%);display:flex;flex-direction:column;justify-content:center;padding-left:${Math.round(rH * 0.34)}px;padding-right:20px;font-family:"Noto Sans KR","Malgun Gothic",sans-serif}
.blk b{display:block;white-space:nowrap;font-weight:700;line-height:1.15;font-size:${nF}px}
.blk em{font-style:normal;font-family:"Poppins",sans-serif;font-weight:800;font-size:${Math.round(Math.min(rH, 200) * 0.36)}px;line-height:1.05;letter-spacing:-1px}
</style><body>
<div class="ph"></div>
<div class="logo"><img src="${logo}"></div>
<div class="kick">TODAY'S SOCIAL</div>
<div class="match">MATCH</div>
<div class="r"><div class="rp"></div><div class="blk"><b>${esc(name)}</b><em>${hm(m.start_at)}</em></div></div>
</body>`;
  }

  const TT = LT + LH + (S ? 56 : 30), TS = S ? 92 : 70;
  const bandTop = TT + Math.round(TS * 1.15) + (S ? 70 : 40);
  const bandH = S ? 760 : 560;
  const nameTop = bandTop + bandH + (S ? 70 : 40);
  const nameFs = Math.min(S ? 124 : 92, Math.floor(920 / name.length));
  const timeTop = nameTop + Math.round(nameFs * 1.25) + (S ? 30 : 18);
  return `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=block">
<style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:${H}px;background:#111;position:relative;overflow:hidden;color:#fff;font-family:"Noto Sans KR","Malgun Gothic",sans-serif}
.bg{position:absolute;inset:-60px;background:url('${ph}') center/cover;filter:blur(38px) brightness(.55) saturate(1.1)}
.logo{position:absolute;left:0;right:0;top:${LT}px;text-align:center}
.logo img{height:${LH}px;filter:brightness(0) invert(1)}
.title{position:absolute;left:0;right:0;top:${TT}px;text-align:center;font-family:'Black Han Sans','Noto Sans KR',sans-serif;font-size:${TS}px;line-height:1.1;letter-spacing:-1px}
.title b{color:${C};font-weight:400}
.band{position:absolute;left:0;right:0;top:${bandTop}px;height:${bandH}px;background:#222 url('${ph}') center/cover;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.name{position:absolute;left:0;right:0;top:${nameTop}px;text-align:center;font-family:'Black Han Sans','Noto Sans KR',sans-serif;font-size:${nameFs}px;line-height:1.2;white-space:nowrap}
.time{position:absolute;left:0;right:0;top:${timeTop}px;text-align:center}
.time span{display:inline-block;background:${C};padding:${S ? 6 : 4}px ${S ? 60 : 44}px;border-radius:14px;font-family:'Poppins',sans-serif;font-weight:800;font-size:${S ? 118 : 86}px;line-height:1.15;letter-spacing:-2px;transform:skewX(-8deg)}
</style><body>
<div class="bg"></div>
<div class="logo"><img src="${logo}"></div>
<div class="title">오늘의 소셜매치<b>!</b></div>
<div class="band"></div>
<div class="name">${esc(name)}</div>
<div class="time"><span>${hm(m.start_at)}</span></div>
</body>`;
}

async function launch() {
  const local = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
  const exe = process.env.CHROME_PATH || (fs.existsSync(local) ? local : undefined);
  return chromium.launch(exe ? { executablePath: exe } : {});
}

/** matches: 모집 마감 제외된 매치(시간순). outDir에 feed.jpg / story.jpg 저장 */
export async function renderDay(matches, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const files = {};
  try {
    for (const [kind, S] of [['feed', false], ['story', true]]) {
      const H = S ? 1920 : 1350;
      const html = matches.length === 1 ? heroHtml(matches[0], S) : listHtml(matches, S);
      const page = await browser.newPage({ viewport: { width: 1080, height: H }, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(outDir, `${kind}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
      await page.close();
      files[kind] = file;
    }
  } finally {
    await browser.close();
  }
  return files;
}
