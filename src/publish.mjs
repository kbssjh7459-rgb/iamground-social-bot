// Instagram Graph API 게시 (피드 IMAGE + 스토리 STORIES). 이미지는 공개 URL(JPEG)이어야 한다.
const V = 'v21.0';

async function api(method, p, params, token) {
  const url = new URL(`https://graph.facebook.com/${V}/${p}`);
  const init = { method };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
    url.searchParams.set('access_token', token);
  } else {
    init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams({ ...params, access_token: token });
  }
  const j = await (await fetch(url, init)).json();
  if (j.error) throw new Error(`${p}: ${j.error.message}`);
  return j;
}

export async function waitForImage(url, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    if (r && r.ok && (r.headers.get('content-type') || '').startsWith('image/')) return;
    await new Promise((res) => setTimeout(res, 6000));
  }
  throw new Error('이미지 URL이 공개되지 않음: ' + url);
}

async function createAndPublish(igId, token, params) {
  const c = await api('POST', `${igId}/media`, params, token);
  for (let i = 0; i < 30; i++) {
    const s = await api('GET', c.id, { fields: 'status_code' }, token);
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('컨테이너 상태: ' + s.status_code);
    await new Promise((res) => setTimeout(res, 3000));
  }
  const p = await api('POST', `${igId}/media_publish`, { creation_id: c.id }, token);
  return p.id;
}

export const publishFeed = (igId, token, imageUrl, caption) => createAndPublish(igId, token, { image_url: imageUrl, caption });
export const publishStory = (igId, token, imageUrl) => createAndPublish(igId, token, { media_type: 'STORIES', image_url: imageUrl });
