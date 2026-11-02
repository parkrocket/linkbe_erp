# hibye.kr 새 앱(hibye-web) 전환 — 설계

- 작성일: 2026-11-02 / 상태: 사용자 승인(대화)

## 결정 사항 (사용자)
- Slack 홈 출근·재택출근·퇴근 버튼 **제거** (출퇴근 기록 미사용), 근태 신청·잔여 안내는 유지
- 기존 앱 전용 화면 `/gtw`·`/geo`·`/work`·`/workHistory`·`/sent` → 홈(`/`)으로
- 되돌리기: nginx 설정 백업 복원으로 1분 내 기존 앱 복구. `/var/www/html`은 2주 유지 후 정리(별도 작업)

## 순서 (중요)
기존 앱은 로그인 쿠키를 JS로 읽고(`useCookies`) 로그인 응답 본문의 토큰을 씀 → 쿠키 보안 강화는 **전환 후**
1. **미리 배포**(기존 앱 영향 없음): Slack 홈 버튼 제거, hibye-web 예전 주소 → `/` 리다이렉트(next.config `redirects`, 영구 아님), `deploy-react.yml`은 수동 실행(`workflow_dispatch`)만. 서버에서 `curl -sI http://127.0.0.1:3001/login` 200 확인
2. **전환**(사용자가 서버에서): nginx 설정 백업 → `location /`를 `proxy_pass http://127.0.0.1:3001`(Host·X-Forwarded-For·X-Forwarded-Proto 전달) → `nginx -t` → reload. `/node/`는 그대로. 확인: 로그인·대시보드·근태·일정·관리·Slack 버튼·`checkAuth.js https://hibye.kr/node`
3. **쿠키 보안**(전환 직후 배포): `x_auth`에 `httpOnly`, `secure`(운영), `sameSite: 'lax'`, `maxAge` 24시간(JWT 만료와 같음). 로그인 응답 본문에서 `token` 제거. 로그아웃 `clearCookie`도 같은 속성. 이 단계 이후 되돌리려면 nginx와 함께 이 커밋도 되돌림(revert)
4. **마무리**: 직원 공지 초안, 2주 후 react-app·워크플로·예전 API 정리(별도)

## 테스트
- `scripts/checkSlackHome.js`(Slack 가짜): 홈 화면에 `hibye.kr/gtw` 링크·출퇴근 버튼 없음, 근태 신청 버튼·관리창 링크 유지
- `scripts/checkLoginStatus.js` 보강(3단계): 쿠키 속성, 응답 본문에 token 없음, 로그아웃 속성
- 예전 주소 리다이렉트: dev 서버 curl 307→`/`
