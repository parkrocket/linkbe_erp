const jwt = require('jsonwebtoken');
const List = require('../models/listModel');
const secretKey = process.env.JWT_SECRET_KEY;
const requestIp = require('request-ip');
const moment = require('moment');
const { toSafeUser } = require('../utils/safeUser'); // 모든 직원 행이 나가므로 비밀번호 해시·개인정보 제거

exports.lists = (req, res) => {
    const date = req.body.date;

    List.findByList(date, (err, list) => {
        if (err) {
            return res
                .status(200)
                .json({ listSuccess: false, error: 'Database query error' });
        }
        if (!list) {
            return res
                .status(200)
                .json({ listSuccess: false, error: 'list not found' });
        }

        return res.json({
            listSuccess: true,
            message: 'list successful',
            list: list.map(toSafeUser),
        });
    });
};

exports.listsMember = (req, res) => {
    const date = req.body.date;

    List.findByListMember(date, (err, list) => {
        if (err) {
            return res
                .status(200)
                .json({ listSuccess: false, error: 'Database query error' });
        }
        if (!list) {
            return res
                .status(200)
                .json({ listSuccess: false, error: 'list not found' });
        }

        return res.json({
            listSuccess: true,
            message: 'list successful',
            list: list.map(toSafeUser),
        });
    });
};
