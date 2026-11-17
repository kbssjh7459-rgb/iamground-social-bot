# iamground-social-bot

아이엠그라운드 소셜매치 일일 인스타 자동 게시 (피드 + 스토리, 매일 10:00 KST).

## 동작
1. `api.iamground.kr`에서 오늘 소셜매치 조회 → **모집 마감(CLOSED) 매치는 제외**
2. 매치 0건(또는 전부 마감)이면 게시 건너뜀
3. 피드(1080×1350) / 스토리(1080×1920) JPEG 렌더링 + 캡션 생성 → `posts/YYYY-MM-DD/` 커밋(공개 이미지 URL용)
4. 10:00 KST까지 대기 후 Instagram Graph API로 피드 → 스토리 순서로 게시, `posted.json` 기록(중복 방지)

레이아웃: 2건 이상 = 흰 배경 카드 목록 / 1건 = 구장 사진 강조(저해상도 사진은 흐림 배경 + 사진 띠로 자동 대체)

## 설정 (1회)
- Settings → Secrets and variables → Actions
  - **Secrets**: `IG_ACCESS_TOKEN`, `IG_USER_ID`
  - **Variables**: `AUTOPOST_ENABLED` = `true` ← 이걸 켜기 전에는 예약 실행이 이미지 생성/커밋까지만 하고 게시하지 않음
- Settings → Actions → General → Workflow permissions → **Read and write permissions**
- 레포는 **public** 이어야 인스타가 이미지 URL을 가져갈 수 있음

## 수동 실행
Actions → daily-social-post → Run workflow
- `day`: 비우면 오늘(KST)
- `publish`: `false`(기본) = 이미지만 생성 / `true` = 실제 게시

## 새 구장이 열리면
`photos/`에 `NN_시설명(공백제거)_구장명.jpg` 형식으로 사진 추가. 없으면 같은 시설의 다른 사진 또는 기본 사진으로 대체되고, 실행 로그에 경고가 남음.
(해상도는 가로 2048×1024 이상 권장. 세로 1000px 미만은 1건인 날 흐림 배경 방식으로 표시됨)

## 로컬 테스트
```
npm install
DAY=2026-11-25 node src/run.mjs generate
```
