const Vacation = require('../models/vacationModel');

exports.list = async (req, res) => {
    const { user_id } = req.body;

    const vacation = await Vacation.findByIdAsync(user_id);

    return res.json({
        vacationSuccess: true,
        message: 'vacation successful',
        vacationList: vacation,
    });
};

exports.cancel = async (req, res) => {
    const { id, stipNumber, vacaNumber, userId, calendar_id, type } = req.body;

    const vacation = await Vacation.cancel(
        id,
        stipNumber,
        vacaNumber,
        userId,
        calendar_id,
        type,
    );

    return res.json({
        vacationCancelSuccess: true,
        message: 'vacation Cancel successful',
        vacationList: vacation,
    });
};

exports.vcaWeeklyStatus = (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const { userId, date } = req.body;

    Vacation.findByVcaWeeklyStatus(userId, date, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        //console.log(gtw);
        return res.status(200).json({ gtwSuccess: true, gtw });
    });
};
