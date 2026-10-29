const pool = require('../config/dbPromise');
const { google } = require('googleapis');

const Apply = {};

const auths = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
);

// 근태 종류 → 차감 컬럼·일수 (재택은 차감 없음 — lk_user에 user_home 컬럼이 없음)
// column 값은 이 고정 표에서만 오므로 SQL에 넣어도 안전
const LEAVE_TYPES = {
    day: { column: 'user_stip', days: 1, label: '연차' },
    half: { column: 'user_stip', days: 0.5, label: '반차' },
    vacation: { column: 'user_vaca', days: 1, label: '휴가' },
    home: { column: null, days: 0, label: '재택' },
};

// 상태 코드를 가진 오류 — 컨트롤러가 그대로 HTTP 응답 코드로 사용
class ApplyError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
Apply.ApplyError = ApplyError;

// 'YYYY-MM-DD'이면서 실제 존재하는 날짜인지 (2026-13-40 등 차단)
const isValidDate = value =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;

const calendar = () => google.calendar({ version: 'v3', auth: auths });

// 근태 신청 — 검증 → 잔여·중복 확인 → 캘린더 일정 → 차감·저장을 한 트랜잭션으로
// (기존: 캘린더 먼저 생성, 잔여 검사 컬럼명 오류로 검사 무력화, 재택은 항상 실패)
Apply.insert = async ({ userId, date, type }) => {
    const leave = LEAVE_TYPES[type];
    if (!leave) throw new ApplyError(400, 'Invalid leave type');
    if (!isValidDate(date)) throw new ApplyError(400, 'Invalid date');

    const conn = await pool.getConnection();
    let eventId = null;
    try {
        await conn.beginTransaction();

        // FOR UPDATE: 동시에 두 번 신청해 잔여가 음수가 되는 것 방지
        const [users] = await conn.query(
            'SELECT user_name, user_stip, user_vaca FROM lk_user WHERE user_id = ? FOR UPDATE',
            [userId],
        );
        const user = users[0];
        if (!user) throw new ApplyError(404, 'User not found');
        if (leave.column && Number(user[leave.column]) < leave.days) {
            throw new ApplyError(409, 'Insufficient balance');
        }

        const [duplicates] = await conn.query('SELECT id FROM lk_vacation WHERE user_id = ? AND date = ? LIMIT 1', [
            userId,
            date,
        ]);
        if (duplicates.length) throw new ApplyError(409, 'Already applied on this date');

        const created = await calendar().events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            resource: {
                summary: `[${user.user_name}] ${leave.label}`,
                description: type,
                start: { date, timeZone: 'Asia/Seoul' },
                end: { date, timeZone: 'Asia/Seoul' },
            },
        });
        eventId = created.data.id;
        if (!eventId) throw new ApplyError(502, 'Calendar event creation failed');

        if (leave.column) {
            await conn.query(`UPDATE lk_user SET ${leave.column} = ${leave.column} - ? WHERE user_id = ?`, [
                leave.days,
                userId,
            ]);
        }
        const [result] = await conn.query(
            'INSERT INTO lk_vacation (user_id, type, date, va_datetime, calendar_id) VALUES (?, ?, ?, NOW(), ?)',
            [userId, type, date, eventId],
        );

        await conn.commit();
        return result.insertId;
    } catch (error) {
        await conn.rollback();
        // DB 반영이 취소됐으므로 이미 만든 캘린더 일정도 정리 (고아 일정 방지)
        if (eventId) {
            await calendar()
                .events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID, eventId })
                .catch(e => console.error('calendar cleanup failed:', eventId, e.message));
        }
        throw error;
    } finally {
        conn.release();
    }
};

// 근태 취소 — 본인 소유 확인 후 종류·캘린더 ID는 DB 값 사용, 잔여는 본인에게 복원
// (기존: id만으로 삭제 + 요청 바디의 userId에 복원 → 남의 근태 삭제·내 잔여 부풀리기 가능)
Apply.cancel = async ({ id, userId }) => {
    const conn = await pool.getConnection();
    let row;
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            'SELECT id, type, calendar_id FROM lk_vacation WHERE id = ? AND user_id = ? FOR UPDATE',
            [id, userId],
        );
        row = rows[0];
        if (!row) throw new ApplyError(404, 'Leave not found');

        await conn.query('DELETE FROM lk_vacation WHERE id = ?', [row.id]);
        const leave = LEAVE_TYPES[row.type];
        if (leave && leave.column) {
            await conn.query(`UPDATE lk_user SET ${leave.column} = ${leave.column} + ? WHERE user_id = ?`, [
                leave.days,
                userId,
            ]);
        }

        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }

    // 캘린더 정리는 커밋 후 — 실패해도 취소 자체는 유지하고 기록만
    if (row.calendar_id) {
        await calendar()
            .events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID, eventId: row.calendar_id })
            .catch(e => console.error('calendar delete failed:', row.calendar_id, e.message));
    }
};

module.exports = Apply;
