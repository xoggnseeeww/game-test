// 학습 카테고리 전체가 공유하는 마스코트 일러스트. 상황 폴더가 늘어도 이미지 파일이 늘지
// 않도록 외부 이미지 대신 인라인 SVG로 그린다(빌드·이미지 생성 도구 없이 브라우저가 직접
// 그린다는 이 저장소 원칙과 같은 이유). 얼굴 하나에 표정·소품만 갈아끼우는 조합형이라,
// 새 문장이 기존 감정 중 하나를 쓰면 코드 추가 없이 mood 값만 데이터에 적으면 된다.
const FACE = `<circle cx="60" cy="62" r="46" fill="#FFD166" stroke="#B85E10" stroke-width="3"/>`;

const EYES = `
  <circle cx="44" cy="54" r="5" fill="#3B2A12"/>
  <circle cx="76" cy="54" r="5" fill="#3B2A12"/>
`;

const MOUTHS = {
  smile: `<path d="M42 72 Q60 90 78 72" stroke="#3B2A12" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  bigSmile: `<path d="M40 70 Q60 96 80 70 Q60 84 40 70 Z" fill="#B85E10"/>`,
  sad: `<path d="M42 82 Q60 68 78 82" stroke="#3B2A12" stroke-width="4" fill="none" stroke-linecap="round"/>`,
};

const PROPS = {
  wave: `<path d="M96 40 Q110 30 104 18 Q100 28 92 30" fill="#FFD166" stroke="#B85E10" stroke-width="3"/>`,
  tear: `<path d="M30 60 Q24 72 30 78 Q36 72 30 60 Z" fill="#6FB7FF"/>`,
  heart: `<path d="M98 54 C90 46 84 38 90 32 C94 28 98 30 98 34 C98 30 102 28 106 32 C112 38 106 46 98 54 Z" fill="#FF6B8B"/>`,
  sparkle: `<path d="M18 16 L21.5 26.5 L32 30 L21.5 33.5 L18 44 L14.5 33.5 L4 30 L14.5 26.5 Z" fill="#FFD166"/>`,
};

function svg(inner) {
  return `<svg viewBox="0 0 120 120" class="mascot" role="img" aria-hidden="true">${FACE}${EYES}${inner}</svg>`;
}

export const MASCOTS = {
  wave: svg(MOUTHS.smile + PROPS.wave),
  happy: svg(MOUTHS.bigSmile + PROPS.sparkle),
  sad: svg(MOUTHS.sad + PROPS.tear),
  friendly: svg(MOUTHS.smile + PROPS.heart),
  bye: svg(MOUTHS.smile + PROPS.wave),
};

export function mascotFor(mood) {
  return MASCOTS[mood] || MASCOTS.wave;
}
