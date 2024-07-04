const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const secretKey = process.env.JWT_SECRET_KEY;

exports.login = (req, res) => {
    const { email, password } = req.body;

    User.findByEmail(email, (err, user) => {
        console.log(secretKey);

        //return res.status(500).json({ message: 'Login successful', user: user });

        if (err) {
            return res.status(200).json({ loginSuccess: false, error: 'Database query error' });
        }
        if (!user) {
            return res.status(200).json({ loginSuccess: false, error: 'User not found' });
        }

        User.comparePassword(password, user.mb_password, (err, isMatch) => {
            if (err) {
                return res.status(200).json({ loginSuccess: false, error: 'Error comparing passwords' });
            }
            if (!isMatch) {
                return res.status(200).json({ loginSuccess: false, error: 'Invalid credentials' });
            }

            // JWT 생성 및 전송

            const token = jwt.sign({ userId: user.user_id }, secretKey, { expiresIn: '24h' });
            res.cookie('x_auth', token, { httpOnly: true });

            return res.json({ loginSuccess: true, message: 'Login successful', user, token });
        });
    });
};

exports.register = (req, res) => {
    const { email, password } = req.body;

    User.create(email, password, (err, user) => {
        //return res.status(500).json({ message: 'Login successful', user: user });

        if (err) {
            return res.status(500).json({ registerSuccess: false, error: 'Database query error' });
        }
        if (!user) {
            return res.status(200).json({ registerSuccess: false, error: 'User not found' });
        }

        return res.json({ registerSuccess: true, message: 'Register successful', user });
    });
};

exports.auth = (req, res) => {
    const token = req.body.x_auth;

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

            return res.json({ isAuth: true, user });
        });
    });
};

exports.logout = (req, res) => {
    res.clearCookie('x_auth');
    res.json({ logoutSuccess: true });
};
