// 사용: node src/run.mjs generate | publish     (env: DAY=YYYY-MM-DD 로 날짜 지정 가능, 기본은 오늘 KST)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDay, sortKey, missingPhotos } from './render.mjs';
import { buildCaption } from './caption.mjs';
import { publishFeed, publishStory, waitForImage } from './publish.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.iamground.kr';
const pad = (n) => String(n).padStart(2, '0');
const kst = new Date(Date.now() + 9 * 3600e3);
const DAY = process.env.DAY || `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
const dir = path.join(ROOT, 'posts', DAY);
const cmd = process.argv[2];

async function fetchDay(date) {
  const out = [];
  for (let p = 0; p < 6; p++) {
    const j = await (await fetch(`${API}/api/v1/landings/social-matches?search_date=${date}&size=100&page=${p}`)).json();
    if (!j.data) break;
    out.push(...(j.data.list || []));
    if (p + 1 >= (j.data.total_pages || 1)) break;
  }
  return out;
}

if (cmd === 'generate') {
  const all = await fetchDay(DAY);
  const open = all.filter((m) => m.recruit_status !== 'CLOSED').sort((a, b) => sortKey(a) - sortKey(b));
  fs.mkdirSync(dir, { recursive: true });
  if (!open.length) {
    fs.writeFileSync(path.join(dir, 'skip.json'), JSON.stringify({ day: DAY, total: all.length, reason: all.length ? '모집 중인 매치 없음(전부 마감)' : '매치 없음' }));
    console.log(`SKIP ${DAY}: ${all.length ? '전부 마감' : '매치 없음'}`);
    process.exit(0);
  }
  fs.rmSync(path.join(dir, 'skip.json'), { force: true });
  await renderDay(open, dir);
  fs.writeFileSync(path.join(dir, 'caption.txt'), buildCaption(DAY, open));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ day: DAY, total: all.length, open: open.length }, null, 2));
  console.log(`GENERATED ${DAY}: total=${all.length} open=${open.length}`);
  if (missingPhotos.size) console.log('::warning::사진 없는 구장 → 대체 사진 사용: ' + [...missingPhotos].join(', '));
  process.exit(0);
}

if (cmd === 'publish') {
  if (fs.existsSync(path.join(dir, 'skip.json')) || !fs.existsSync(path.join(dir, 'feed.jpg'))) { console.log('SKIP publish: 게시할 이미지 없음'); process.exit(0); }
  if (fs.existsSync(path.join(dir, 'posted.json'))) { console.log('SKIP publish: 이미 게시됨 ' + fs.readFileSync(path.join(dir, 'posted.json'), 'utf8')); process.exit(0); }
  if (process.env.PUBLISH !== 'true') { console.log('DRY-RUN: PUBLISH=true 가 아니라서 게시하지 않음 (이미지는 posts/' + DAY + ' 에 있음)'); process.exit(0); }

  const { IG_ACCESS_TOKEN: T, IG_USER_ID: ID, REPO, BRANCH } = process.env;
  if (!T || !ID || !REPO) { console.error('IG_ACCESS_TOKEN / IG_USER_ID / REPO 필요'); process.exit(1); }

  // 사전 점검: 토큰 권한/만료 확인 (토큰 값은 출력하지 않음)
  const dbg = await (await fetch(`https://graph.facebook.com/v21.0/debug_token?${new URLSearchParams({ input_token: T, access_token: T })}`)).json();
  if (dbg.error || !dbg.data) { console.error('토큰 점검 실패:', dbg.error?.message || '알 수 없음'); process.exit(1); }
  const scopes = dbg.data.scopes || [];
  console.log('토큰 유형:', dbg.data.type, '| 유효:', dbg.data.is_valid, '| 만료:', dbg.data.expires_at ? new Date(dbg.data.expires_at * 1000).toISOString() : '무기한');
  console.log('토큰 권한:', scopes.join(', '));
  const need = ['instagram_basic', 'instagram_content_publish'].filter((s) => !scopes.includes(s));
  if (!dbg.data.is_valid || need.length) { console.error('토큰에 필요한 권한이 없음: ' + need.join(', ') + ' → 시스템 사용자에서 토큰을 다시 발급해 IG_ACCESS_TOKEN 시크릿을 교체하세요'); process.exit(1); }

  // 오전 10:00(KST)까지 대기 (예약 실행이 일찍 시작된 경우). 최대 50분.
  const target = new Date(`${DAY}T10:00:00+09:00`).getTime();
  const waitMs = Math.min(target - Date.now(), 50 * 60e3);
  if (waitMs > 0) { console.log(`10:00 KST까지 ${Math.round(waitMs / 1000)}초 대기`); await new Promise((r) => setTimeout(r, waitMs)); }

  const base = `https://raw.githubusercontent.com/${REPO}/${BRANCH || 'main'}/posts/${DAY}`;
  await waitForImage(`${base}/feed.jpg`);
  await waitForImage(`${base}/story.jpg`);
  const caption = fs.readFileSync(path.join(dir, 'caption.txt'), 'utf8');

  const feedId = await publishFeed(ID, T, `${base}/feed.jpg`, caption);
  console.log('PUBLISHED feed', feedId);
  fs.writeFileSync(path.join(dir, 'posted.json'), JSON.stringify({ feed: feedId, at: new Date().toISOString() })); // 스토리 실패해도 피드 중복 방지
  const storyId = await publishStory(ID, T, `${base}/story.jpg`);
  console.log('PUBLISHED story', storyId);
  fs.writeFileSync(path.join(dir, 'posted.json'), JSON.stringify({ feed: feedId, story: storyId, at: new Date().toISOString() }));
  process.exit(0);
}

console.error('usage: node src/run.mjs generate|publish');
process.exit(1);
