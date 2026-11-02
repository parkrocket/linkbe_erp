// 앞단 프록시 신뢰 범위 — AWS 로드밸런서(VPC 사설 IP)와 nginx(루프백)
// req.ip는 X-Forwarded-For를 오른쪽부터 보며 이 범위를 건너뛴 첫 주소 = 실제 클라이언트
// (첫 값을 그대로 쓰면 클라이언트가 헤더를 지어내 접수 횟수 제한을 피할 수 있음)
exports.TRUST_PROXY = 'loopback, uniquelocal';
