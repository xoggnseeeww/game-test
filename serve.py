#!/usr/bin/env python3
"""로컬 개발 서버 (개발 전용 — 배포 동작과 무관).

`python3 -m http.server`를 그냥 쓰면 안 된다. Cloudflare Pages는 `_redirects`의
규칙대로 정적 파일이 없는 경로를 다른 파일로 rewrite하는데, 기본 http.server는
그렇지 않아서 `/test/adhd` 같은 하위 경로 직접 접속이 전부 404가 된다.
그 상태로 라우팅을 확인하면 멀쩡한 라우팅을 "깨졌다"고 오판한다.

`_redirects` 파일을 실제로 읽어서 규칙을 그대로 적용한다 — 하드코딩된 폴백 하나가
아니라 파일에 적힌 순서대로(처음 매치하는 규칙이 이긴다) 처리해야, OG 셸처럼
특정 경로만 다른 파일로 보내는 규칙(`/test/adhd → /og-shells/test-adhd.html`)도
로컬에서 그대로 재현된다. 정확한 URL(`/*` 없는 소스)과 와일드카드(`/*`)만 지원한다
— 이 레포의 `_redirects`가 그 두 형태만 쓰기 때문. status는 200(rewrite)만 다룬다.

사용: python3 serve.py [포트]   (기본 8000)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


def load_redirect_rules():
    rules = []
    try:
        with open("_redirects", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) < 2:
                    continue
                source, dest = parts[0], parts[1]
                status = parts[2] if len(parts) > 2 else "200"
                rules.append((source, dest, status))
    except FileNotFoundError:
        pass
    return rules


REDIRECT_RULES = load_redirect_rules()


def resolve_rewrite(request_path):
    for source, dest, status in REDIRECT_RULES:
        if status != "200":
            continue  # 이 레포는 리다이렉트(3xx) 규칙을 쓰지 않는다 — rewrite만 지원
        if source == request_path or source == "/*":
            return dest
    return None


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        request_path = self.path.split("?", 1)[0]
        fs_path = self.translate_path(self.path)
        exists = os.path.exists(fs_path) and not (
            os.path.isdir(fs_path) and not os.path.exists(os.path.join(fs_path, "index.html"))
        )
        if not exists:
            dest = resolve_rewrite(request_path)
            if dest:
                self.path = dest
        return super().send_head()


if __name__ == "__main__":
    print(f"http://localhost:{PORT}  (SPA 폴백 활성, _redirects {len(REDIRECT_RULES)}개 규칙 로드 — Ctrl+C로 종료)")
    http.server.test(HandlerClass=SPAHandler, port=PORT, bind="127.0.0.1")
