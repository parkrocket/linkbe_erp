const { google } = require('googleapis');

const auths = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
);

// 이벤트 조회
exports.events = async (req, res) => {
    try {
        const calendar = google.calendar({ version: 'v3', auth: auths });

        const timeMin = req.query.timeMin;
        const timeMax = req.query.timeMax;

        const userCalendarResponse = await calendar.events.list({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const holidayCalendarResponse = await calendar.events.list({
            calendarId: 'ko.south_korea#holiday@group.v.calendar.google.com',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const userEvents = userCalendarResponse.data.items.map(event => ({
            ...event,
            className: 'user-event', // 사용자 이벤트 클래스
        }));

        const holidayEvents = holidayCalendarResponse.data.items.map(event => ({
            ...event,
            className: 'holiday-event', // 공휴일 이벤트 클래스
        }));

        // 병합된 데이터 반환
        const combinedEvents = [...userEvents, ...holidayEvents].map(event => ({
            id: event.id,
            title: event.summary,
            start: event.start.date || event.start.dateTime,
            end: event.end.date || event.end.dateTime,
            allDay: !!event.start.date,
            className: event.className,
        }));

        res.status(200).json(combinedEvents);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({
            error: 'Error fetching events',
            details: error.message,
        });
    }
};

// 새 이벤트 추가
exports.insert = async (req, res) => {
    try {
        const { summary, start, end } = req.body;

        if (!summary || !start?.date || !end?.date) {
            return res
                .status(400)
                .json({ error: 'Missing summary, start.date, or end.date' });
        }

        const calendar = google.calendar({ version: 'v3', auth: auths });

        const event = {
            summary,
            description: summary,
            start: { date: start.date }, // 명확하게 'date' 사용
            end: { date: end.date }, // 명확하게 'date' 사용
        };

        const createdEvent = await calendar.events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            resource: event,
        });

        res.status(201).json({ eventId: createdEvent.data.id });
    } catch (error) {
        console.error(
            'Error adding event:',
            error.response?.data || error.message,
        );
        res.status(500).json({
            error: 'Error adding event',
            details: error.response?.data || error.message,
        });
    }
};

// 일정 수정
exports.update = async (req, res) => {
    console.log(req.body);

    try {
        const { id, summary, start, end } = req.body;

        if (!id || !summary || !start?.date || !end?.date) {
            return res.status(400).json({
                error: 'Missing id, summary, start.date, or end.date',
            });
        }

        const calendar = google.calendar({ version: 'v3', auth: auths });

        const event = {
            summary,
            description: summary,
            start: { date: start.date }, // 수정할 시작 날짜
            end: { date: end.date }, // 수정할 종료 날짜
        };

        const updatedEvent = await calendar.events.update({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            eventId: id,
            resource: event,
        });

        res.status(200).json({ updatedEvent: updatedEvent.data });
    } catch (error) {
        console.error(
            'Error updating event:',
            error.response?.data.errors || error.message,
        );
        res.status(500).json({
            error: 'Error updating event',
            details: error.response?.data || error.message,
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                error: 'Missing event ID',
            });
        }

        const calendar = google.calendar({ version: 'v3', auth: auths });

        await calendar.events.delete({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            eventId: id, // 삭제할 이벤트의 ID
        });

        res.status(200).json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error(
            'Error deleting event:',
            error.response?.data || error.message,
        );
        res.status(500).json({
            error: 'Error deleting event',
            details: error.response?.data || error.message,
        });
    }
};
