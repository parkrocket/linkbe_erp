const jwt = require('jsonwebtoken');
const Company = require('../models/companyModel');
const secretKey = process.env.JWT_SECRET_KEY;
const requestIp = require('request-ip');
const moment = require('moment');

exports.list = (req, res) => {
    const date = moment().format('YYYY-MM-DD');

    Company.findByList((err, list) => {
        if (err) {
            return res.status(200).json({
                companyListSuccess: false,
                error: 'Database query error',
            });
        }
        if (!list) {
            return res
                .status(200)
                .json({ companyListSuccess: false, error: 'list not found' });
        }

        return res.json({
            companyListSuccess: true,
            message: 'list successful',
            // 공개 API — 번호·이름만 (쿼리와 별개로 응답에서도 한 번 더 제한)
            list: list.map(({ cp_id, cp_name }) => ({ cp_id, cp_name })),
        });
    });
};

exports.info = (req, res) => {
    const { cpId } = req.body;

    Company.findById(cpId, (err, info) => {
        if (err) {
            return res.status(200).json({
                companyListSuccess: false,
                error: 'Database query error',
            });
        }
        if (!info) {
            return res
                .status(200)
                .json({ companyListSuccess: false, error: 'info not found' });
        }

        return res.json({
            companyListSuccess: true,
            message: 'info successful',
            info,
        });
    });
};
