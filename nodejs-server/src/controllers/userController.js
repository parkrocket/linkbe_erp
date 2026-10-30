const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const secretKey = process.env.JWT_SECRET_KEY;

const { toSafeUser } = require('../utils/safeUser');

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

exports.register = (req, res) => {
    const { email, password, name, phone, companyName, companyHomepage, companyAddr, companyStandard, companyNumber, companyCode, cpId } = req.body;

    User.create(
        email,
        password,
        name,
        phone,
        companyName,
        companyHomepage,
        companyAddr,
        companyStandard,
        companyNumber,
        companyCode,
        cpId,
        (err, user) => {
            //return res.status(500).json({ message: 'Login successful', user: user });

            if (err) {
                return res.status(500).json({ registerSuccess: false, error: 'Database query error' });
            }
            if (!user) {
                return res.status(200).json({ registerSuccess: false, error: 'User not found' });
            }

            return res.json({ registerSuccess: true, message: 'Register successful', user: toSafeUser(user) });
        }
    );
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
