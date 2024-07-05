const db = require('../config/db');

const Company = {};

Company.findByList = (callback) => {
    db.query('SELECT * FROM lk_company', (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

module.exports = Company;
