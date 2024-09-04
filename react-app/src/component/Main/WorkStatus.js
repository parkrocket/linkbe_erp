import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import SERVER_URL from '../../Config';
import axios from 'axios';

import moment from 'moment';
import 'moment/locale/ko';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faStopwatch,
    faFire,
    faBatteryQuarter,
    faThumbtack,
} from '@fortawesome/free-solid-svg-icons';

import UserMainStyle from '../../css/UserMain.module.scss';

function WorkStatus() {
    const user = useSelector(state => state.user);
    const [dayGtw, setDayGtw] = useState([]);
    const [timer, setTimer] = useState('00:00:00');

    const dateNow = moment().format('M월 D일 dddd');
    const today = moment().format('YYYY-MM-DD');

    useEffect(() => {
        if (user.userData && user.userData.user && user.userData.user.cp_id) {
            gtwAxiosDay(user.userData.user.cp_id, today);
        }
    }, [today, user.userData]);

    const gtwAxiosDay = (cpId, date) => {
        const dataTosubmit = { date, cpId };

        axios
            .post(`${SERVER_URL}/api/gtw/gtwStatusAll`, dataTosubmit)
            .then(response => {
                console.log('Response Data:', response.data);
                setDayGtw(response.data.gtw || []);
            });
    };

    // 근무 상태 카운트 계산
    const {
        officeCount,
        homeCount,
        leaveCount,
        vacationCount,
        lateCount,
        overtimeCount,
        underworkCount,
    } = useMemo(() => {
        let officeCount = 0;
        let homeCount = 0;
        let leaveCount = 0;
        let vacationCount = 0;
        let lateCount = 0;
        let overtimeCount = 0;
        let underworkCount = 0;

        const lateThreshold = moment(today + ' 10:01:00'); // 지각 기준 시간: 9시
        const workHoursStandard = 9; // 근무 시간 기준: 9시간

        dayGtw.forEach(member => {
            // 회사 출근과 재택 출근 계산
            if (member.start_time && !member.end_time) {
                if (member.gtw_location === 'office') {
                    officeCount++;
                } else if (member.gtw_location === 'home') {
                    homeCount++;
                }
            }

            const startTime = moment(member.start_time);
            if (startTime.isAfter(lateThreshold)) {
                lateCount++;
            }

            // 퇴근 계산
            if (member.start_time && member.end_time) {
                const startTime = moment(member.start_time);
                const endTime = moment(member.end_time);

                // 지각 계산: start_time이 지각 기준 시간 이후인지 확인
                leaveCount++;

                // 근무 시간 계산: 근무 시간이 기준보다 긴지 짧은지 확인

                const overtimeThreshold = startTime.clone().add(9, 'hours');

                if (endTime.isAfter(overtimeThreshold)) {
                    overtimeCount++;
                } else {
                    // 근무 시간 계산: 분 단위 비교
                    const workDuration = endTime.diff(startTime, 'minutes'); // 분 단위로 계산
                    const standardWorkDuration = 9 * 60; // 9시간 10분을 분으로 환산 (550분)

                    if (workDuration < standardWorkDuration) {
                        underworkCount++;
                    }
                }
            }

            // 휴가/연차 계산
            if (
                member.type === 'vacation' ||
                member.type === 'day' ||
                member.type === 'half'
            ) {
                vacationCount++;
            }
        });

        return {
            officeCount,
            homeCount,
            leaveCount,
            vacationCount,
            lateCount,
            overtimeCount,
            underworkCount,
        };
    }, [dayGtw, today]);

    // 멤버 상태 결정 함수
    const getStatus = member => {
        let statusText;
        let statusIcon;
        let listItemClass;

        if (
            !member.start_time &&
            !member.end_time &&
            member.type !== 'day' &&
            member.type !== 'half' &&
            member.type !== 'vacation'
        ) {
            statusText = '출근전';
            listItemClass = UserMainStyle.leave_work;
        } else if (
            member.start_time &&
            !member.end_time &&
            member.gtw_location === 'office'
        ) {
            statusText = '근무중';
            listItemClass = UserMainStyle.go_work;

            if (moment(member.start_time).isAfter(moment('10:01', 'HH:mm'))) {
                statusIcon = (
                    <FontAwesomeIcon
                        icon={faStopwatch}
                        style={{ color: '#226ce0' }}
                    />
                );
            }
        } else if (
            member.start_time &&
            !member.end_time &&
            member.gtw_location === 'home'
        ) {
            statusText = '근무중(재택)';
            listItemClass = UserMainStyle.go_work;
        } else if (member.start_time && member.end_time) {
            statusText = '업무종료';
            statusIcon = (
                <FontAwesomeIcon icon={faFire} style={{ color: '#ea4c4c' }} />
            );
            listItemClass = UserMainStyle.leave_work;
        } else if (member.type === 'day') {
            statusText = '연차';
            listItemClass = UserMainStyle.leave_work;
        } else if (member.type === 'half') {
            statusText = '반차';
            listItemClass = UserMainStyle.leave_work;
        } else if (member.type === 'vacation') {
            statusText = '휴가';
            listItemClass = UserMainStyle.leave_work;
        }

        return { statusText, statusIcon, listItemClass };
    };

    return (
        <div
            className={`${UserMainStyle.member_work} ${UserMainStyle.box01} ${UserMainStyle.w60} display-f flex-wrap`}
        >
            <h3 className={UserMainStyle.tit}>
                근무 현황
                <Link to="/work">더보기</Link>
            </h3>

            <ul
                className={`${UserMainStyle.summary} display-f justify-sb align-items-c text-align-c`}
            >
                <li>
                    <Link>
                        <p className={`${UserMainStyle.cate}`}>회사/재택</p>
                        <p className={`${UserMainStyle.count}`}>
                            {officeCount}/{homeCount}
                        </p>
                    </Link>
                </li>
                <li>
                    <Link>
                        <p className={`${UserMainStyle.cate}`}>퇴근</p>
                        <p className={`${UserMainStyle.count}`}>{leaveCount}</p>
                    </Link>
                </li>
                <li>
                    <Link>
                        <p className={`${UserMainStyle.cate}`}>휴가/연차</p>
                        <p className={`${UserMainStyle.count}`}>
                            {vacationCount}
                        </p>
                    </Link>
                </li>
                <li>
                    <Link>
                        <p className={`${UserMainStyle.cate}`}>
                            <FontAwesomeIcon
                                icon={faStopwatch}
                                style={{ color: '#226ce0' }}
                                size="xl"
                                className="display-b margin-c"
                            />
                            지각
                        </p>
                        <p className={`${UserMainStyle.count}`}>{lateCount}</p>
                    </Link>
                </li>
                <li>
                    <Link>
                        <p className={`${UserMainStyle.cate}`}>
                            <FontAwesomeIcon
                                icon={faFire}
                                style={{ color: '#ea4c4c' }}
                                size="xl"
                                className="display-b margin-c"
                            />
                            초과근무
                        </p>
                        <p className={`${UserMainStyle.count}`}>
                            {overtimeCount}
                        </p>
                    </Link>
                </li>
                <li>
                    <Link>
                        <p className={`${UserMainStyle.cate}`}>
                            <FontAwesomeIcon
                                icon={faBatteryQuarter}
                                style={{ color: '#bbb' }}
                                size="xl"
                                className="display-b margin-c"
                            />
                            근무미달
                        </p>
                        <p className={`${UserMainStyle.count}`}>
                            {underworkCount}
                        </p>
                    </Link>
                </li>
            </ul>

            <ul
                className={`${UserMainStyle.member} display-f align-items-c flex-wrap text-align-c padding-t30`}
            >
                {dayGtw.map((member, index) => {
                    const { statusText, statusIcon, listItemClass } =
                        getStatus(member);
                    return (
                        <li
                            key={index}
                            className={`${listItemClass} display-f justify-sb flex-wrap`}
                        >
                            <Link className="display-ib">
                                {member.user_name}
                            </Link>
                            <p className={`${UserMainStyle.status} display-ib`}>
                                {statusText} {statusIcon}
                            </p>
                            <p className={`${UserMainStyle.time} text-align-l`}>
                                {member.start_time ? (
                                    <>
                                        {moment(member.start_time).format(
                                            'HH:mm',
                                        )}{' '}
                                        ~
                                        {member.end_time
                                            ? moment(member.end_time).format(
                                                  'HH:mm',
                                              )
                                            : moment(member.start_time)
                                                  .add(9, 'hours')
                                                  .format('HH:mm')}
                                    </>
                                ) : (
                                    '-'
                                )}
                            </p>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default WorkStatus;
