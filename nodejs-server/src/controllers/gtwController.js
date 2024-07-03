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

    console.log(ip);

    const { userId, type, platform } = req.body;

    Gtw.create(userId, type, ip, platform, (err, gtw) => {
        if (err) {
            return res.status(500).json({ registerSuccess: false, error: 'Database query error' });
        }
        console.log(gtw);

        return res.json({ registerSuccess: true, message: 'gtw insert successful', gtw });
    });
};