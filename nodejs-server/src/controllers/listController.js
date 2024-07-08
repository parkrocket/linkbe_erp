const jwt = require('jsonwebtoken');
const List = require('../models/listModel');
const secretKey = process.env.JWT_SECRET_KEY;
const requestIp = require('request-ip');
const moment = require('moment');

exports.lists = (req, res) => {
    const date = moment().format('YYYY-MM-DD');

    List.findByList(date, (err, list) => {
        if (err) {
            return res.status(200).json({ listSuccess: false, error: 'Database query error' });
        }
        if (!list) {
            return res.status(200).json({ listSuccess: false, error: 'list not found' });
        }

        return res.json({ listSuccess: true, message: 'list successful', list });
    });
};
