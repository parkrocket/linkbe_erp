const pool = require('../config/dbPromise');
const BalanceLog = require('./balanceLog');
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

const HOME_LIMIT_PER_MONTH = 2; // 재택 월 최대 횟수 (회사 규정, 2026-10-29)
const MAX_DATES_PER_REQUEST = 31; // 한 번에 신청 가능한 최대 일수 (요청 남용 방지)

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

// 토·일 (날짜 문자열을 UTC 자정으로 해석해 요일만 판단)
const isWeekend = value => [0, 6].includes(new Date(`${value}T00:00:00Z`).getUTCDay());

// 한국 시간 기준 오늘 'YYYY-MM-DD' — 운영 서버 시계는 UTC라 그대로 쓰면 00~09시에 어제로 계산됨
Apply.kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
// 테스트에서 고정할 수 있도록 분리
Apply.today = () => Apply.kstToday();

const countBy = (items, keyOf) =>
    items.reduce((acc, item) => ({ ...acc, [keyOf(item)]: (acc[keyOf(item)] ?? 0) + 1 }), {});

// 'YYYY-MM-DD' → 'MM/DD' (장부 메모용)
const monthDay = date => date.slice(5).replace('-', '/');

// 잔여 컬럼 → 장부의 전·후 값 형태 (해당 컬럼만 delta만큼 변화)
const balanceOf = user => ({ stip: user.user_stip, vaca: user.user_vaca });
const shifted = (user, column, delta) => {
    const next = { ...balanceOf(user) };
    const key = column === 'user_stip' ? 'stip' : 'vaca';
    next[key] = Number(next[key]) + delta;
    return next;
};

const calendar = () => google.calendar({ version: 'v3', auth: auths });

// 근태 여러 날 신청 — 하나라도 안 되면 전체 거절(사용자 결정). 검증 → 잔여·중복·재택 횟수 확인 →
// 날짜별 캘린더 일정 → 차감·저장을 한 트랜잭션으로
// (기존: 캘린더 먼저 생성, 잔여 검사 컬럼명 오류로 검사 무력화, 재택은 항상 실패)
Apply.insertMany = async ({ userId, dates, type }) => {
    const leave = LEAVE_TYPES[type];
    if (!leave) throw new ApplyError(400, 'Invalid leave type');
    if (!Array.isArray(dates) || dates.length === 0 || dates.length > MAX_DATES_PER_REQUEST) {
        throw new ApplyError(400, 'Invalid date');
    }
    if (!dates.every(isValidDate) || new Set(dates).size !== dates.length) throw new ApplyError(400, 'Invalid date');
    if (dates.some(isWeekend)) throw new ApplyError(400, 'Weekend not allowed');
    // 오늘 이전 날짜 불가 (오늘은 가능) — 'YYYY-MM-DD' 문자열 비교로 충분
    const today = Apply.today();
    if (dates.some(d => d < today)) throw new ApplyError(400, 'Past date not allowed');
    const sorted = [...dates].sort();

    const conn = await pool.getConnection();
    const events = [];
    try {
        await conn.beginTransaction();

        // FOR UPDATE: 같은 사용자의 동시 신청을 직렬화 — 잔여 음수·재택 횟수 초과 경쟁 방지
        const [users] = await conn.query(
            'SELECT mb_no, cp_id, user_name, user_stip, user_vaca, user_status FROM lk_user WHERE user_id = ? FOR UPDATE',
            [userId],
        );
        const user = users[0];
        if (!user) throw new ApplyError(404, 'User not found');
        // 승인된 계정만 신청 (웹은 requireAuth가 먼저 막지만 Slack 경로는 여기서 막아야 함)
        if (user.user_status !== 'approved') throw new ApplyError(403, 'Account not approved');
        const totalDays = leave.days * sorted.length;
        if (leave.column && Number(user[leave.column]) < totalDays) {
            throw new ApplyError(409, 'Insufficient balance');
        }

        const [duplicates] = await conn.query('SELECT id FROM lk_vacation WHERE user_id = ? AND date IN (?) LIMIT 1', [
            userId,
            sorted,
        ]);
        if (duplicates.length) throw new ApplyError(409, 'Already applied on this date');

        // 재택: 신청 날짜가 속한 달(달력 기준)마다 기존 + 이번 선택이 HOME_LIMIT_PER_MONTH회 이하 — 회사 규정
        if (type === 'home') {
            const selectedByMonth = countBy(sorted, d => d.slice(0, 7));
            const [rows] = await conn.query(
                "SELECT DATE_FORMAT(date, '%Y-%m') AS ym, COUNT(*) AS count FROM lk_vacation WHERE user_id = ? AND type = 'home' AND DATE_FORMAT(date, '%Y-%m') IN (?) GROUP BY ym",
                [userId, Object.keys(selectedByMonth)],
            );
            const existing = Object.fromEntries(rows.map(r => [r.ym, Number(r.count)]));
            const over = Object.entries(selectedByMonth).some(([ym, n]) => (existing[ym] ?? 0) + n > HOME_LIMIT_PER_MONTH);
            if (over) throw new ApplyError(409, 'Monthly home limit exceeded');
        }

        // 날짜별 캘린더 일정 (기존과 동일하게 하루 1건)
        for (const date of sorted) {
            const created = await calendar().events.insert({
                calendarId: process.env.GOOGLE_CALENDAR_ID,
                resource: {
                    summary: `[${user.user_name}] ${leave.label}`,
                    description: type,
                    start: { date, timeZone: 'Asia/Seoul' },
                    end: { date, timeZone: 'Asia/Seoul' },
                },
            });
            if (!created.data.id) throw new ApplyError(502, 'Calendar event creation failed');
            events.push({ date, id: created.data.id });
        }

        if (leave.column) {
            await conn.query(`UPDATE lk_user SET ${leave.column} = ${leave.column} - ? WHERE user_id = ?`, [
                totalDays,
                userId,
            ]);
            // 같은 트랜잭션으로 장부 기록 — 실패 시 신청 전체 롤백
            await BalanceLog.insert(conn, {
                cpId: user.cp_id,
                mbNo: user.mb_no,
                actorMbNo: user.mb_no,
                kind: 'apply',
                before: balanceOf(user),
                after: shifted(user, leave.column, -totalDays),
                memo: `${leave.label} 신청 ${sorted.map(monthDay).join(', ')}`,
            });
        }
        const insertIds = [];
        for (const { date, id } of events) {
            const [result] = await conn.query(
                'INSERT INTO lk_vacation (user_id, type, date, va_datetime, calendar_id) VALUES (?, ?, ?, NOW(), ?)',
                [userId, type, date, id],
            );
            insertIds.push(result.insertId);
        }

        await conn.commit();
        return insertIds;
    } catch (error) {
        await conn.rollback();
        // DB 반영이 취소됐으므로 이미 만든 캘린더 일정도 모두 정리 (고아 일정 방지)
        for (const { id } of events) {
            await calendar()
                .events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID, eventId: id })
                .catch(e => console.error('calendar cleanup failed:', id, e.message));
        }
        throw error;
    } finally {
        conn.release();
    }
};

