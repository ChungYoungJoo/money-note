// 로컬 저장 백엔드. config.js 에 Supabase 정보가 없을 때 쓰인다.
// remote.js 와 같은 메서드 이름·같은 데이터 모양을 유지해야 store.js 가 둘을 바꿔 끼울 수 있다.

const CAT_KEY = 'moneynote.categories.v1';
const EXP_KEY = 'moneynote.expenses.v1';

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function save(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function patchRow(key, id, patch) {
  const rows = load(key);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = Object.assign({}, rows[idx], patch, { id });
  save(key, rows);
  return rows[idx];
}

function removeRow(key, id) {
  save(key, load(key).filter((r) => r.id !== id));
}

export const local = {
  mode: 'local',

  async categories() {
    return load(CAT_KEY)
      .slice()
      .sort((a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(String(b.name), 'ko'));
  },

  async addCategory(cat) {
    const rows = load(CAT_KEY);
    const row = Object.assign({ id: newId(), archived: false, sort_order: rows.length }, cat);
    rows.push(row);
    save(CAT_KEY, rows);
    return row;
  },

  async updateCategory(id, patch) {
    return patchRow(CAT_KEY, id, patch);
  },

  async deleteCategory(id) {
    removeRow(CAT_KEY, id);
  },

  async expenses(from, to) {
    return load(EXP_KEY)
      .filter((r) => r.spent_on >= from && r.spent_on <= to)
      .sort((a, b) => {
        if (a.spent_on !== b.spent_on) return a.spent_on < b.spent_on ? 1 : -1;
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
  },

  async addExpense(row) {
    const rows = load(EXP_KEY);
    const saved = Object.assign({ id: newId(), created_at: new Date().toISOString() }, row);
    rows.push(saved);
    save(EXP_KEY, rows);
    return saved;
  },

  async updateExpense(id, patch) {
    return patchRow(EXP_KEY, id, patch);
  },

  async deleteExpense(id) {
    removeRow(EXP_KEY, id);
  },

  async categoryInUse(id) {
    return load(EXP_KEY).some((r) => r.category_id === id);
  },
};
