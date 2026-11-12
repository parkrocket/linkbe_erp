const pool = require('../config/dbPromise');
const axios = require('axios'); // 호출 시점에 모듈 객체에서 꺼냄 (점검 스크립트에서 가짜 교체)

// 공휴일 — 한국천문연구원 특일정보 API(공공데이터포털)의 '공휴일' 목록을 lk_holiday에 저장
// 대체·임시공휴일 포함. 회사 자체 휴일(창립기념일 등)은 이 API에 없음
const Holiday = {};

const API_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

// 포털이 주는 키 2종(Encoding·Decoding) 모두 허용 — axios가 다시 인코딩하므로 인코딩된 키는 풀어서 사용
// (이중 인코딩되면 SERVICE_KEY_IS_NOT_REGISTERED_ERROR)
const serviceKey = () => {
    const raw = (process.env.HOLIDAY_API_KEY || '').trim();
    if (!raw) throw new Error('HOLIDAY_API_KEY missing');
    return raw.includes('%') ? decodeURIComponent(raw) : raw;
};

// 한 해 공휴일 → [{ date: 'YYYY-MM-DD', name }] (날짜순, 같은 날 겹치면 이름을 합침)
Holiday.fetchYear = async year => {
    const res = await axios.get(API_URL, {
        params: { ServiceKey: serviceKey(), solYear: year, numOfRows: 100, _type: 'json' },
        timeout: 10000,
    });
    // 키 오류 등은 _type=json이어도 XML 문자열로 옴 → 형식이 다르면 실패로 처리(기존 데이터 유지)
    const body = res.data?.response?.body;
    if (res.data?.response?.header?.resultCode !== '00' || !body) throw new Error('Holiday API error');

    // 1건이면 배열이 아니라 객체, 0건이면 items가 빈 문자열
    const item = body.items?.item;
    const list = Array.isArray(item) ? item : item ? [item] : [];
    const byDate = new Map();
    for (const row of list) {
        if (row.isHoliday !== 'Y') continue;
        const raw = String(row.locdate);
        const name = String(row.dateName ?? '').trim();
        if (!/^\d{8}$/.test(raw) || !raw.startsWith(String(year)) || !name) throw new Error('Holiday API format');
        const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
        byDate.set(date, byDate.has(date) ? `${byDate.get(date)}, ${name}` : name);
    }
    return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, name]) => ({ date, name: name.slice(0, 100) }));
};

// 한 해 치를 받아 통째로 교체(취소된 임시공휴일도 반영). 0건이면 아무것도 바꾸지 않고 0 반환
Holiday.sync = async year => {
    const rows = await Holiday.fetchYear(year);
    if (!rows.length) return 0;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM lk_holiday WHERE holiday_date BETWEEN ? AND ?', [`${year}-01-01`, `${year}-12-31`]);
        await conn.query('INSERT INTO lk_holiday (holiday_date, name) VALUES ?', [rows.map(r => [r.date, r.name])]);
        await conn.commit();
        return rows.length;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// 기간 안의 공휴일 (양 끝 포함)
Holiday.list = async (from, to) => {
    const [rows] = await pool.query(
        "SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS date, name FROM lk_holiday WHERE holiday_date BETWEEN ? AND ? ORDER BY holiday_date",
        [from, to],
    );
    return rows;
};

module.exports = Holiday;
