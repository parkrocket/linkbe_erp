const { google } = require('googleapis');

const auths = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
);

exports.events = async (req, res) => {
    try {
        const calendar = google.calendar({ version: 'v3', auth: auths });

        // 클라이언트에서 전달받은 날짜 범위
        const timeMin = req.query.timeMin;
        const timeMax = req.query.timeMax;

        const userCalendarResponse = await calendar.events.list({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            timeMin,
            timeMax,
            singleEvents: true, // 반복 이벤트를 단일 이벤트로 확장
            orderBy: 'startTime', // 시작 시간 순 정렬
        });

        // 대한민국 공휴일 캘린더에서 이벤트 가져오기
        const holidayCalendarResponse = await calendar.events.list({
            calendarId: 'ko.south_korea#holiday@group.v.calendar.google.com', // 대한민국 공휴일 캘린더 ID
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });

        // 사용자 이벤트와 공휴일 이벤트 합치기
        const combinedEvents = [
            ...userCalendarResponse.data.items,
            ...holidayCalendarResponse.data.items,
        ];

        const events = userCalendarResponse.data.items; // 이벤트 데이터

        res.status(200).json(combinedEvents); // 클라이언트에 반환
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Error fetching events' });
    }
};

exports.insert = async (req, res) => {
    const { summary, start, end } = req.body;

    const calendar = google.calendar({ version: 'v3', auth: auths });
    const event = {
        summary: `${summary}`,
        description: `${summary}`,
        start: { date: start, timeZone: 'Asia/Seoul' },
        end: { date: end, timeZone: 'Asia/Seoul' },
    };

    const createdEvent = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: event,
    });

    const eventId = createdEvent.data.id;

    console.log(eventId);
};
