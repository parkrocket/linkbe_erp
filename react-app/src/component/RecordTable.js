import React from 'react';

import leftArrowImg from '../img/chevron_left_24dp_FILL0_wght400_GRAD0_opsz24.svg';
import rightArrowImg from '../img/chevron_right_24dp_FILL0_wght400_GRAD0_opsz24.svg';
import downloadImg from '../img/download.svg';
import TableStyle from '../css/RecordTable.module.css';
import moment from 'moment';

function RecordTable({ list }) {
    // 시간 포맷 변경 함수
    const formatTime = (time) => {
        if (!time) return '';
        return moment(time).format('HH시 mm분');
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
    const formattedList = list.map((item) => ({
        ...item,
        formattedStartTime: formatTime(item.start_time),
        formattedEndTime: formatTime(item.end_time),
        status: item.start_time && !item.end_time ? '출근중' : item.start_time && item.end_time ? '퇴근완료' : '미출근',
        workDuration: item.start_time && item.end_time ? calculateWorkDuration(item.start_time, item.end_time) : '',
    }));

    return (
        <section className=" margin-c">
            <div>
                <h1 className={TableStyle.title}>날짜별 근무 기록</h1>
                {/* 날짜 및 다운로드 영역 */}
                <div className={`${TableStyle.wrapper} display-f justify-sb`}>
                    <div className={TableStyle.date_wrapper}>
                        <span className={TableStyle.left_arrow}>
                            <img src={leftArrowImg} alt="left-arrow" />
                        </span>
                        <input type="date" id="currentDate" />
                        <span className={TableStyle.right_arrow}>
                            <img src={rightArrowImg} alt="right-arrow" />
                        </span>
                        <button type="button" name="today">
                            오늘
                        </button>
                    </div>
                    <div className={TableStyle.download_wrapper}>
                        <img src={downloadImg} alt="download" />
                        <a href="#" download="#">
                            데이터 다운로드
                        </a>
                    </div>
                </div>
                {/* 탭 선택 및 정렬 영역 */}
                <div className={TableStyle.work_wrapper}>
                    <ul>
                        <li className={`${TableStyle.click} ${TableStyle.all_button}`}>
                            <a href="#">전체</a>
                        </li>
                        <li className="work-button">
                            <a href="#">출근</a>
                        </li>
                        <li className="work-end-button">
                            <a href="#">퇴근</a>
                        </li>
                        <li className="not-work-button">
                            <a href="#">미출근</a>
                        </li>
                    </ul>
                    <div>
                        <select name="workview" id={TableStyle.workview}>
                            <option value="view1">20개씩 전체보기</option>
                        </select>
                    </div>
                </div>
                {/* 테이블 영역 */}
                <table>
                    <thead>
                        <tr>
                            <th>닉네임</th>
                            <th>근무 상태</th>
                            <th>출근 시간</th>
                            <th>출근 방법</th>
                            <th>퇴근 시간</th>
                            <th>퇴근 방법</th>
                            <th>근무 시간</th>
                            <th>비고</th>
                        </tr>
                    </thead>
                    <tbody className={TableStyle.work_data}>
                        {formattedList.map((item, index) => (
                            <tr key={index}>
                                <td>{item.user_name}</td>
                                <td>
                                    <span>{item.status}</span>
                                </td>
                                <td>{item.formattedStartTime}</td>
                                <td>{item.formattedStartTime ? '회사출근' : ''}</td>
                                <td>{item.formattedEndTime}</td>
                                <td>{item.formattedEndTime ? '회사퇴근' : ''}</td>
                                <td>{item.workDuration}</td>
                                <td>{item.remarks}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default RecordTable;
