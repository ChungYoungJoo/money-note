# 머니노트 (money-note)

매일 쓴 카드·현금 내역을 카테고리별로 적고, **일별 합계 / 월별 카테고리 합계 / 월별 총 사용금액**을 보는 개인 가계부 웹앱.

- 빌드 도구 없음 — 순수 HTML + CSS + ES 모듈
- 저장소: Supabase (설정 전에는 브라우저 localStorage로 동작)
- 모바일 우선 화면 (휴대폰에서 한 손으로 입력)

## 화면

| 탭 | 하는 일 |
| --- | --- |
| 입력 | 숫자 키패드로 금액 → 카테고리 → 카드/현금 → (선택) 메모 → 저장. 날짜는 기본 오늘. |
| 일별 | 하루 내역과 그날 합계(카드/현금 구분), 그 달의 날짜별 합계 목록. 내역을 누르면 수정. |
| 월별 | 그 달 총 사용금액, 카테고리별 합계와 비율, 카드/현금 비교, 가장 많이 쓴 날. |
| 설정 | 카테고리 추가·이름변경·순서·삭제, CSV/JSON 내보내기, JSON 가져오기. |

## 처음 설정

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 새 프로젝트 생성 (Region은 `Northeast Asia (Seoul)` 권장)
2. 대시보드 > **SQL Editor** 에 [`supabase/schema.sql`](supabase/schema.sql) 전체를 붙여넣고 실행
3. 대시보드 > **Project Settings > API** 에서 두 값을 복사
   - `Project URL`
   - `Project API keys` 의 **anon public** 키

### 2. 앱에 연결하기

`docs/js/config.js` 의 두 줄을 채운다.

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

비워 두면 이 브라우저에만 저장하는 **로컬 저장 모드**로 동작한다(상단에 `로컬 저장` 배지 표시).
로컬로 먼저 쓰다가 Supabase를 붙이려면 **설정 > JSON 내보내기** → config.js 채우기 → **JSON 가져오기** 순서로 옮긴다.

### 3. 로컬에서 확인

이 PC에는 Node/Python이 없어 `index.html` 을 파일로 바로 열면 ES 모듈이 막힌다. 대신:

```powershell
.\serve.ps1
```

`http://localhost:8080` 이 열린다. 멈추려면 Ctrl+C.

> `이 시스템에서 스크립트를 실행할 수 없으므로...` 오류가 나면 Windows 실행 정책(기본 Restricted) 때문이다.
> `powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1` 로 실행하거나,
> 한 번만 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 을 실행해 두면 된다.

### 4. 배포 (GitHub Pages)

토큰만 있으면 스크립트가 **저장소 생성 → 파일 업로드 → Pages 켜기**까지 다 한다.

1. https://github.com/settings/tokens/new?scopes=repo&description=money-note 에서 classic 토큰 발급 (`repo` 스코프)
2. 실행 (토큰은 화면에 안 보이게 물어본다):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\upload-to-github.ps1
```

이미 만들어 둔 저장소에 올리기만 하려면 `-NoRepoSetup` 을 붙인다.

`git push` 가 막히는 회사 네트워크 때문에 GitHub Contents API로 올린다. 바뀐 파일만 올리고,
프록시 한계(~45KB)에 걸릴 큰 파일은 경고하고 건너뛴다. 그래서 **소스 파일은 20KB 이하로 유지**한다.

배포 주소: `https://chungyoungjoo.github.io/money-note/`

## 폴더 구조

```
docs/                 ← GitHub Pages가 서비스하는 폴더
  index.html
  css/style.css
  js/
    config.js         ← Supabase 주소·키 (여기만 채우면 됨)
    app.js            ← 탭 전환, 화면 다시 그리기
    store.js          ← 데이터 창구 + 집계 함수
    remote.js         ← Supabase(PostgREST) 백엔드
    local.js          ← localStorage 백엔드 (같은 인터페이스)
    defaults.js       ← 기본 카테고리
    util.js           ← 날짜·금액 포맷
    views/            ← entry / daily / monthly / settings
supabase/schema.sql   ← 테이블·정책·기본 카테고리
serve.ps1             ← 로컬 확인용 정적 서버
upload-to-github.ps1  ← 배포
```

## 알아둘 점

- 로그인이 없다. anon 키로 읽고 쓰므로 **배포 URL을 아는 사람은 내역을 보고 고칠 수 있다.** 주소를 공유하지 말 것.
- 금액은 원 단위 정수로만 저장한다(소수점 없음).
- 이미 사용한 카테고리를 삭제하면 과거 내역이 이름을 잃지 않도록 실제로 지우지 않고 보관(`archived`) 처리한다.
