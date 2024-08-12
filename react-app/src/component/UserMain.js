import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import SERVER_URL from '../Config';
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

import UserMainStyle from '../css/UserMain.module.scss';

function UserMain() {
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
                setDayGtw(response.data.gtw || []);
            });
    };

    useEffect(() => {
        const timerId = setInterval(() => {
            const date = new Date();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            setTimer(`${hours}:${minutes}`);
        }, 1000);

        return () => clearInterval(timerId); // Clean up interval on unmount
    }, []);

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

        const lateThreshold = moment(today + ' 10:00:00'); // 지각 기준 시간: 9시
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
                const workDuration = endTime.diff(startTime, 'hours');
                if (workDuration > workHoursStandard) {
                    overtimeCount++;
                } else if (workDuration < workHoursStandard) {
                    underworkCount++;
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

        if (!member.start_time && !member.end_time) {
            statusText = '출근전';
            listItemClass = UserMainStyle.leave_work;
        } else if (
            member.start_time &&
            !member.end_time &&
            member.gtw_location === 'office'
        ) {
            statusText = '근무중';
            statusIcon = (
                <FontAwesomeIcon
                    icon={faStopwatch}
                    style={{ color: '#226ce0' }}
                />
            );
            listItemClass = UserMainStyle.go_work;
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
        <div className={`${UserMainStyle.wrapper} padding-t100 padding-b150`}>
            <div className={`${UserMainStyle.tit_area} padding-b40 `}>
                <p className={`${UserMainStyle.date} text-align-r padding-b20`}>
                    {dateNow}
                </p>
                <p className={`${UserMainStyle.greetings} `}>
                    안녕하세요!
                    {user.userData && user.userData.user && (
                        <span> {user.userData.user.user_name}님,</span>
                    )}
                    <br /> 오늘도 멋진 하루 보내세요!
                </p>
            </div>

            <div
                className={`${UserMainStyle.column_reverse} display-f justify-sb flex-wrap`}
            >
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
                                <p className={`${UserMainStyle.cate}`}>
                                    회사/재택
                                </p>
                                <p className={`${UserMainStyle.count}`}>
                                    {officeCount}/{homeCount}
                                </p>
                            </Link>
                        </li>
                        <li>
                            <Link>
                                <p className={`${UserMainStyle.cate}`}>퇴근</p>
                                <p className={`${UserMainStyle.count}`}>
                                    {leaveCount}
                                </p>
                            </Link>
                        </li>
                        <li>
                            <Link>
                                <p className={`${UserMainStyle.cate}`}>
                                    휴가/연차
                                </p>
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
                                <p className={`${UserMainStyle.count}`}>
                                    {lateCount}
                                </p>
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
                                    <p
                                        className={`${UserMainStyle.status} display-ib`}
                                    >
                                        {statusText} {statusIcon}
                                    </p>
                                    <p
                                        className={`${UserMainStyle.time} text-align-l`}
                                    >
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
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div
                    className={` ${UserMainStyle.work_check} ${UserMainStyle.box01} ${UserMainStyle.w40}  `}
                >
                    <div
                        className={`${UserMainStyle.work_time} display-f align-items-c justify-sb padding-t30 padding-b10 text-align-c`}
                    >
                        <p>
                            <span>5시간 39분</span> 근무중입니다.
                        </p>{' '}
                        <em>82%</em>
                    </div>
                    <div className={`${UserMainStyle.progress}`}>
                        <div className={`${UserMainStyle.bar}`}></div>
                        <div className={`${UserMainStyle.status}`}></div>
                    </div>
                    <div
                        className={`${UserMainStyle.time} display-f justify-sb align-items-c padding-t20 `}
                    >
                        <p className={`${UserMainStyle.start_time}`}>
                            <span>출근시간</span>
                            <br />
                            10:30
                            <br />
                        </p>
                        <p className={`${UserMainStyle.end_time} text-align-r`}>
                            <span>예상 퇴근 시간</span>
                            <br />
                            19:30
                        </p>
                    </div>
                    <div
                        className={`${UserMainStyle.buttons} display-f padding-t50`}
                    >
                        <button
                            type="button"
                            className={`${UserMainStyle.btn01} ${UserMainStyle.go_work} display-f align-items-c justify-c margin-c`}
                        >
                            <span className="display-f align-items-c justify-c align-content-c flex-wrap">
                                출근하기
                                <em>{timer}</em>
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="display-f justify-sb flex-wrap">
                <div className={` ${UserMainStyle.box01} ${UserMainStyle.w60}`}>
                    <h3 className={UserMainStyle.tit}>
                        공지사항 <Link>더보기</Link>
                    </h3>
                    <div
                        className={`${UserMainStyle.notification} padding-t30`}
                    >
                        <Link className={`display-f align-items-c justify-sb`}>
                            <p className={`${UserMainStyle.subject}`}>
                                <FontAwesomeIcon
                                    icon={faThumbtack}
                                    style={{ color: '#387AE3' }}
                                />
                                프로필 정보는 빠짐없이 상세하게 작성해주세요.
                            </p>
                            <p className={`${UserMainStyle.date}`}>
                                2024.08.08
                            </p>
                        </Link>
                        <Link className={`display-f align-items-c justify-sb`}>
                            <p className={`${UserMainStyle.subject}`}>
                                공지사항 샘플입니다.
                            </p>
                            <p className={`${UserMainStyle.date}`}>
                                2024.08.08
                            </p>
                        </Link>
                        <Link className={`display-f align-items-c justify-sb`}>
                            <p className={`${UserMainStyle.subject}`}>
                                여기서는 5줄까지만 볼 수 있습니다.
                            </p>
                            <p className={`${UserMainStyle.date}`}>
                                2024.08.08
                            </p>
                        </Link>
                    </div>
                </div>
                <div
                    className={` ${UserMainStyle.box01} ${UserMainStyle.w40} `}
                >
                    <h3 className={UserMainStyle.tit}>
                        결재<Link to="sent">더보기</Link>
                    </h3>
                    <div className={`${UserMainStyle.tab} padding-t20`}>
                        <button type="button">수신</button>
                        <button type="button" className={`${UserMainStyle.on}`}>
                            상신
                        </button>
                    </div>
                    <div className={`${UserMainStyle.approve} padding-t20`}>
                        <Link
                            className={` ${UserMainStyle.running} display-f align-items-c justify-sb`}
                        >
                            <dl className="display-f align-items-c">
                                <dt>연차신청</dt>
                                <dd>&nbsp;- 진행</dd>
                            </dl>
                            <span className={`${UserMainStyle.date}`}>
                                2024-08-08
                            </span>
                        </Link>
                        <Link
                            className={`${UserMainStyle.complete} display-f align-items-c justify-sb`}
                        >
                            <dl className="display-f align-items-c">
                                <dt>휴가신청</dt>
                                <dd>&nbsp;- 완료</dd>
                            </dl>
                            <span className={`${UserMainStyle.date}`}>
                                2024-08-08
                            </span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UserMain;
