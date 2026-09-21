// 화면이 쓰는 데이터 창구. 어느 백엔드를 쓰는지는 여기서만 안다.

import { remote, remoteAvailable } from './remote.js';
import { local } from './local.js';
import { DEFAULT_CATEGORIES } from './defaults.js';

const backend = remoteAvailable ? remote : local;

let catCache = null;

export const store = {
  mode: backend.mode, // 'supabase' | 'local'

  /** 카테고리 목록. 비어 있으면 기본 세트를 한 번 만들어 준다. */
  async categories(force) {
    if (catCache && !force) return catCache;
    let rows = await backend.categories();
    if (!rows.length) rows = await seedDefaults();
    catCache = rows.filter((c) => !c.archived);
    return catCache;
  },

  /** 보관된 것까지 포함한 전체 목록. 지난 내역의 카테고리 이름을 찾을 때 쓴다. */
  async allCategories() {
    return backend.categories();
  },

  async addCategory(name, emoji) {
    const rows = await backend.categories();
    const order = rows.reduce((max, c) => Math.max(max, Number(c.sort_order) || 0), -1) + 1;
    const row = await backend.addCategory({
      name: String(name).trim(),
      emoji: String(emoji || '✨').trim() || '✨',
      sort_order: order,
      archived: false,
    });
    catCache = null;
    return row;
  },

  async updateCategory(id, patch) {
    const row = await backend.updateCategory(id, patch);
    catCache = null;
    return row;
  },

  /**
   * 카테고리 삭제. 이미 쓰인 카테고리는 지우면 과거 내역이 이름을 잃으므로
   * 지우는 대신 보관(archived) 처리해 입력 화면에서만 감춘다.
   * @returns {'deleted'|'archived'}
   */
  async removeCategory(id) {
    const inUse = await backend.categoryInUse(id);
    if (inUse) {
      await backend.updateCategory(id, { archived: true });
      catCache = null;
      return 'archived';
    }
    await backend.deleteCategory(id);
    catCache = null;
    return 'deleted';
  },

  async moveCategory(id, direction) {
    const rows = (await backend.categories()).slice().sort(
      (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    );
    const idx = rows.findIndex((c) => c.id === id);
    const swapWith = idx + direction;
    if (idx === -1 || swapWith < 0 || swapWith >= rows.length) return false;
    const a = rows[idx];
    const b = rows[swapWith];
    // sort_order 값이 겹치거나 비어 있을 수 있으니 자리 번호를 새로 부여한다.
    await backend.updateCategory(a.id, { sort_order: swapWith });
    await backend.updateCategory(b.id, { sort_order: idx });
    catCache = null;
    return true;
  },

  expenses(from, to) {
    return backend.expenses(from, to);
  },

  day(iso) {
    return backend.expenses(iso, iso);
  },

  async addExpense(row) {
    return backend.addExpense(cleanExpense(row));
  },

  async updateExpense(id, patch) {
    return backend.updateExpense(id, cleanExpense(patch));
  },

  deleteExpense(id) {
    return backend.deleteExpense(id);
  },
};

function cleanExpense(row) {
  const out = {};
  if (row.spent_on !== undefined) out.spent_on = row.spent_on;
  if (row.category_id !== undefined) out.category_id = row.category_id;
  if (row.method !== undefined) out.method = row.method === 'cash' ? 'cash' : 'card';
  if (row.amount !== undefined) out.amount = Math.round(Number(row.amount) || 0);
  if (row.memo !== undefined) {
    const memo = String(row.memo || '').trim();
    out.memo = memo ? memo.slice(0, 200) : null;
  }
  return out;
}

async function seedDefaults() {
  const created = [];
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i += 1) {
    const def = DEFAULT_CATEGORIES[i];
    created.push(
      await backend.addCategory({
        name: def.name,
        emoji: def.emoji,
        sort_order: i,
        archived: false,
      })
    );
  }
  return created.filter(Boolean);
}

/* ---------- 집계 ---------- */

/** 카테고리 id -> 카테고리 객체 */
export function indexById(categories) {
  const map = new Map();
  categories.forEach((c) => map.set(c.id, c));
  return map;
}

/** 날짜별 합계. { '2026-09-21': 32000, ... } */
export function totalsByDay(expenses) {
  const out = {};
  expenses.forEach((e) => {
    out[e.spent_on] = (out[e.spent_on] || 0) + (Number(e.amount) || 0);
  });
  return out;
}

/** 카테고리별 합계를 금액 내림차순 배열로. [{ categoryId, amount, count }] */
export function totalsByCategory(expenses) {
  const map = new Map();
  expenses.forEach((e) => {
    const cur = map.get(e.category_id) || { categoryId: e.category_id, amount: 0, count: 0 };
    cur.amount += Number(e.amount) || 0;
    cur.count += 1;
    map.set(e.category_id, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

/** 결제수단별 합계. { card, cash, total } */
export function totalsByMethod(expenses) {
  const out = { card: 0, cash: 0, total: 0 };
  expenses.forEach((e) => {
    const amount = Number(e.amount) || 0;
    if (e.method === 'cash') out.cash += amount;
    else out.card += amount;
    out.total += amount;
  });
  return out;
}
