const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const secretKey = process.env.JWT_SECRET_KEY;

const { toSafeUser } = require('../utils/safeUser');
const { validateRegister } = require('../utils/registerValidation');
const { escapeSlack } = require('../utils/slackEscape');
const Company = require('../models/companyModel');
const slack = require('../utils/slack'); // 호출 시점에 slack.sendSlackMessage 참조 (점검 스크립트에서 가짜 교체 가능)

const ADMIN_URL = 'https://hibye.kr/admin';

// 로그인 차단 상태 → 사유 (approved만 로그인 가능)
const LOGIN_BLOCKED_REASONS = {
    pending: 'Pending approval',
    rejected: 'Registration rejected',
    inactive: 'Account inactive',
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    User.findByEmail(email, (err, user) => {
        //return res.status(500).json({ message: 'Login successful', user: user });

        if (err) {
            return res.status(200).json({ loginSuccess: false, error: 'Database query error' });
        }
        if (!user) {
            return res.status(200).json({ loginSuccess: false, error: 'User not found' });
        }

        User.comparePassword(password, user.user_password, (err, isMatch) => {
            if (err) {
                return res.status(200).json({ loginSuccess: false, error: 'Error comparing passwords' });
            }
            if (!isMatch) {
                return res.status(200).json({ loginSuccess: false, error: 'Invalid credentials' });
            }

            // 승인된 계정만 로그인 — 비밀번호 확인 뒤에 검사해 비밀번호 모르는 사람에게 계정 상태를 알리지 않음
            // 실패 형식은 기존과 같이 200 + loginSuccess:false (기존 react-app이 이 형식에서만 안내를 띄움)
            const blockedReason = LOGIN_BLOCKED_REASONS[user.user_status];
            if (blockedReason) {
                return res.status(200).json({ loginSuccess: false, error: blockedReason });
            }

            // JWT 생성 및 전송

            const token = jwt.sign({ userId: user.user_id }, secretKey, { expiresIn: '24h' });
            res.cookie('x_auth', token, { httpOnly: false });

            return res.json({ loginSuccess: true, message: 'Login successful', user: toSafeUser(user), token });
        });
    });
};

// 회원가입 — 서버 검증 → 중복 확인 → 승인 대기(pending) 저장 → 관리자 채널 알림
// (기존: 검증 없이 즉시 직원으로 등록, 중복 이메일은 DB 오류로 노출)
exports.register = async (req, res) => {
    const checked = validateRegister(req.body);
    if (!checked.ok) return res.status(400).json({ registerSuccess: false, error: checked.error });
    const input = checked.value;

    try {
        if (!(await Company.existsAsync(input.cpId))) {
            return res.status(400).json({ registerSuccess: false, error: 'Invalid company' });
        }
        const existing = await User.findStatusById(input.email);
        if (existing) {
            // 거절된 이메일은 재가입 대신 관리자 문의로 안내 (사용자 결정)
            const error = existing.user_status === 'rejected' ? 'Registration rejected' : 'Email already registered';
            return res.status(409).json({ registerSuccess: false, error });
        }
        await User.create(input);
    } catch (error) {
        // 동시 가입으로 고유키 충돌 시에도 중복으로 안내
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ registerSuccess: false, error: 'Email already registered' });
        }
        console.error('register error:', error.message);
        return res.status(500).json({ registerSuccess: false, error: 'Database query error' });
    }

    // 알림 실패는 가입 결과에 영향 없음 (sendSlackMessage가 오류를 기록만 함)
    await slack.sendSlackMessage('#hibye-관리', `${escapeSlack(input.name)}님이 가입 승인을 기다리고 있어요 → ${ADMIN_URL}`);
    return res.status(200).json({ registerSuccess: true });
};

exports.auth = (req, res) => {
    const token = req.body.x_auth;

    /*
    if (process.env.NODE_ENV === 'development') {
        console.log('개발');
    } else {
        console.log('실서버');
    }
    */

    if (!token) {
        return res.status(200).json({ isAuth: false, error: 'No token provided' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(200).json({ isAuth: false, error: 'Invalid token' });
        }

        User.findByEmail(decoded.userId, (err, user) => {
            if (err) {
                return res.status(200).json({ isAuth: false, error: 'Database query error' });
            }
            if (!user) {
                return res.status(200).json({ isAuth: false, error: 'User not found' });
            }

            // 공개 경로라 requireAuth를 거치지 않음 → 여기서도 승인 상태 확인 (비활성화되면 화면도 바로 로그아웃 상태)
            if (user.user_status !== 'approved') {
                return res.status(200).json({ isAuth: false, error: 'Account not active' });
            }
            return res.json({ isAuth: true, user: toSafeUser(user) });
        });
    });
};

exports.refresh = (req, res) => {
    // 요청 바디의 userId 대신 토큰 주인(req.userId)만 조회 — 남의 정보 조회 차단
    User.findByEmail(req.userId, (err, user) => {
        //return res.status(500).json({ message: 'Login successful', user: user });

        if (err) {
            return res.status(200).json({ refreshSuccess: false, error: 'Database query error' });
        }
        if (!user) {
            return res.status(200).json({ refreshSuccess: false, error: 'User not found' });
        }

        return res.json({ refreshSuccess: true, message: 'refresh successful', user: toSafeUser(user) });
    });
};

exports.logout = (req, res) => {
    res.clearCookie('x_auth');
    res.json({ logoutSuccess: true });
};
