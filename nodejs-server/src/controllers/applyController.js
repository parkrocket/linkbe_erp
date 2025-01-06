const Apply = require('../models/applyModel');

exports.applyIn = async (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const { userId, date, type, userName } = req.body;

    Apply.InsertApply(userId, date, type, userName, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        //console.log(gtw);
        return res.status(200).json({ gtwSuccess: true, gtw });
    });
};

exports.applyCancel = async (req, res) => {
    const { id, userId, type, calendar_id } = req.body;

    Apply.CancelApply(id, userId, type, calendar_id, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        //console.log(gtw);
        return res.status(200).json({ vacationCancelSuccess: true, gtw });
    });
};
