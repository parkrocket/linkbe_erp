const Vacation = require('../models/vacationModel');

exports.list = async (req, res) => {
    const { user_id } = req.body;

    const vacation = await Vacation.findByIdAsync(user_id);

    return res.json({ vacationSuccess: true, message: 'vacation successful', vacationList : vacation });
};


exports.cancel = async (req, res) => {
    const { id, stipNumber, vacaNumber, userId, calendar_id, type } = req.body;

    const vacation = await Vacation.cancel(id, stipNumber, vacaNumber, userId, calendar_id, type);

    return res.json({ vacationCancelSuccess: true, message: 'vacation Cancel successful', vacationList : vacation });
};