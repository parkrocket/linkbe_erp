const db = require('../config/db');

const Company = {};

Company.findByList = callback => {
    db.query('SELECT * FROM lk_company', (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

Company.findById = (cpId, callback) => {
    db.query(
        'SELECT * FROM lk_company WHERE cp_id = ?',
        [cpId],
        (err, results) => {
            if (err) {
                return callback(err, null);
            }
            return callback(null, results[0]);
        },
    );
};

module.exports = Company;
