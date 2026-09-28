// 카테고리 자동 분류.
//
// 세 가지를 순서대로 본다.
//   1) 같은 메모로 저장한 적이 있으면 그때 고른 카테고리  (학습)
//   2) 메모 속 낱말로 학습한 이력                          (학습)
//   3) 기본 키워드 사전 (스타벅스 -> 카페/간식 같은 것)     (내장)
// 아무것도 못 찾으면 null. 그때는 마지막에 쓴 카테고리가 그대로 남아 있다.
//
// 학습 기록은 이 브라우저(localStorage)에만 쌓인다. 폰과 PC가 따로 배운다는 뜻이고,
// 지출 내역 자체(Supabase)와는 별개다. 서버 테이블을 늘리지 않으려고 이렇게 두었다.

const LEARN_KEY = 'moneynote.memoLearn.v1';
const LAST_KEY = 'moneynote.lastUsed.v1';
const MAX_KEYS = 600; // 너무 커지지 않게

// 기본 키워드 사전. 왼쪽은 **기본 카테고리 이름**이라, 사용자가 이름을 바꾸거나 지우면
// 그 줄은 자동으로 무시된다(이름으로 현재 카테고리를 찾기 때문).
export const KEYWORDS = {
  '식비': ['식당', '백반', '김밥', '국밥', '분식', '떡볶이', '치킨', '피자', '햄버거', '맥도날드',
    '롯데리아', '버거킹', '맘스터치', '서브웨이', '김치찌개', '순대', '짜장', '중국집', '마라탕',
    '쌀국수', '초밥', '회식', '삼겹살', '고깃집', '곱창', '족발', '보쌈', '배달', '배민', '요기요',
    '쿠팡이츠', '점심', '저녁', '아침', '한식', '일식', '양식', '뷔페', '칼국수', '라멘', '돈까스'],
  '카페/간식': ['스타벅스', '스벅', '투썸', '메가커피', '컴포즈', '빽다방', '이디야', '커피', '카페',
    '아메리카노', '라떼', '아이스크림', '배스킨', '베이커리', '파리바게뜨', '뚜레쥬르', '도넛',
    '빙수', '디저트', '케이크', '마카롱', '탕후루', '간식', '음료'],
  '교통': ['택시', '카카오t', '지하철', '버스', '교통카드', '주유', '기름', '주차', '톨게이트',
    '하이패스', '기차', 'ktx', 'srt', '렌터카', '대리운전', '따릉이', '고속도로', '항공', '비행기'],
  '생활용품': ['다이소', 'gs25', '지에스25', 'cu', '씨유', '세븐일레븐', '편의점', '이마트', '홈플러스',
    '롯데마트', '마트', '쿠팡', '생수', '휴지', '세제', '주방', '수납', '건전지', '청소', '문구'],
  '의료/건강': ['병원', '의원', '약국', '치과', '한의원', '검진', '영양제', '비타민', '진료', '처방',
    '렌즈', '안경', '접종', '물리치료', '정형외과', '이비인후과', '소아과', '피부과'],
  '교육': ['학원', '교재', '문제집', '수업료', '학습지', '등록금', '강의', '서점', '도서', '교육비',
    '온라인강의', '인강', '과외', '독서실', '스터디'],
  '문화/여가': ['영화', 'cgv', '메가박스', '롯데시네마', '넷플릭스', '왓챠', '디즈니플러스', '유튜브프리미엄',
    '공연', '전시', '뮤지컬', '콘서트', '노래방', '볼링', '당구', '피시방', '게임', '놀이공원',
    '에버랜드', '롯데월드', '여행', '숙박', '호텔', '펜션', '캠핑', '수영장', '헬스', '요가', '골프'],
  '의류/미용': ['미용실', '이발', '커트', '염색', '파마', '네일', '올리브영', '화장품', '유니클로',
    '자라', '무신사', '신발', '운동화', '가방', '악세서리', '속옷', '양말', '세탁소', '드라이클리닝'],
  '경조사': ['축의금', '부의금', '조의금', '결혼식', '장례', '돌잔치', '답례품', '선물', '생일선물',
    '명절', '용돈', '기부', '후원'],
  '주거/공과금': ['관리비', '전기요금', '가스요금', '수도요금', '월세', '전세', '난방', '보험료',
    '도시가스', '아파트', '정수기', '렌탈'],
  '통신': ['통신비', '휴대폰요금', '핸드폰요금', '인터넷요금', 'skt', 'kt', 'lg유플러스', '유플러스',
    '알뜰폰', '데이터', '요금제'],
};

