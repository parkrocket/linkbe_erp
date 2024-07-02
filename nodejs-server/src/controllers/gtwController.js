const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const secretKey = process.env.JWT_SECRET_KEY;

exports.companyIn = (req, res) => {
    const { message } = req.body;

    console.log(message);
};
