// 카테고리 기본 세트. 테이블이 비어 있을 때 한 번만 자동으로 들어갑니다.
// 앱의 [설정] 탭에서 추가·이름변경·순서변경·삭제할 수 있습니다.

export const DEFAULT_CATEGORIES = [
  { emoji: '🍚', name: '식비' },
  { emoji: '☕', name: '카페/간식' },
  { emoji: '🚌', name: '교통' },
  { emoji: '🧻', name: '생활용품' },
  { emoji: '💊', name: '의료/건강' },
  { emoji: '📚', name: '교육' },
  { emoji: '🎬', name: '문화/여가' },
  { emoji: '👕', name: '의류/미용' },
  { emoji: '🎁', name: '경조사' },
  { emoji: '🏠', name: '주거/공과금' },
  { emoji: '📱', name: '통신' },
  { emoji: '✨', name: '기타' },
];

export const METHODS = [
  { id: 'card', label: '카드', emoji: '💳' },
  { id: 'cash', label: '현금', emoji: '💵' },
];

export function methodLabel(id) {
  const m = METHODS.find((x) => x.id === id);
  return m ? m.label : id;
}
