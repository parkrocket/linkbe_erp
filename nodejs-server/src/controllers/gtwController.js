const jwt = require('jsonwebtoken');
const Gtw = require('../models/gtwModel');
const secretKey = process.env.JWT_SECRET_KEY;
const requestIp = require('request-ip');
const moment = require('moment');
const { toSafeUser } = require('../utils/safeUser'); // lk_user 조인 결과에서 비밀번호 해시 제거

const { sendSlackMessage } = require('../utils/slack');

exports.companyIn = (req, res) => {
    let ip;

    const date = moment().format('YYYY-MM-DD');
    let errorM = '';

    if (process.env.NODE_ENV === 'development') {
        ip = process.env.DEV_IP;
    } else {
        ip = req.clientIp.includes('::ffff:')
            ? req.clientIp.split('::ffff:')[1]
            : req.clientIp;
    }

    // 사용자는 토큰 주인만 — 요청 바디의 userId로 남의 출근 기록·Slack 알림을 만들 수 있었음
    const userId = req.userId;
    const { type, platform } = req.body;
    /*

    if (process.env.COMPANY_IP !== ip) {
        return res
            .status(200)
            .json({ gtwSuccess: false, error: 'IP가 일치하지 않습니다.' });
    }
    */

    Gtw.findByGtw(userId, type, date, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        if (type === 'gtw' && gtw.length > 0) {
            if (gtw[0].end_time === null) {
                errorM = '이미 출근중입니다.';
            } else {
                errorM = '이미 퇴근하셨습니다. 내일도 화이팅.';
            }
            return res.status(200).json({ gtwSuccess: false, error: errorM });
        }

        Gtw.create(userId, type, date, ip, platform, async (err, gtw) => {
            if (err) {
                return res
                    .status(200)
                    .json({ gtwSuccess: false, error: 'Database query error' });
            }

            // Slack 메시지 전송
            const message =
                type === 'gtw'
                    ? `${userId}님이 출근하셨습니다.`
                    : `${userId}님이 퇴근하셨습니다.`;
            await sendSlackMessage('#출퇴근', message);

            return res.json({ gtwSuccess: true, message: '출근완료', gtw });
        });
    });
};

exports.gtwStatus = (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const userId = req.userId; // 토큰 주인만 (바디 userId로 남의 기록 조회 차단)
    const { date } = req.body;

    Gtw.findByGtwStatus(userId, date, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        //console.log(gtw);
        return res.status(200).json({ gtwSuccess: true, gtw: gtw && toSafeUser(gtw) });
    });
};

exports.gtwWeeklyStatus = (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const userId = req.userId; // 토큰 주인만 (바디 userId로 남의 기록 조회 차단)
    const { date } = req.body;

    Gtw.findByGtwWeeklyStatus(userId, date, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        //console.log(gtw);
        return res.status(200).json({ gtwSuccess: true, gtw });
    });
};

exports.gtwStatusAll = (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const { date } = req.body;

    Gtw.findByGtwAll(date, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        //console.log(gtw);
        return res.status(200).json({ gtwSuccess: true, gtw: gtw.map(toSafeUser) });
    });
};

exports.gtwStatusAllWeb = (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const { date } = req.body; // cpId는 무시 — 회사는 토큰 주인 기준


    Gtw.findByGtwAllWeb(date, req.userId, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        return res.status(200).json({ gtwSuccess: true, gtw: gtw.map(toSafeUser) });
    });
};
