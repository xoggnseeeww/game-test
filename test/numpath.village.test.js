// 보상(코인) 계산과 마을 건설 불변식을 검증한다. village.js의 판정·계산은 DOM도 localStorage도
// 모르는 순수 함수라(저장은 loadVillage/saveVillage 두 곳에 격리) 브라우저 없이 여기서 확인한다.
import test from "node:test";
import assert from "node:assert/strict";
import {
  VILLAGE_ITEMS,
  villageItemById,
  coinsFor,
  emptyVillage,
  earnCoins,
  isBuilt,
  canBuild,
  buildItem,
  villageProgress,
  loadVillage,
} from "../js/games/numpath/village.js";
import { DIFFICULTIES, MAX_STARS } from "../js/games/numpath/data.js";

test("건물 목록이 유효하다: id 유일 · 양수 비용 · 비용 오름차순(표시 순서 = 성장 순서)", () => {
  const ids = VILLAGE_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "건물 id가 겹친다");
  for (const item of VILLAGE_ITEMS) {
    assert.ok(Number.isInteger(item.cost) && item.cost > 0, `${item.id}의 비용이 이상하다`);
    assert.ok(item.emoji && item.name, `${item.id}에 표시 정보가 없다`);
  }
  for (let i = 1; i < VILLAGE_ITEMS.length; i++) {
    assert.ok(VILLAGE_ITEMS[i].cost > VILLAGE_ITEMS[i - 1].cost, "비용이 오름차순이 아니다");
  }
});

test("coinsFor: 별 × 난이도 배수. 난이도가 오를수록 같은 별로 더 번다", () => {
  for (const d of DIFFICULTIES) {
    assert.equal(coinsFor(0, d.id), 0);
    assert.equal(coinsFor(MAX_STARS, d.id), MAX_STARS * d.coinsPerStar);
  }
  const perStar = DIFFICULTIES.map((d) => d.coinsPerStar);
  for (let i = 1; i < perStar.length; i++) {
    assert.ok(perStar[i] > perStar[i - 1], "어려운 난이도의 별당 코인이 더 많아야 한다");
  }
});

test("첫 건물은 최저 난이도 한 런의 최대 보상으로도 지을 수 있다 (보상 루프가 첫 런부터 돈다)", () => {
  const easiest = DIFFICULTIES[0];
  const maxCoinsPerRun = easiest.stages.length * MAX_STARS * easiest.coinsPerStar;
  assert.ok(VILLAGE_ITEMS[0].cost <= maxCoinsPerRun, `첫 건물 비용 ${VILLAGE_ITEMS[0].cost} > 첫 런 최대 보상 ${maxCoinsPerRun}`);
});

test("earnCoins는 코인만 늘리고 건설 목록은 건드리지 않는다", () => {
  const v = earnCoins(emptyVillage(), 7);
  assert.equal(v.coins, 7);
  assert.deepEqual(v.built, []);
});

test("buildItem: 코인이 모자라면 원본 그대로, 충분하면 차감하고 건설 목록에 추가한다", () => {
  const item = VILLAGE_ITEMS[0];
  const poor = earnCoins(emptyVillage(), item.cost - 1);
  assert.equal(canBuild(poor, item.id), false);
  assert.equal(buildItem(poor, item.id), poor);

  const rich = earnCoins(emptyVillage(), item.cost + 3);
  assert.equal(canBuild(rich, item.id), true);
  const after = buildItem(rich, item.id);
  assert.equal(after.coins, 3);
  assert.ok(isBuilt(after, item.id));
  assert.equal(isBuilt(rich, item.id), false, "buildItem이 원본을 변형했다");
});

test("buildItem: 이미 지은 건물과 없는 id는 거부한다 (이중 클릭 방어)", () => {
  const item = VILLAGE_ITEMS[0];
  const built = buildItem(earnCoins(emptyVillage(), item.cost * 2), item.id);
  assert.equal(buildItem(built, item.id), built, "같은 건물이 두 번 지어졌다");
  assert.equal(buildItem(built, "없는-건물"), built);
  assert.equal(villageItemById("없는-건물"), null);
});

test("전 건물을 순서대로 다 지으면 진행도가 완성이 되고 코인이 정확히 총합만큼 든다", () => {
  const totalCost = VILLAGE_ITEMS.reduce((a, i) => a + i.cost, 0);
  let v = earnCoins(emptyVillage(), totalCost);
  for (const item of VILLAGE_ITEMS) v = buildItem(v, item.id);
  assert.equal(v.coins, 0);
  const progress = villageProgress(v);
  assert.equal(progress.built, progress.total);
});

test("node 환경(localStorage 없음)에서 loadVillage는 던지지 않고 빈 마을을 돌려준다", () => {
  assert.deepEqual(loadVillage(), emptyVillage());
});
