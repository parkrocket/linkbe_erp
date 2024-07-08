const jwt = require('jsonwebtoken');
const Company = require('../models/companyModel');
const secretKey = process.env.JWT_SECRET_KEY;
const requestIp = require('request-ip');
const moment = require('moment');

exports.list = (req, res) => {
    const date = moment().format('YYYY-MM-DD');

    Company.findByList((err, list) => {
        if (err) {
            return res.status(200).json({ companyListSuccess: false, error: 'Database query error' });
        }
        if (!list) {
            return res.status(200).json({ companyListSuccess: false, error: 'list not found' });
        }

        return res.json({ companyListSuccess: true, message: 'list successful', list });
    });
};
