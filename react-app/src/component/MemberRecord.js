import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import leftArrowImg from '../img/chevron_left_24dp_FILL0_wght400_GRAD0_opsz24.svg';
import rightArrowImg from '../img/chevron_right_24dp_FILL0_wght400_GRAD0_opsz24.svg';
//import downloadImg from '../img/download.svg';
import RightContStyle from '../css/RightCont.module.scss';
import TableStyle from '../css/RecordTable.module.css';

import moment from 'moment';
import Button from '../component/Button';
import { refresh } from '../_actions/user_action';
import { gtw } from '../_actions/gtw_action';

function RecordTable({
    list,
    date,
    setRecodeListDate,
    recodeAxiosLIst,
    setRecodeList,
}) {
    const [currentDate, setCurrentDate] = useState(date);

    const user = useSelector(state => state.user);

    const dispatch = useDispatch();

    // 시간 포맷 변경 함수
    const formatTime = time => {
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
    const formattedList = list.map(item => ({
        ...item,
        formattedStartTime: formatTime(item.start_time),
        formattedEndTime: formatTime(item.end_time),
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

    const dateHandleChange = event => {
        setRecodeListDate(event.target.value);
    };

    const handleLeftArrowClick = () => {
        const newDate = moment(currentDate)
            .subtract(1, 'days')
            .format('YYYY-MM-DD');
        setCurrentDate(newDate);
        setRecodeListDate(newDate);
    };

    const handleRightArrowClick = () => {
        const newDate = moment(currentDate).add(1, 'days').format('YYYY-MM-DD');
        setCurrentDate(newDate);
        setRecodeListDate(newDate);
    };

    const handleTodayClick = () => {
        const today = moment().format('YYYY-MM-DD');
        setCurrentDate(today);
        setRecodeListDate(today);
    };

    const handleClick = (message, gtw_status) => {
        const userId = user.userData.user.user_id;
        const type = gtw_status;
        const platform = 'homepage';

        const dataTosubmit = { message, userId, type, platform };

        if (type === 'done') {
            alert('퇴근 완료입니다. 오늘도 수고하셨습니다.');
        } else {
            dispatch(gtw(dataTosubmit)).then(response => {
                if (response.payload.gtwSuccess === true) {
                    console.log(userId);

                    dispatch(refresh(dataTosubmit)).then(response => {
                        if (response.payload.refreshSuccess === true) {
                            recodeAxiosLIst(setRecodeList, date);
                        } else {
                        }
                    });
                } else {
                    alert(response.payload.error);
                }
            });
        }
    };

    return (
        <div className={RightContStyle.box01}>
            <h3 className={`${RightContStyle.tit01} text-align-c`}>
                멤버별 근무 기록
            </h3>
            {/* 날짜 및 다운로드 영역 */}
            <div className={`${TableStyle.wrapper} display-f justify-sb`}>
                <div className={TableStyle.date_wrapper}>
                    <span
                        className={TableStyle.left_arrow}
                        onClick={handleLeftArrowClick}
                    >
                        <img src={leftArrowImg} alt="left-arrow" />
                    </span>
                    <input
                        type="date"
                        id="currentDate"
                        value={date}
                        onChange={dateHandleChange}
                    />
                    <span
                        className={TableStyle.right_arrow}
                        onClick={handleRightArrowClick}
                    >
                        <img src={rightArrowImg} alt="right-arrow" />
                    </span>
                    <button
                        type="button"
                        name="today"
                        onClick={handleTodayClick}
                    >
                        오늘
                    </button>
                </div>

                <div className={TableStyle.download_wrapper}>
                    {user.userData.user.gtw_status === 0 ? (
                        <Button
                            onClick={() => handleClick('출근하자!', 'gtw')}
                            className="bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 margin-c display-b"
                        >
                            출근하기
                        </Button>
                    ) : user.userData.user.gtw_status === 1 ? (
                        <Button
                            onClick={() => handleClick('퇴근하자!', 'go')}
                            className="bg-red-500 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 margin-c display-b"
                        >
                            퇴근하기
                        </Button>
                    ) : (
                        <Button
                            onClick={() => handleClick('퇴근완료', 'done')}
                            className="bg-green-500 text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300 p-20  margin-c display-b"
                        >
                            퇴근완료!!
                        </Button>
                    )}
                </div>
            </div>
            {/* 탭 선택 및 정렬 영역 */}
            {/*
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
                 */}
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
                            <td>
                                {item.formattedStartTime &&
                                    (item.location === 'office'
                                        ? '회사출근'
                                        : item.location === 'home'
                                        ? '재택출근'
                                        : '')}
                            </td>
                            <td>{item.formattedEndTime}</td>
                            <td>
                                {item.formattedEndTime &&
                                    (item.location === 'office'
                                        ? '회사퇴근'
                                        : item.location === 'home'
                                        ? '재택퇴근'
                                        : '')}
                            </td>
                            <td>{item.workDuration}</td>
                            <td>{item.remarks}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default RecordTable;
