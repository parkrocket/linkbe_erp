const db = require('../config/db');
const { google } = require('googleapis');

const Apply = {};

const auths = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
);

const leaveTypes = {
    day: { tp: 'stip', day: 1, hgName: '연차' },
    half: { tp: 'stip', day: 0.5, hgName: '반차' },
    vacation: { tp: 'vaca', day: 1, hgName: '휴가' },
    home: { tp: 'home', day: 1, hgName: '재택' },
};

const executeQuery = (query, params) =>
    new Promise((resolve, reject) => {
        db.query(query, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });

Apply.InsertApply = async (userId, date, type, userName, callback) => {
    try {
        const leaveInfo = leaveTypes[type];
        if (!leaveInfo) {
            return callback('Invalid leave type', null);
        }

        const { tp, day, hgName } = leaveInfo;

        const calendar = google.calendar({ version: 'v3', auth: auths });
        const event = {
            summary: `[${userName}] ${hgName}`,
            description: type,
            start: { date: date, timeZone: 'Asia/Seoul' },
            end: { date: date, timeZone: 'Asia/Seoul' },
        };

        const createdEvent = await calendar.events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            resource: event,
        });

        const eventId = createdEvent.data.id;
        if (!eventId) {
            return callback('Event creation failed', null);
        }

        const user = await executeQuery(
            'SELECT * FROM lk_user WHERE user_id = ? LIMIT 1',
            [userId],
        );

        if (tp !== 'home' && user[0][tp] < day) {
            return callback(`${tp} insufficient`, null);
        }

        await executeQuery(
            `UPDATE lk_user SET user_${tp} = user_${tp} - ? WHERE user_id = ?`,
            [day, userId],
        );

        const result = await executeQuery(
            'INSERT INTO lk_vacation (user_id, type, date, va_datetime, calendar_id) VALUES (?, ?, ?, NOW(), ?)',
            [userId, type, date, eventId],
        );

        callback(null, result.insertId);
    } catch (error) {
        console.error(
            'Error while processing leave application:',
            error.response?.data || error.message,
        );
        callback(error, null);
    }
};

Apply.CancelApply = async (id, userId, type, calendar_id, callback) => {
    try {
        // 1. Google Calendar 이벤트 삭제
        const calendar = google.calendar({ version: 'v3', auth: auths });

        if (calendar_id) {
            try {
                await calendar.events.delete({
                    calendarId: process.env.GOOGLE_CALENDAR_ID,
                    eventId: calendar_id,
                });
                console.log(
                    `Calendar event ${calendar_id} deleted successfully.`,
                );
            } catch (error) {
                console.error(
                    `Failed to delete calendar event: ${calendar_id}`,
                    error.response?.data || error.message,
                );
                return callback(
                    `Failed to delete calendar event: ${calendar_id}`,
                    null,
                );
            }
        }

        // 2. 데이터베이스에서 신청 정보 삭제
        const deleteQuery = 'DELETE FROM lk_vacation WHERE id = ?';
        await executeQuery(deleteQuery, [id]);

        // 3. 취소된 유형(type)에 따라 사용자 사용 가능 수량 복원
        const leaveTypes = {
            day: { tp: 'stip', day: 1 },
            half: { tp: 'stip', day: 0.5 },
            vacation: { tp: 'vaca', day: 1 },
            home: { tp: 'home', day: 1 },
        };

        const leaveInfo = leaveTypes[type];
        if (!leaveInfo) {
            return callback('Invalid leave type', null);
        }

        const { tp, day } = leaveInfo;

        // 복원 작업
        const updateQuery = `UPDATE lk_user SET user_${tp} = user_${tp} + ? WHERE user_id = ?`;
        await executeQuery(updateQuery, [day, userId]);

        // 4. 성공적으로 완료
        callback(
            null,
            `Leave application with ID ${id} has been successfully canceled.`,
        );
    } catch (error) {
        console.error(
            'Error while canceling leave application:',
            error.response?.data || error.message,
        );
        callback(error, null);
    }
};

module.exports = Apply;
