// 피드 캡션(A안 수정본). 모집 마감 매치는 호출 전에 제외된 상태로 들어온다.
import { hm, venueName } from './render.mjs';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const CLOCK = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
const TAGS = '#아이엠그라운드 #소셜매치 #풋살 #풋살소셜 #혼자풋살 #풋살매치';

export function buildCaption(day, matches) {
  const d = new Date(day + 'T00:00:00Z');
  const lines = matches.map((m) => `${CLOCK[+hm(m.start_at).slice(0, 2) % 12]} ${hm(m.start_at)} ${venueName(m)}`);
  return [
    `⚽ 오늘의 소셜매치 (${d.getUTCMonth() + 1}/${d.getUTCDate()} ${DOW[d.getUTCDay()]})`,
    '',
    ...lines,
    '',
    '혼자 와도, 친구와 크루를 맺고 같이 뛸 수 있는 소셜매치!',
    '신청은 프로필 링크에서 👆',
    '',
    TAGS,
  ].join('\n');
}
