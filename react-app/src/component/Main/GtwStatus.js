import React, { useEffect, useState } from 'react';
import UserMainStyle from '../../css/UserMain.module.scss';
import SERVER_URL from '../../Config';
import axios from 'axios';
import moment from 'moment';

function GtwStatus(props) {
    const [dayGtw, setDayGtw] = useState(null); // 초기값을 null로 설정
    const [today, setToday] = useState(moment().format('YYYY-MM-DD'));
    const [timer, setTimer] = useState('00:00');
    const [workTime, setWorkTime] = useState('출근 전입니다'); // 근무 시간 상태 초기값 설정
    const [endTime, setEndTime] = useState('00:00'); // 퇴근 시간 초기값 설정
    const [progress, setProgress] = useState(0); // 프로그레스 상태 초기값 설정

    useEffect(() => {
        gtwAxiosDay(setDayGtw, props.user.userData.user.user_id, today);
    }, [props.user.userData.user.user_id, today]);

    useEffect(() => {
        const timerId = setInterval(() => {
            const date = new Date();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            setTimer(`${hours}:${minutes}`);
        }, 1000);

        return () => clearInterval(timerId); // Clean up interval on unmount
    }, []);

    useEffect(() => {
        if (dayGtw && dayGtw.start_time) {
            const startMoment = moment(dayGtw.start_time);
            const endMoment = dayGtw.end_time
                ? moment(dayGtw.end_time)
                : moment(); // end_time이 있으면 그 시간을 사용, 없으면 현재 시간 사용

            const duration = moment.duration(endMoment.diff(startMoment));

            const workedHours = String(Math.floor(duration.asHours())).padStart(
                2,
                '0',
            );
            const workedMinutes = String(duration.minutes()).padStart(2, '0');
            setWorkTime(
                `<span>${workedHours}시 ${workedMinutes}분</span> 근무중입니다`,
            );

            if (dayGtw.end_time) {
                setEndTime(endMoment.format('HH:mm'));
            } else {
                setEndTime(startMoment.add(9, 'hours').format('HH:mm'));
            }

            // 프로그레스 바 백분율 계산 및 소수점 버림 처리, 최대값 100으로 제한
            const totalWorkedMinutes = duration.asMinutes();
            const percentageWorked = Math.min(
                Math.floor((totalWorkedMinutes / 540) * 100),
                100,
            ); // 최대값 100으로 제한
            setProgress(percentageWorked); // 프로그레스 상태 업데이트
        } else {
            // 출근 전일 경우 초기값 설정
            setWorkTime('출근 전');
            setEndTime('00:00');
            setProgress(0);
        }
    }, [dayGtw]);

    const gtwAxiosDay = (setDayGtw, userId, today) => {
        const dataTosubmit = { userId: userId, date: today };

        axios
            .post(`${SERVER_URL}/api/gtw/gtwStatus`, dataTosubmit)
            .then(response => {
                setDayGtw(response.data.gtw || {}); // 데이터가 없을 때 빈 객체로 설정
            });
    };

    const handleButtonClick = () => {
        if (!dayGtw || !dayGtw.start_time) {
            // 출근하기 버튼 클릭 처리
            console.log('출근하기 버튼 클릭');
        } else if (dayGtw.start_time && !dayGtw.end_time) {
            // 퇴근하기 버튼 클릭 처리
            console.log('퇴근하기 버튼 클릭');
        } else if (dayGtw.start_time && dayGtw.end_time) {
            // 퇴근완료 버튼 클릭 처리
            console.log('퇴근완료 버튼 클릭');
        }
    };

    let buttonText = '출근하기';
    if (dayGtw && dayGtw.start_time && !dayGtw.end_time) {
        buttonText = '퇴근하기';
    } else if (dayGtw && dayGtw.start_time && dayGtw.end_time) {
        buttonText = '퇴근완료';
    }

    const startTime =
        dayGtw && dayGtw.start_time
            ? moment(dayGtw.start_time).format('HH:mm')
            : '00:00';

    return (
        <div
            className={` ${UserMainStyle.work_check} ${UserMainStyle.box01} ${UserMainStyle.w40}  `}
        >
            <div
                className={`${UserMainStyle.work_time} display-f align-items-c justify-sb padding-t30 padding-b10 text-align-c`}
            >
                <p dangerouslySetInnerHTML={{ __html: workTime }}></p>{' '}
                <em>{progress}%</em> {/* 프로그레스 백분율 */}
            </div>
            <div className={`${UserMainStyle.progress}`}>
                <div
                    className={`${UserMainStyle.bar}`}
                    style={{ width: `${progress}%` }}
                ></div>
                <div className={`${UserMainStyle.status}`}></div>
            </div>
            <div
                className={`${UserMainStyle.time} display-f justify-sb align-items-c padding-t20 `}
            >
                <p className={`${UserMainStyle.start_time}`}>
                    <span>출근시간</span>
                    <br />
                    {startTime}
                    <br />
                </p>
                <p className={`${UserMainStyle.end_time} text-align-r`}>
                    <span>예상 퇴근 시간</span>
                    <br />
                    {endTime}
                </p>
            </div>
            <div className={`${UserMainStyle.buttons} display-f padding-t50`}>
                <button
                    type="button"
                    className={`${UserMainStyle.btn01} ${UserMainStyle.go_work} display-f align-items-c justify-c margin-c`}
                    onClick={handleButtonClick}
                >
                    <span className="display-f align-items-c justify-c align-content-c flex-wrap">
                        {buttonText}
                        <em>{timer}</em>
                    </span>
                </button>
            </div>
        </div>
    );
}

export default GtwStatus;
