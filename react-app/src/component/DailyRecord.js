import React, { useRef, useEffect, useState } from 'react';
import moment from 'moment';
import 'moment/locale/ko';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import RightContStyle from '../css/RightCont.module.scss';

function DailyRecord(dayGtw) {
    moment.locale('ko'); // 한국어 설정

    console.log(dayGtw);

    const date = moment(dayGtw.today).format('M월 D일(dd)');
    const startTime = moment(dayGtw.dayGtw.start_time).format('HH:mm');
    const endTime = dayGtw.dayGtw.end_time
        ? moment(dayGtw.dayGtw.end_time.end_time).format('HH:mm')
        : moment(dayGtw.dayGtw.start_time).add(9, 'hours').format('HH:mm');
    const [workStatus, setWorkStatus] = useState('');
    const [remainingTime, setRemainingTime] = useState('');
    const [overtime, setOvertime] = useState('');
    const [percentage, setPercentage] = useState(0);

    useEffect(() => {
        const startMoment = moment(dayGtw.dayGtw.start_time);
        const endMoment = dayGtw.dayGtw.end_time
            ? moment(dayGtw.dayGtw.end_time)
            : moment(dayGtw.dayGtw.start_time).add(9, 'hours');

        // 현재 시간 가져오기
        const now = moment();

        // 현재 시간과 시작 시간의 차이 계산
        const endTimeToCompare = dayGtw.dayGtw.end_time ? endMoment : now;
        const workedDuration = moment.duration(
            endTimeToCompare.diff(startMoment),
        );

        // 시간과 분 계산
        const workedHours = Math.floor(workedDuration.asHours());
        const workedMinutes = workedDuration.minutes();

        // 퇴근 시간과 현재 시간의 차이 계산
        const remainingDuration = moment.duration(endMoment.diff(now));

        // 남은 시간과 분 계산
        const remainingHours = Math.floor(remainingDuration.asHours());
        const remainingMinutes = remainingDuration.minutes();

        // 초과 근무 시간 계산
        const overtimeDuration = moment.duration(now.diff(endMoment));
        const overtimeHours = Math.max(
            Math.floor(overtimeDuration.asHours()),
            0,
        );

        const overtimeMinutes = Math.max(overtimeDuration.minutes(), 0);

        // 근로 백분율 계산 (총 근로 시간 9시간 = 540분)
        const totalWorkedMinutes = workedHours * 60 + workedMinutes;
        const percentageWorked = Math.min(
            Math.floor((totalWorkedMinutes / 540) * 100),
            100,
        );

        const location = dayGtw.dayGtw.location === 'office' ? '회사' : '재택';

        console.log(dayGtw.dayGtw.location);

        // 포맷팅된 문자열 생성
        const workStatusString = `<span>${workedHours}시간 ${workedMinutes}분</span> 근무중(${location}) 입니다.`;
        const remainingTimeString = `${remainingHours}시간 ${remainingMinutes}분`;
        const overtimeString = `${overtimeHours}시간 ${overtimeMinutes}분`;

        setWorkStatus(workStatusString);
        setRemainingTime(remainingTimeString);
        setOvertime(overtimeString);
        setPercentage(percentageWorked);
    }, [
        dayGtw.dayGtw.start_time,
        dayGtw.dayGtw.end_time,
        dayGtw.dayGtw.location,
    ]);
    /*
    const memoRef = useRef(null);
   
    const handlePencilClick = () => {
        alert('pencil clicked');
        if (memoRef.current) {
            memoRef.current.focus();
        }
    };
    */

    const handlePrevButton = () => {
        const today = moment(dayGtw.today).subtract(1, 'days');

        dayGtw.setToday(today.format('YYYY-MM-DD'));
        //alert('pencil clicked');
    };

    const handleNextButton = () => {
        const today = moment(dayGtw.today).add(1, 'days');
        dayGtw.setToday(today.format('YYYY-MM-DD'));
        //alert('pencil clicked');
    };

    return (
        <div className={`${RightContStyle.box01} ${RightContStyle.half}`}>
            <h3 className={`${RightContStyle.tit01} text-align-c`}>
                일간 기록
            </h3>
            <div
                className={`${RightContStyle.date} ${RightContStyle.arrow_cont_box01} display-f align-items-c justify-c text-align-c padding-b30`}
            >
                <button
                    type="button"
                    className={`${RightContStyle.left_arrow} display-b`}
                    id="daily_prev"
                    onClick={handlePrevButton}
                >
                    <span className="blind">이전</span>
                    <FontAwesomeIcon
                        icon={faChevronLeft}
                        style={{ color: '#555' }}
                        size="xl"
                        className="display-b margin-c"
                    />
                </button>
                <dl>
                    <dt className={`${RightContStyle.tit02}`}>오늘</dt>
                    <dd>{date}</dd>
                </dl>
                <button
                    type="button"
                    className={`${RightContStyle.right_arrow} display-b`}
                    id="daily_next"
                    onClick={handleNextButton}
                >
                    <span className="blind">다음</span>{' '}
                    <FontAwesomeIcon
                        icon={faChevronRight}
                        style={{ color: '#555' }}
                        size="xl"
                        className="display-b margin-c"
                    />
                </button>
            </div>
            <div className="max_400 margin-c ">
                <div
                    className={`${RightContStyle.time} display-f justify-sb align-items-c padding-b10`}
                >
                    <p className={`${RightContStyle.start_time}`}>
                        <span>출근시간</span>
                        <br />
                        {startTime}
                        <br />
                    </p>
                    <p className={`${RightContStyle.end_time} text-align-r`}>
                        <span>예상 퇴근 시간</span>
                        <br />
                        {endTime}
                    </p>
                </div>
                <div className={`${RightContStyle.percentage}`}>
                    <div
                        className={`${RightContStyle.current} text-align-c`}
                        style={{ width: `${percentage}%` }}
                    >
                        {percentage}%
                    </div>{' '}
                    <div className={`${RightContStyle.standard}`}></div>
                </div>
                <p
                    className={`${RightContStyle.work_time} padding-t20`}
                    dangerouslySetInnerHTML={{ __html: workStatus }}
                ></p>
                <div className={`${RightContStyle.info} padding-t20`}>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>잔여시간</dt>
                        <dd>{remainingTime}</dd>
                    </dl>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>휴게시간</dt>
                        <dd>1시간30분(12:00 - 13:30)</dd>
                    </dl>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>초과 근무 시간</dt>
                        <dd>{overtime}</dd>
                    </dl>
                    {/* 메모 
                    <dl className="display-f align-items-c justify-sb">
                        <dt>메모</dt>
                        <dd className={`${RightContStyle.memo} text-align-r`}>
                            <FontAwesomeIcon
                                icon={faPencil}
                                style={{ color: '#aaa' }}
                                className="display-ib margin-c"
                                onClick={handlePencilClick}
                                size="sm"
                            />
                            <input type="text" id="memo" ref={memoRef} />
                        </dd>
                    </dl>
                    */}
                </div>
            </div>
        </div>
    );
}

export default DailyRecord;
