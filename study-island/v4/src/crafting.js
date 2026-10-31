// 工坊配方。數量是遊戲設計數值，不是任何既有規則。
import { count } from './inventory.js';

export const RECIPES = [
  { id: 'wood-chair', makes: 'wood-chair', needs: { wood: 2, leaf: 1 } },
  { id: 'flowerbed', makes: 'flowerbed', needs: { leaf: 2, wood: 1 } },
  { id: 'lantern', makes: 'lantern', needs: { shell: 3, wood: 1 } }
];

export function recipeById(id) {
  return RECIPES.find(r => r.id === id) || null;
}

// 回傳缺少的材料 [{ id, need, have }]；空陣列代表可以製作。
export function missing(inv, recipe) {
  return Object.entries(recipe.needs)
    .map(([id, need]) => ({ id, need, have: count(inv, id) }))
    .filter(m => m.have < m.need);
}
