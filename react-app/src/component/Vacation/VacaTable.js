import React from 'react';
import moment from 'moment';
import SERVER_URL from '../../Config';
import axios from 'axios';

import TableStyle from '../../css/RecordTable.module.scss';
import RightContStyle from '../../css/RightCont.module.scss';

function RecordTable({ list, setRecodeList }) {
    // 시간 포맷 변경 함수
    const formatTime = time => {
        if (!time) return '';
        return moment(time).format('YY년 MM월 DD일');
    };

    // 근무 시간 계산 함수
    const calculateWorkDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return '';
        const start = moment(startTime);
        const end = moment(endTime);
        const duration = moment.duration(end.diff(start));
        const hours = Math.floor(duration.asHours());
        const minutes = duration.minutes();
        const seconds = duration.seconds();
        return `${hours}시간 ${minutes}분 ${seconds}초`;
    };

    // 데이터를 미리 변환
    const formattedList = list.map(item => ({
        ...item,
        formattedDate: formatTime(item.date),
        formattedVaDate: formatTime(item.va_datetime),
        typeChange:
            item.type === 'half'
                ? '반차'
                : item.type === 'day'
                ? '연차'
                : item.type === 'vacation'
                ? '휴가'
                : '재택',
        stipNumber: item.type === 'half' ? 0.5 : item.type === 'day' ? 1 : '',
        vacaNumber: item.type === 'vacation' ? 1 : '',
        status:
            item.start_time && !item.end_time
                ? '출근중'
                : item.start_time && item.end_time
                ? '퇴근완료'
                : '미출근',
        workDuration:
            item.start_time && item.end_time
                ? calculateWorkDuration(item.start_time, item.end_time)
                : '',
    }));

    const vacaCancelHandler = (
        id,
        stipNumber,
        vacaNumber,
        userId,
        calendar_id,
        type,
    ) => {
        const dataTosubmit = {
            id,
            stipNumber,
            vacaNumber,
            userId,
            calendar_id,
            type,
        };
        axios
            .post(`${SERVER_URL}/api/vacation/cancel`, dataTosubmit)
            .then(response => {
                if (response.data.vacationCancelSuccess) {
                    alert('취소되었습니다.');
                    setRecodeList(response.data.vacationList);
                }
            });
    };

    return (
        <div className={RightContStyle.box01}>
            <h3 className={`${RightContStyle.tit01} text-align-c`}>
                연차 / 휴가 목록
            </h3>
            {/* 테이블 영역 */}
            <table>
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>타입</th>
                        <th>날짜</th>
                        <th>연차갯수</th>
                        <th>휴가갯수</th>
                        <th>신청일</th>
                        <th>신청취소</th>
                    </tr>
                </thead>
                <tbody className={TableStyle.work_data}>
                    {formattedList.map((item, index) => (
                        <tr key={index}>
                            <td>{item.user_name}</td>
                            <td>
                                <span>{item.typeChange}</span>
                            </td>
                            <td>{item.formattedDate}</td>
                            <td>{item.stipNumber}</td>
                            <td>{item.vacaNumber}</td>
                            <td>{item.formattedVaDate}</td>
                            <td>
                                <button
                                    onClick={() =>
                                        vacaCancelHandler(
                                            item.id,
                                            item.stipNumber,
                                            item.vacaNumber,
                                            item.user_id,
                                            item.calendar_id,
                                            item.type,
                                        )
                                    }
                                >
                                    취소하기
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default RecordTable;
