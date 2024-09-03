import React, { useRef, useEffect, useState } from 'react';
import moment from 'moment';
import 'moment/locale/ko';
import SERVER_URL from '../../Config';
import axios from 'axios';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import RightContStyle from '../../css/RightCont.module.scss';

function DailyRecord(props) {
    moment.locale('ko'); // 한국어 설정

    const [dayGtw, setDayGtw] = useState(null); // 초기값을 null로 설정
    const [workStatus, setWorkStatus] = useState('');
    const [remainingTime, setRemainingTime] = useState('');
    const [overtime, setOvertime] = useState('');
    const [percentage, setPercentage] = useState(0);
    const [percentageCss, setPercentageCss] = useState(0);
    const [today, setToday] = useState(moment().format('YYYY-MM-DD'));

    useEffect(() => {
        gtwAxiosDay(setDayGtw, props.user.userData.user.user_id, today);
    }, [props.user.userData.user.user_id, today]);

    useEffect(() => {
        if (!dayGtw) return;

        const startMoment = moment(dayGtw.start_time);
        const endMoment = dayGtw.end_time
            ? moment(dayGtw.end_time)
            : moment(dayGtw.start_time).add(9, 'hours');

        const endTimeMoment = moment(dayGtw.start_time).add(9, 'hours');
        const endTimes = moment(dayGtw.end_time);

        const now = moment();
        const endTimeToCompare = dayGtw.end_time ? endMoment : now;
        const workedDuration = moment.duration(
            endTimeToCompare.diff(startMoment),
        );

        const workedHours = Math.floor(workedDuration.asHours());
        const workedMinutes = workedDuration.minutes();

        const remainingDuration = moment.duration(endMoment.diff(now));
        const remainingHours = Math.floor(remainingDuration.asHours());
        const remainingMinutes = remainingDuration.minutes();

        const overtimeDuration = dayGtw.end_time
            ? moment.duration(endTimes.diff(endTimeMoment))
            : moment.duration(now.diff(endTimeMoment));
        const overtimeHours = Math.max(
            Math.floor(overtimeDuration.asHours()),
            0,
        );

        const overtimeMinutes = Math.max(overtimeDuration.minutes(), 0);

        const totalWorkedMinutes = workedHours * 60 + workedMinutes;

        const percentageWorked = Math.floor((totalWorkedMinutes / 540) * 100);

        const percentageWorkedCss = Math.min(
            Math.floor((totalWorkedMinutes / 540) * 100),
            100,
        );

        const location = dayGtw.location === 'office' ? '회사' : '재택';

        const workStatusString = dayGtw.end_time
            ? `<span>${workedHours}시간 ${workedMinutes}분</span> 근무(${location})`
            : `<span>${workedHours}시간 ${workedMinutes}분</span> 근무중(${location}) 입니다.`;
        const remainingTimeString = dayGtw.end_time
            ? `없음`
            : `${remainingHours}시간 ${remainingMinutes}분`;
        const overtimeString = `${overtimeHours}시간 ${overtimeMinutes}분`;

        setWorkStatus(workStatusString);
        setRemainingTime(remainingTimeString);
        setOvertime(overtimeString);
        setPercentage(percentageWorked);
        setPercentageCss(percentageWorkedCss);
    }, [dayGtw]);

    const gtwAxiosDay = (setDayGtw, userId, today) => {
        const dataTosubmit = { userId: userId, date: today };

        axios
            .post(`${SERVER_URL}/api/gtw/gtwStatus`, dataTosubmit)
            .then(response => {
                setDayGtw(response.data.gtw || {}); // 데이터가 없을 때 빈 객체로 설정
            });
    };

    const handlePrevButton = () => {
        if (!dayGtw) return;
        const todays = moment(today).subtract(1, 'days');
        setToday(todays.format('YYYY-MM-DD'));
    };

    const handleNextButton = () => {
        if (!dayGtw) return;
        const todays = moment(today).add(1, 'days');
        setToday(todays.format('YYYY-MM-DD'));
    };

    if (dayGtw === null) {
        return <div>Loading...</div>; // 데이터를 받아오기 전에는 로딩 표시
    }

    const isToday = moment(today).isSame(moment(), 'day'); // 오늘 날짜인지 확인

    const date = moment(today).format('M월 D일(dd)');
    const startTime = dayGtw.start_time
        ? moment(dayGtw.start_time).format('HH:mm')
        : '';
    const endTime = dayGtw.end_time
        ? moment(dayGtw.end_time).format('HH:mm')
        : moment(dayGtw.start_time).add(9, 'hours').format('HH:mm');

    const backgroundColor = percentage > 100 ? 'red' : '#3562e4';

    const getRelativeDayLabel = () => {
        const daysDifference = moment(today)
            .startOf('day')
            .diff(moment().startOf('day'), 'days');
        if (daysDifference === -1) return '1일 전';
        if (daysDifference < 0) return `${Math.abs(daysDifference)}일 전`;
        if (daysDifference === 1) return '1일 후';
        if (daysDifference > 0) return `${daysDifference}일 후`;
        return '오늘';
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
                    <dt className={`${RightContStyle.tit02}`}>
                        {getRelativeDayLabel()}
                    </dt>

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
                {Object.keys(dayGtw).length === 0 ? (
                    <div>출퇴근 기록이 없습니다</div>
                ) : (
                    <>
                        <div
                            className={`${RightContStyle.time} display-f justify-sb align-items-c padding-b10`}
                        >
                            <p className={`${RightContStyle.start_time}`}>
                                <span>출근시간</span>
                                <br />
                                {startTime}
                                <br />
                            </p>
                            <p
                                className={`${RightContStyle.end_time} text-align-r`}
                            >
                                <span>
                                    {dayGtw.end_time
                                        ? '퇴근시간'
                                        : '예상 퇴근 시간'}
                                </span>
                                <br />
                                {endTime}
                            </p>
                        </div>
                        <div className={`${RightContStyle.percentage}`}>
                            <div
                                className={`${RightContStyle.current} text-align-c`}
                                style={{
                                    width: `${percentageCss}%`,
                                    background: backgroundColor,
                                }}
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
                                <dd>1시간(12:00 - 13:00)</dd>
                            </dl>
                            <dl className="display-f align-items-c justify-sb">
                                <dt>초과 근무 시간</dt>
                                <dd>{overtime}</dd>
                            </dl>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default DailyRecord;
