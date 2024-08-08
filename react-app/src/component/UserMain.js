import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { faBuilding } from '@fortawesome/free-regular-svg-icons';
import { faLeaf } from '@fortawesome/free-solid-svg-icons';
import { faUmbrellaBeach } from '@fortawesome/free-solid-svg-icons';
import { faFire } from '@fortawesome/free-solid-svg-icons';
import { faBatteryQuarter } from '@fortawesome/free-solid-svg-icons';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons';
import { faStopwatch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import UserMainStyle from '../css/UserMain.module.scss';
import App from './../App';

function UserMain() {
    const user = useSelector(state => state.user);
    const [isMoreBtnClick, setIsMoreBtnClick] = useState(false);
    const [timer, setTimer] = useState('00:00:00');

    const handleMoreBtnClick = () => {
        if (isMoreBtnClick === false) {
            setIsMoreBtnClick(true);
        } else {
            setIsMoreBtnClick(false);
        }
    };

    const currentTimer = () => {
        const date = new Date();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        setTimer(`${hours}:${minutes}`);
    };

    const startTimer = () => {
        setInterval(currentTimer, 1000);
    };

    startTimer();
    return (
        <div className={`${UserMainStyle.wrapper} padding-t100 padding-b150`}>
            <div className={`${UserMainStyle.tit_area} padding-b40 `}>
                <p className={`${UserMainStyle.date} text-align-r padding-b20`}>
                    8월 1일 목요일
                </p>
                <p className={`${UserMainStyle.greetings} `}>
                    안녕하세요!
                    {user.userData &&
                    user.userData.user &&
                    user.userData.user.user_name ? (
                        <span> {user.userData.user.user_name}님,</span>
                    ) : (
                        ''
                    )}
                    <br /> 오늘도 멋진 하루 보내세요!
                </p>
            </div>
            <div
                className={`${UserMainStyle.column_reverse} display-f justify-sb flex-wrap`}
            >
                <div
                    className={`${UserMainStyle.member_work} ${UserMainStyle.box01}  ${UserMainStyle.w60} display-f flex-wrap`}
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
                                    {/* <FontAwesomeIcon
                                        icon={faBuilding}
                                        style={{ color: '#333' }}
                                        size="xl"
                                        className="display-b margin-c"
                                    /> */}
                                    회사/재택
                                </p>
                                <p className={`${UserMainStyle.count}`}>2/1</p>
                            </Link>
                        </li>
                        <li>
                            <Link>
                                <p className={`${UserMainStyle.cate}`}>
                                    {/* <FontAwesomeIcon
                                        icon={faLeaf}
                                        style={{ color: '#333' }}
                                        size="xl"
                                        className="display-b margin-c"
                                    /> */}
                                    퇴근
                                </p>
                                <p className={`${UserMainStyle.count}`}>1</p>
                            </Link>
                        </li>
                        <li>
                            <Link>
                                <p className={`${UserMainStyle.cate}`}>
                                    {/* <FontAwesomeIcon
                                        icon={faUmbrellaBeach}
                                        // style={{ color: '#226ce0' }}
                                        style={{ color: '#333' }}
                                        size="xl"
                                        className="display-b margin-c"
                                    /> */}
                                    휴가/연차
                                </p>
                                <p className={`${UserMainStyle.count}`}>1</p>
                            </Link>
                        </li>
                        <li>
                            <Link>
                                <p className={`${UserMainStyle.cate}`}>
                                    <FontAwesomeIcon
                                        icon={faStopwatch}
                                        style={{ color: '#226ce0' }}
                                        // style={{ color: '#333' }}
                                        size="xl"
                                        className="display-b margin-c"
                                    />
                                    지각
                                </p>
                                <p className={`${UserMainStyle.count}`}>-</p>
                            </Link>
                        </li>
                        <li>
                            <Link>
                                <p className={`${UserMainStyle.cate}`}>
                                    <FontAwesomeIcon
                                        icon={faFire}
                                        style={{ color: '#ea4c4c' }}
                                        // style={{ color: '#333' }}
                                        size="xl"
                                        className="display-b margin-c"
                                    />
                                    초과근무
                                </p>
                                <p className={`${UserMainStyle.count}`}>-</p>
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
                                <p className={`${UserMainStyle.count}`}>-</p>
                            </Link>
                        </li>
                    </ul>

                    <ul
                        className={`${UserMainStyle.member} display-f align-items-c flex-wrap text-align-c padding-t30`}
                    >
                        <li
                            className={`${UserMainStyle.go_work} display-f justify-sb flex-wrap`}
                        >
                            <Link className="display-ib">최다연</Link>
                            <p className={`${UserMainStyle.status} display-ib`}>
                                근무중{' '}
                                <FontAwesomeIcon
                                    icon={faStopwatch}
                                    style={{ color: '#226ce0' }}
                                />
                            </p>
                            <p className={`${UserMainStyle.time} text-align-l`}>
                                10:32 ~ 7:32
                            </p>
                        </li>
                        <li
                            className={`${UserMainStyle.before_work} display-f justify-sb flex-wrap`}
                        >
                            <Link className="display-ib">조인호</Link>
                            <p className={`${UserMainStyle.status} display-ib`}>
                                출근전
                            </p>
                            <p className={`${UserMainStyle.time} text-align-l`}>
                                -
                            </p>
                        </li>
                        <li
                            className={`${UserMainStyle.leave_work} display-f justify-sb flex-wrap`}
                        >
                            <Link className="display-ib">박성현</Link>
                            <p className={`${UserMainStyle.status} display-ib`}>
                                업무종료{' '}
                                <FontAwesomeIcon
                                    icon={faFire}
                                    style={{ color: '#ea4c4c' }}
                                />
                            </p>
                            <p className={`${UserMainStyle.time} text-align-l`}>
                                9:07 ~ 6:20{' '}
                            </p>
                        </li>
                        <li
                            className={`${UserMainStyle.home_work} display-f justify-sb flex-wrap`}
                        >
                            <Link className="display-ib">박민주</Link>
                            <p className={`${UserMainStyle.status} display-ib`}>
                                근무중(재택)
                            </p>
                            <p className={`${UserMainStyle.time} text-align-l`}>
                                9:21 ~ 6:21
                            </p>
                        </li>
                        <li
                            className={`${UserMainStyle.vacation} display-f justify-sb flex-wrap`}
                        >
                            <Link className="display-ib">이원석</Link>
                            <p className={`${UserMainStyle.status} display-ib`}>
                                연차
                            </p>
                            <p className={`${UserMainStyle.time} text-align-l`}>
                                -
                            </p>
                        </li>
                        <li
                            className={`${UserMainStyle.vacation} display-f justify-sb flex-wrap`}
                        >
                            <Link className="display-ib">홍길동</Link>
                            <p className={`${UserMainStyle.status} display-ib`}>
                                업무종료{' '}
                                <FontAwesomeIcon
                                    icon={faBatteryQuarter}
                                    style={{ color: '#777' }}
                                />
                            </p>
                            <p className={`${UserMainStyle.time} text-align-l`}>
                                {' '}
                                9:07 ~ 5:25
                            </p>
                        </li>
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
                        {/* <button
                        type="button"
                        className={`${UserMainStyle.btn01} ${UserMainStyle.leave_work} display-f align-items-c justify-c margin-c`}
                    >
                        <span className="display-f align-items-c justify-c align-content-c flex-wrap">
                            퇴근하기
                            <em>{timer}</em>
                        </span>
                    </button>
                    <button
                        type="button"
                        className={`${UserMainStyle.btn01} ${UserMainStyle.return_work} display-f align-items-c justify-c margin-c`}
                    >
                        <span className="display-f align-items-c justify-c align-content-c flex-wrap">
                            퇴근완료
                            <em>19:00</em>
                        </span>
                    </button> */}
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
                        <Link className={`display-f align-items-c justify-sb`}>
                            <p className={`${UserMainStyle.subject}`}>
                                제목은 간결하게!
                            </p>
                            <p className={`${UserMainStyle.date}`}>
                                2024.08.08
                            </p>
                        </Link>
                        <Link className={`display-f align-items-c justify-sb`}>
                            <p className={`${UserMainStyle.subject}`}>
                                흑미는 아기 흑표범입니다. 고양이가 아닙니다.
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
                            <span className={`${UserMainStyle.date} `}>
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
                        <Link
                            className={`${UserMainStyle.reject} display-f align-items-c justify-sb`}
                        >
                            <dl className="display-f align-items-c">
                                <dt>휴가신청</dt>
                                <dd>&nbsp;- 반려</dd>
                            </dl>
                            <span className={`${UserMainStyle.date} `}>
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