// 하루 신청 (기존 react-app 호환) — 여러 날 신청과 같은 규칙
Apply.insert = async ({ userId, date, type }) => {
    const [id] = await Apply.insertMany({ userId, dates: [date], type });
    return id;
};

// 근태 취소 공통 처리 — 대상 조회 조건만 다르고(본인 / 같은 회사 관리자) 삭제·잔여 복원·장부·캘린더 정리는 같음
// where·params: 대상 조회 조건, actorMbNo: 장부 변경자(없으면 본인), memoSuffix: 장부 메모 뒤에 붙일 말, notPast: 지난 날짜 거절
const cancelLeave = async ({ where, params, actorMbNo, memoSuffix = '', notPast = false }) => {
    const conn = await pool.getConnection();
    let row;
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT v.id, v.type, v.calendar_id, v.user_id, u.user_name, DATE_FORMAT(v.date, '%m/%d') AS md, DATE_FORMAT(v.date, '%Y-%m-%d') AS ymd
             FROM lk_vacation v JOIN lk_user u ON u.user_id = v.user_id WHERE ${where} FOR UPDATE`,
            params,
        );
        row = rows[0];
        if (!row) throw new ApplyError(404, 'Leave not found');
        // 오늘(KST)은 가능, 지난 날짜는 불가 — 'YYYY-MM-DD' 문자열 비교
        if (notPast && row.ymd < Apply.today()) throw new ApplyError(400, 'Past date not allowed');

        await conn.query('DELETE FROM lk_vacation WHERE id = ?', [row.id]);
        const leave = LEAVE_TYPES[row.type];
        if (leave && leave.column) {
            // 장부의 '변경 전' 값을 위해 사용자 행 잠금 (동시 신청·조정과 직렬화)
            const [users] = await conn.query(
                'SELECT mb_no, cp_id, user_stip, user_vaca FROM lk_user WHERE user_id = ? FOR UPDATE',
                [row.user_id],
            );
            const user = users[0];
            await conn.query(`UPDATE lk_user SET ${leave.column} = ${leave.column} + ? WHERE user_id = ?`, [
                leave.days,
                row.user_id,
            ]);
            await BalanceLog.insert(conn, {
                cpId: user.cp_id,
                mbNo: user.mb_no,
                actorMbNo: actorMbNo ?? user.mb_no,
                kind: 'cancel',
                before: balanceOf(user),
                after: shifted(user, leave.column, leave.days),
                memo: `${leave.label} 취소 ${row.md}${memoSuffix}`,
            });
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
    return row;
};

// 본인 취소 — 소유 확인(id + 토큰 주인), 종류·캘린더 ID는 DB 값 사용
// (기존: id만으로 삭제 + 요청 바디의 userId에 복원 → 남의 근태 삭제·내 잔여 부풀리기 가능)
Apply.cancel = async ({ id, userId }) => {
    await cancelLeave({ where: 'v.id = ? AND v.user_id = ?', params: [id, userId] });
};

// 관리자 대신 취소 — 같은 회사 직원의 오늘 이후 근태만, 장부 변경자는 관리자·메모에 사유
Apply.cancelByAdmin = async ({ id, cpId, actorMbNo, reason }) => {
    const row = await cancelLeave({
        where: 'v.id = ? AND u.cp_id = ?',
        params: [id, cpId],
        actorMbNo,
        memoSuffix: ` (관리자: ${reason})`,
        notPast: true,
    });
    return { userName: row.user_name, type: row.type, md: row.md };
};

module.exports = Apply;
