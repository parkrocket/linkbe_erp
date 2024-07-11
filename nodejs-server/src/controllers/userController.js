const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const secretKey = process.env.JWT_SECRET_KEY;

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

            // JWT 생성 및 전송

            const token = jwt.sign({ userId: user.user_id }, secretKey, { expiresIn: '24h' });
            res.cookie('x_auth', token, { httpOnly: false });

            return res.json({ loginSuccess: true, message: 'Login successful', user, token });
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

            return res.json({ registerSuccess: true, message: 'Register successful', user });
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

            return res.json({ isAuth: true, user });
        });
    });
};

exports.refresh = (req, res) => {
    const { userId } = req.body;
    User.findByEmail(userId, (err, user) => {
        //return res.status(500).json({ message: 'Login successful', user: user });

        if (err) {
            return res.status(200).json({ refreshSuccess: false, error: 'Database query error' });
        }
        if (!user) {
            return res.status(200).json({ refreshSuccess: false, error: 'User not found' });
        }

        return res.json({ refreshSuccess: true, message: 'refresh successful', user });
    });
};

exports.logout = (req, res) => {
    res.clearCookie('x_auth');
    res.json({ logoutSuccess: true });
};
