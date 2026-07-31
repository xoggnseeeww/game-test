// cloud.js는 최상단에서 Supabase JS를 CDN에서 가져온다(네트워크 필요). 그걸 다른 화면 모듈이
// static import로 연결하면, CDN이 막혔을 때(오프라인·차단) import 실패가 ES 모듈 그래프를 타고
// 올라가 screens.js/play.js 전체가 깨진다 — 인트로·플레이·결과까지 전부 못 뜨게 된다는 뜻이다.
// 그래서 이 얇은 로더만 static import하고, 실제 cloud.js는 여기서 동적 import + 실패 캐시로
// 감싼다. 이 파일 자체는 네트워크를 안 건드리므로 static import해도 안전하다.
let cached = null;

export function loadCloud() {
  if (!cached) {
    cached = import("./cloud.js").catch((err) => {
      console.error("NumPath 클라우드 기능을 불러오지 못했습니다 — 로그인·동기화 없이 계속 진행합니다.", err);
      return null;
    });
  }
  return cached;
}
