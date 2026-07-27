#!/usr/bin/env python3
"""로컬 개발 서버 (개발 전용 — 배포 동작과 무관).

`python3 -m http.server`를 그냥 쓰면 안 된다. Cloudflare Pages는 `_redirects`의
`/*  /index.html  200` 규칙으로 모든 경로에 index.html을 주지만, 기본 http.server는
그렇지 않아서 `/test/adhd` 같은 하위 경로 직접 접속이 전부 404가 된다.
그 상태로 라우팅을 확인하면 멀쩡한 라우팅을 "깨졌다"고 오판한다.

사용: python3 serve.py [포트]   (기본 8000)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        # 실제 파일이 없는 경로는 index.html로 폴백 — _redirects와 같은 동작
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path) and not os.path.exists(
            os.path.join(path, "index.html")
        ):
            self.path = "/index.html"
        return super().send_head()


if __name__ == "__main__":
    print(f"http://localhost:{PORT}  (SPA 폴백 활성 — Ctrl+C로 종료)")
    http.server.test(HandlerClass=SPAHandler, port=PORT, bind="127.0.0.1")
