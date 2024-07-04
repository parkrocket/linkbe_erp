const jwt = require('jsonwebtoken');
const Gtw = require('../models/gtwModel');
const secretKey = process.env.JWT_SECRET_KEY;
const requestIp = require('request-ip');
const moment = require('moment');

exports.companyIn = (req, res) => {
    let ip;

    const date = moment().format('YYYY-MM-DD');

    if (process.env.NODE_ENV === 'development') {
        ip = process.env.DEV_IP;
    } else {
        ip = req.clientIp.includes('::ffff:') ? req.clientIp.split('::ffff:')[1] : req.clientIp;
    }

    const { userId, type, platform } = req.body;

    if (process.env.COMPANY_IP !== ip) {
        return res.status(200).json({ gtwSuccess: false, error: 'IP가 일치하지 않습니다.' });
    }

    Gtw.findByGtw(userId, type, date, (err, gtw) => {
        if (err) {
            return res.status(200).json({ gtwSuccess: false, error: 'Database query error' });
        }
        if (gtw.length > 0) {
            return res.status(200).json({ gtwSuccess: false, error: '이미 출근중입니다.' });
        } else {
            Gtw.create(userId, type, ip, platform, (err, gtw) => {
                console.log(err);

                if (err) {
                    return res.status(200).json({ gtwSuccess: false, error: 'Database query error' });
                }

                return res.json({ gtwSuccess: true, message: '출근완료', gtw });
            });
        }
    });
};

exports.gtwStatus = (req, res) => {
    const date = moment().format('YYYY-MM-DD');

    const { userId } = req.body;

    Gtw.findByGtwStatus(userId, date, (err, gtw) => {
        if (err) {
            return res.status(200).json({ gtwSuccess: false, error: 'Database query error' });
        }

        console.log(gtw);
    });
};
