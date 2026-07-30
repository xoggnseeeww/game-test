// NumPath 보상 체계: 스테이지 클리어 → 코인(별 × 난이도 배수) → "넘버 마을" 건물 짓기.
// 판정·계산은 순수 함수로 두고(engine.js와 같은 이유로 node --test가 직접 검증한다),
// localStorage 접근은 loadVillage/saveVillage 두 곳에만 가둔다.
//
// 영속 데이터에 대해: 이 저장이 D-20(반응속도 최고기록 제거)과 어떻게 다른지, 왜 다시
// localStorage를 쓰는지는 docs/decisions/2027-h1.md D-34 참고 — D-20의 논지는 "측정 검사에서
// 빠름을 성취로 프레이밍하지 말 것"이지 게임 진행 저장 금지가 아니다.
import { difficultyById } from "./data.js";

const STORAGE_KEY = "gt_numpath_village";

// 지을 수 있는 건물 목록. cost 오름차순이 곧 화면 표시 순서이자 마을 풍경에 쌓이는 순서다.
// 코인 수급(쉬움 런 만점 15 · 보통 42 · 어려움 81)을 기준으로, 첫 건물은 첫 런에 바로 짓고
// 전체 완성(총합 592)은 십수 런에 걸치도록 잡았다.
export const VILLAGE_ITEMS = [
  { id: "tent", emoji: "⛺", name: "시작의 텐트", cost: 5 },
  { id: "hut", emoji: "🛖", name: "나무 오두막", cost: 8 },
  { id: "garden", emoji: "🌷", name: "꽃밭 정원", cost: 12 },
  { id: "house", emoji: "🏠", name: "벽돌집", cost: 18 },
  { id: "fountain", emoji: "⛲", name: "광장 분수", cost: 25 },
  { id: "market", emoji: "🏪", name: "숫자 상점", cost: 34 },
  { id: "school", emoji: "🏫", name: "수학 학교", cost: 44 },
  { id: "ferris", emoji: "🎡", name: "대관람차", cost: 56 },
  { id: "tower", emoji: "🗼", name: "계산 타워", cost: 70 },
  { id: "train", emoji: "🚂", name: "마을 열차", cost: 85 },
  { id: "castle", emoji: "🏰", name: "넘버 캐슬", cost: 105 },
  { id: "rocket", emoji: "🚀", name: "우주 발사대", cost: 130 },
];

export function villageItemById(itemId) {
  return VILLAGE_ITEMS.find((i) => i.id === itemId) || null;
}

// 스테이지 클리어 보상: 별 1개당 난이도의 coinsPerStar만큼.
export function coinsFor(stars, difficultyId) {
  return stars * difficultyById(difficultyId).coinsPerStar;
}

export function emptyVillage() {
  return { coins: 0, built: [] };
}

export function earnCoins(village, amount) {
  return { coins: village.coins + amount, built: village.built };
}

export function isBuilt(village, itemId) {
  return village.built.includes(itemId);
}

export function canBuild(village, itemId) {
  const item = villageItemById(itemId);
  return !!item && !isBuilt(village, itemId) && village.coins >= item.cost;
}

// canBuild()를 만족하지 않으면 원본을 그대로 돌려준다 — Undo와 같은 방어(재렌더 전 이중 클릭).
export function buildItem(village, itemId) {
  if (!canBuild(village, itemId)) return village;
  const item = villageItemById(itemId);
  return { coins: village.coins - item.cost, built: [...village.built, itemId] };
}

export function villageProgress(village) {
  return { built: village.built.length, total: VILLAGE_ITEMS.length };
}

function storage() {
  // node --test에는 localStorage가 없다 — 순수 함수들은 그와 무관하게 검증돼야 한다.
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function loadVillage() {
  try {
    const raw = storage() && storage().getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Number.isInteger(parsed.coins) && parsed.coins >= 0 && Array.isArray(parsed.built)) {
        // 건물 목록이 바뀌어도(id 삭제 등) 저장돼 있던 옛 id가 화면을 깨지 않게 걸러서 읽는다.
        return { coins: parsed.coins, built: parsed.built.filter((id) => !!villageItemById(id)) };
      }
    }
  } catch {
    // 프라이버시 모드는 localStorage 접근 자체가 throw한다 — 의도된 방어(CLAUDE.md 예외).
    // 이 경우 매번 빈 마을로 시작하지만 코인 적립·건설은 세션 안에서는 동작한다.
  }
  return emptyVillage();
}

export function saveVillage(village) {
  try {
    if (storage()) storage().setItem(STORAGE_KEY, JSON.stringify(village));
  } catch {
    // 위와 같은 이유의 의도된 방어 — 저장 실패는 기능 상실이 아니라 "이번 세션 한정"으로 강등될 뿐이다.
  }
}
