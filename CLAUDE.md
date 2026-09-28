# CLAUDE.md — 머니노트 작업 지침

## 현재 상태 (2026-09-28)

- 배포: https://chungyoungjoo.github.io/money-note/ — Supabase 프로젝트 `secqbdcobmqocznsbftm`
- 사용자가 실제로 쓰기 시작했다 (9/21 기준 2건: 식료품 메모 '버터', '감자마켓-냉동')
- 2026-09-28 **카테고리 자동 분류** 추가 — 아래 전용 항목 참고. 로컬에서 동작 확인 완료, **배포는 아직**
  (사용자가 업로드 토큰을 폐기해서 새 토큰으로 `upload-to-github.ps1` 을 돌려야 한다)
- 사용자 작업 흐름 특징: 지출 대부분이 장보기다. 식료품을 식비로 볼지 생활용품으로 볼지는 학습이 알아서 맞춘다.

개인 가계부 웹앱. 사용자 요구는 단순하다: **카테고리 + 금액을 적으면, 일별 합계 · 월별 카테고리 합계 · 월별 총액이 보인다.**
기능을 늘리기 전에 이 세 가지가 흔들리지 않는지부터 볼 것.

## 환경 제약 (중요)

- 이 PC에는 **Node.js도 Python도 없다.** npm/빌드/테스트 러너를 쓰는 제안은 하지 말 것.
- 로컬 확인은 `.\serve.ps1` (PowerShell HttpListener 정적 서버) → http://localhost:8080.
  `index.html` 을 file:// 로 열면 ES 모듈이 CORS로 막히니 쓰지 말 것.
- **실행 정책이 Restricted(기본값)라 `.\xxx.ps1` 이 바로 안 돌아간다.** 그룹정책 제한은 아니다.
  `powershell -NoProfile -ExecutionPolicy Bypass -File .\upload-to-github.ps1` 로 실행하거나,
  한 번 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 을 해 두면 된다.
- Claude Code 브라우저 패널로 확인하려면 `launch.json` 을 **세션 작업 폴더의 `.claude/` 안**에 둬야 한다.
  (작업 폴더가 `C:\Users\youngjoo.chung\.claude` 일 때는 `C:\Users\youngjoo.chung\.claude\.claude\launch.json`.
  이 저장소의 `.claude/launch.json` 은 참고용 사본이다.)
- 배포는 `git push` 가 아니라 `.\upload-to-github.ps1` (GitHub Contents API).
  회사 프록시가 업로드성 요청을 막고 본문 ~45KB 한계가 있다 → **소스 파일 하나를 20KB 이하로 유지**.
- `.ps1` 은 반드시 **UTF-8 BOM** 으로 저장하고 `[Parser]::ParseFile` 로 검증할 것. (BOM 없으면 CP949로 읽혀 한글이 깨진다)
- 터미널 PowerShell에 git이 없을 수 있다: `$env:Path += ";C:\Program Files\Git\cmd"`.

## 구조

- `docs/` 가 GitHub Pages 루트. 빌드 산출물이 아니라 **직접 편집하는 원본**이다.
- 데이터 접근은 전부 `store.js` 를 거친다. 화면(`views/*`)이 `remote.js`/`local.js` 를 직접 부르지 않는다.
- `remote.js`(Supabase PostgREST)와 `local.js`(localStorage)는 **같은 메서드 이름·같은 행 모양**을 지켜야 한다.
  한쪽만 고치면 config.js 를 비운 상태에서 조용히 깨진다.
- 화면은 `render(root, ctx)` 하나만 내보낸다. `ctx = { store, state, go, refresh }`.
- `app.js:refresh()` 는 매번 `<main id="view">` 를 **새로 만들어 교체**한다. 그래서 화면이 컨테이너에 건
  이벤트 핸들러가 쌓이지 않는다. 화면 안에서 다시 그릴 때 `render()` 를 직접 재귀 호출하지 말고 `ctx.refresh()` 를 쓸 것.

## 카테고리 자동 분류 (`autocat.js`)

메모 → 카테고리 추천. `suggest()` 가 ①메모 전체 학습 ②낱말 학습 ③내장 키워드 사전 순으로 본다.
학습은 `learn()` 이 저장·수정 시점에 호출되어 localStorage 에 쌓는다 (Supabase 테이블을 늘리지 않으려는 선택).

- 낱말 비교는 **양방향 부분일치**다. 한국어는 `순두부집` 을 배우고 `순두부` 라고 적는 일이 잦아서 정확일치만으로는 안 맞는다.
- 사전의 키는 **기본 카테고리 이름 문자열**이다. 사용자가 이름을 바꾸면 그 줄은 자동으로 무시된다(의도된 동작).
- 자동 선택은 `state.entry.categoryTouched` 가 false 일 때만 한다. 사용자가 칩을 직접 누르면 true 가 되어 덮지 않는다.
  수정 모드에서는 아예 동작하지 않는다.
- 왜 규칙 기반인가: 정적 페이지라 서버·LLM 호출이 없다. 대신 고친 결과를 학습해서 쓸수록 맞아 간다.

## 데이터 모델

`categories(id, name, emoji, sort_order, archived, created_at)`
`expenses(id, spent_on date, category_id, amount int > 0, method 'card'|'cash', memo, created_at)`

- 금액은 원 단위 **정수**. 화면에서는 문자열 숫자(`state.entry.amount`)로 다루다 저장할 때 숫자로 바꾼다.
- 날짜는 `'YYYY-MM-DD'` 문자열. `toISOString()` 은 UTC라 하루 밀리므로 쓰지 말고 `util.isoOf()` 를 쓸 것.
- 쓰인 적 있는 카테고리는 삭제 대신 `archived = true`. 과거 내역이 이름을 잃지 않게 하기 위함.
- 집계(일별/카테고리별/결제수단별)는 서버 뷰가 아니라 `store.js` 의 순수 함수로 클라이언트에서 계산한다.
  개인 가계부 규모(월 수백 건)에서는 이게 더 단순하고 충분하다.

## 보안

로그인이 없고 anon 키에 RLS 전체 허용 정책을 준 상태다. 배포 URL을 아는 사람은 내역을 읽고 쓸 수 있다.
공유가 필요해지면 Supabase Auth(매직링크) + `auth.uid()` 기준 정책으로 바꾸는 것이 정공법이다.

## 검증 방법

로컬 실행 확인은 `serve.ps1` + 브라우저 패널로 실제로 눌러 보는 것이 가장 확실하다(2026-09-21 이렇게 검증했다).
배포본이 "반영이 안 된다" 는 말이 나오면 추측하지 말고 파일을 직접 받아 본다 —
`https://chungyoungjoo.github.io/money-note/js/<파일>.js` 를 받아 보면 코드 문제 / 업로드 누락 / 브라우저 캐시가 한 번에 갈린다.

## 아직 없는 것

- 예산/한도 알림, 월 비교(전월 대비), 검색·필터, 고정지출 반복 입력
- **카드 내역 여러 줄 붙여넣기 → 자동 분류해 일괄 등록** (사용자가 관심 보인 항목. 입력 방식이 바뀌는 큰 변경이라 별도 논의)
- 학습 기록을 기기 간 공유하기 (지금은 localStorage 라 폰·PC 가 따로 배운다)
- 로그인, 여러 사용자 공유
