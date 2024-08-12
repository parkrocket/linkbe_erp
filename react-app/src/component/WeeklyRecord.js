import React, { useEffect, useState } from 'react';
import moment from 'moment';
import 'moment/locale/ko';
import SERVER_URL from '../Config';
import axios from 'axios';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import RightContStyle from '../css/RightCont.module.scss';

function WeeklyRecord(props) {
    moment.locale('ko'); // 한국어 설정

    const [weeklyGtw, setWeeklyGtw] = useState([]);
    const [totalWorkTime, setTotalWorkTime] = useState(0);
    const [remainingTime, setRemainingTime] = useState(0);
    const [overtime, setOvertime] = useState(0);
    const [percentage, setPercentage] = useState(0);
    const [startOfWeek, setStartOfWeek] = useState(
        moment().startOf('week').add(1, 'days'),
    );

    useEffect(() => {
        gtwAxiosWeekly(props.user.userData.user.user_id, startOfWeek);
        vcaAxiosWeekly(props.user.userData.user.user_id, startOfWeek);
    }, [props.user.userData.user.user_id, startOfWeek]);

    const gtwAxiosWeekly = (userId, startOfWeek) => {
        const dataTosubmit = {
            userId: userId,
            date: startOfWeek.format('YYYY-MM-DD'),
        };

        axios
            .post(`${SERVER_URL}/api/gtw/gtwWeeklyStatus`, dataTosubmit)
            .then(response => {
                const weeklyData = response.data.gtw || [];
                setWeeklyGtw(weeklyData);

                let totalMinutes = 0;
                weeklyData.forEach(record => {
                    if (record.end_time) {
                        const startTime = moment(record.start_time);
                        const endTime = moment(record.end_time);
                        let workMinutes = endTime.diff(startTime, 'minutes');

                        if (workMinutes > 60) {
                            workMinutes -= 60;
                        }

                        totalMinutes += workMinutes;
                    } else {
                        const startTime = moment(record.start_time);
                        const endTime = moment();
                        let workMinutes = endTime.diff(startTime, 'minutes');

                        if (workMinutes > 60) {
                            workMinutes -= 60;
                        }

                        totalMinutes += workMinutes;
                    }
                });

                setTotalWorkTime(totalMinutes);

                const requiredWorkTime = 40 * 60;
                setPercentage(
                    Math.min((totalMinutes / requiredWorkTime) * 100, 100),
                );

                setRemainingTime(Math.max(requiredWorkTime - totalMinutes, 0));

                const maxWorkTime = 40 * 60;
                setOvertime(Math.max(totalMinutes - maxWorkTime, 0));
            });
    };

    const vcaAxiosWeekly = (userId, startOfWeek) => {
        const dataTosubmit = {
            userId: userId,
            date: startOfWeek.format('YYYY-MM-DD'),
        };

        axios
            .post(`${SERVER_URL}/api/vacation/vcaWeeklyStatus`, dataTosubmit)
            .then(response => {
                console.log(response);
            });
    };

    const formatTime = minutes => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}시간 ${mins}분`;
    };

    const getWeekOfMonth = date => {
        const startOfMonth = moment(date).startOf('month');
        const startWeek = startOfMonth.week();
        const currentWeek = moment(date).week();

        let weekOfMonth = currentWeek - startWeek + 1;

        if (weekOfMonth <= 0) {
            weekOfMonth = moment(date).week();
        }

        return weekOfMonth;
    };

    const calculateRemainingDays = () => {
        const weekdays = [1, 2, 3, 4, 5]; // 월요일(1)부터 금요일(5)까지
        let remainingDays = 0;

        for (let i = 0; i < 5; i++) {
            const currentDay = startOfWeek.clone().add(i, 'days');
            const isWeekday = weekdays.includes(currentDay.day());

            // 주어진 주의 날짜들 중에서 평일만 카운트
            if (isWeekday) {
                // 이미 기록된 평일이 아니라면 잔여일로 계산
                const hasRecord = weeklyGtw.some(record =>
                    moment(record.date).isSame(currentDay, 'day'),
                );
                if (!hasRecord) {
                    remainingDays++;
                }
            }
        }

        return remainingDays;
    };

    return (
        <div className={`${RightContStyle.box01} ${RightContStyle.half} `}>
            <h3 className={`${RightContStyle.tit01} text-align-c`}>
                주간 기록
            </h3>
            <div
                className={`${RightContStyle.date} ${RightContStyle.arrow_cont_box01}  display-f align-items-c justify-c text-align-c padding-b30`}
            >
                <button
                    type="button"
                    className={`${RightContStyle.left_arrow} display-b`}
                    id="weekly_prev"
                    onClick={() =>
                        setStartOfWeek(startOfWeek.clone().subtract(1, 'week'))
                    }
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
                        {startOfWeek.format('M월')}{' '}
                        {getWeekOfMonth(startOfWeek)}째주
                    </dt>
                    <dd>
                        {startOfWeek.format('M월 D일(월)')} -{' '}
                        {startOfWeek
                            .clone()
                            .endOf('week')
                            .add(1, 'days')
                            .format('M월 D일(일)')}
                    </dd>
                </dl>
                <button
                    type="button"
                    className={`${RightContStyle.right_arrow} display-b`}
                    id="weekly_next"
                    onClick={() =>
                        setStartOfWeek(startOfWeek.clone().add(1, 'week'))
                    }
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
            <div className="max_400 margin-c">
                <div className={`${RightContStyle.percentage}`}>
                    <div
                        className={`${RightContStyle.current} text-align-c`}
                        style={{ width: `${percentage}%` }}
                    >
                        {Math.round(percentage)}%
                    </div>
                    <div className={`${RightContStyle.standard}`}></div>
                </div>
                <p className={`${RightContStyle.work_time} padding-t20`}>
                    <span>{formatTime(totalWorkTime)}</span> 근무중 입니다.
                </p>
                <div className={`${RightContStyle.info} padding-t20`}>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>잔여시간 / 잔여일</dt>
                        <dd>
                            {formatTime(remainingTime)} /{' '}
                            {calculateRemainingDays()}일
                        </dd>
                    </dl>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>필수 근무 시간</dt>
                        <dd>40시간</dd>
                    </dl>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>최대 근무 가능 시간</dt>
                        <dd>52시간</dd>
                    </dl>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>초과 근무 시간</dt>
                        <dd>{formatTime(overtime)}</dd>
                    </dl>
                </div>
            </div>
        </div>
    );
}

export default WeeklyRecord;
