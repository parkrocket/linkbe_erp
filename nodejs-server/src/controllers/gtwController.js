const jwt = require('jsonwebtoken');
const Gtw = require('../models/gtwModel');
const secretKey = process.env.JWT_SECRET_KEY;
const requestIp = require('request-ip');
const moment = require('moment');

exports.companyIn = (req, res) => {
    let ip;

    if (process.env.NODE_ENV === 'development') {
        ip = process.env.DEV_IP;
    } else {
        ip = req.clientIp.includes('::ffff:') ? req.clientIp.split('::ffff:')[1] : req.clientIp;
    }

    const { userId, type, platform } = req.body;

    if (process.env.COMPANY_IP !== ip) {
        return res.status(200).json({ gtwSuccess: false, error: 'Database query error', errorMessage: 'IP가 일치하지 않습니다.' });
    }

    Gtw.create(userId, type, ip, platform, (err, gtw) => {
        if (err) {
            return res.status(200).json({ gtwSuccess: false, error: 'Database query error' });
        }

        return res.json({ gtwSuccess: true, message: 'gtw insert successful', gtw });
    });
};