function normalize(text) {
  return String(text === null || text === undefined ? '' : text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 메모를 낱말로 쪼갠다. 한 글자짜리는 오탐이 많아 버린다. */
function tokenize(text) {
  return normalize(text)
    .split(/[^0-9a-z가-힣]+/)
    .filter((t) => t.length >= 2);
}

function loadLearn() {
  try {
    const raw = localStorage.getItem(LEARN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveLearn(map) {
  try {
    localStorage.setItem(LEARN_KEY, JSON.stringify(map));
  } catch (_) {
    /* 저장 공간이 없으면 학습만 포기한다. 입력 자체를 막지는 않는다. */
  }
}

/** 메모 하나에서 학습에 쓸 열쇠들. '=' 는 메모 전체, '#' 은 낱말. */
function learnKeys(memo) {
  const keys = [];
  const full = normalize(memo);
  if (full.length >= 2) keys.push('=' + full);
  tokenize(memo).forEach((t) => keys.push('#' + t));
  return keys;
}

function prune(map) {
  const keys = Object.keys(map);
  if (keys.length <= MAX_KEYS) return map;
  // 총 횟수가 적은 열쇠부터 버린다.
  const scored = keys.map((k) => ({
    key: k,
    score: Object.keys(map[k]).reduce((sum, id) => sum + map[k][id], 0),
  }));
  scored.sort((a, b) => a.score - b.score);
  scored.slice(0, keys.length - MAX_KEYS).forEach((s) => delete map[s.key]);
  return map;
}

/** 저장할 때 호출. 메모와 실제로 고른 카테고리를 묶어 기억한다. */
export function learn(memo, categoryId) {
  if (!categoryId) return;
  const map = loadLearn();
  learnKeys(memo).forEach((key) => {
    const bucket = map[key] || (map[key] = {});
    bucket[categoryId] = (bucket[categoryId] || 0) + 1;
  });
  saveLearn(prune(map));
}

function bestOf(bucket, allowed) {
  if (!bucket) return null;
  let bestId = null;
  let bestCount = 0;
  Object.keys(bucket).forEach((id) => {
    if (!allowed.has(id)) return; // 지워졌거나 보관된 카테고리는 건너뛴다
    if (bucket[id] > bestCount) {
      bestCount = bucket[id];
      bestId = id;
    }
  });
  return bestId ? { id: bestId, count: bestCount } : null;
}

function dictionaryMatch(memo, categories) {
  const full = normalize(memo);
  const words = tokenize(memo);
  const byName = new Map(categories.map((c) => [c.name, c]));
  let best = null;

  Object.keys(KEYWORDS).forEach((catName) => {
    const category = byName.get(catName);
    if (!category) return; // 사용자가 이름을 바꿨거나 지운 카테고리
    KEYWORDS[catName].forEach((word) => {
      // 영문·숫자만으로 된 짧은 키워드(kt 등)는 낱말이 정확히 같을 때만 인정한다.
      const asciiOnly = /^[0-9a-z]+$/.test(word);
      const hit = asciiOnly ? words.indexOf(word) !== -1 : full.indexOf(word) !== -1;
      if (!hit) return;
      // 더 긴 키워드가 더 구체적이라고 보고 우선한다.
      if (!best || word.length > best.word.length) best = { category, word };
    });
  });

  return best;
}

/**
 * 메모를 보고 카테고리를 고른다.
 * @returns {{category: object, reason: 'learned'|'keyword', word?: string}|null}
 */
export function suggest(memo, categories) {
  const list = (categories || []).filter((c) => !c.archived);
  if (!list.length) return null;
  const byId = new Map(list.map((c) => [c.id, c]));
  const allowed = new Set(byId.keys());
  const full = normalize(memo);
  if (full.length < 2) return null;

  const map = loadLearn();

  // 1) 같은 메모를 저장한 적이 있는가
  const exact = bestOf(map['=' + full], allowed);
  if (exact) return { category: byId.get(exact.id), reason: 'learned' };

  // 2) 낱말 단위 학습.
  //    한국어는 '순두부집' 을 배워 두고 '순두부' 라고 적는 일이 잦아서, 낱말이 정확히 같을 때뿐
  //    아니라 한쪽이 다른 쪽에 들어 있을 때도 맞은 것으로 본다.
  //    여러 개가 걸리면 많이 고른 것 > 더 길게 겹친 것 순으로 고른다.
  const memoTokens = tokenize(memo);
  let tokenBest = null;
  Object.keys(map).forEach((key) => {
    if (key.charAt(0) !== '#') return;
    const word = key.slice(1);
    const overlap = memoTokens.some((t) => t === word || t.indexOf(word) !== -1 || word.indexOf(t) !== -1);
    if (!overlap) return;
    const hit = bestOf(map[key], allowed);
    if (!hit) return;
    const better =
      !tokenBest || hit.count > tokenBest.count || (hit.count === tokenBest.count && word.length > tokenBest.length);
    if (better) tokenBest = { id: hit.id, count: hit.count, length: word.length };
  });
  if (tokenBest) return { category: byId.get(tokenBest.id), reason: 'learned' };

  // 3) 기본 키워드 사전
  const dict = dictionaryMatch(memo, list);
  if (dict) return { category: dict.category, reason: 'keyword', word: dict.word };

  return null;
}

/* ---------- 마지막에 쓴 카테고리·결제수단 ---------- */

export function getLastUsed() {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function setLastUsed(categoryId, method) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ categoryId, method }));
  } catch (_) {
    /* 무시 */
  }
}

/* ---------- 설정 화면용 ---------- */

export function learnedCount() {
  return Object.keys(loadLearn()).length;
}

export function clearLearned() {
  try {
    localStorage.removeItem(LEARN_KEY);
  } catch (_) {
    /* 무시 */
  }
}
