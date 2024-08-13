import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import WorkStatus from '../component/Main/WorkStatus';
import GtwStatus from '../component/Main/GtwStatus';

import moment from 'moment';
import 'moment/locale/ko';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons';

import UserMainStyle from '../css/UserMain.module.scss';

function UserMain() {
    const user = useSelector(state => state.user);
    const dateNow = moment().format('M월 D일 dddd');

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
                <WorkStatus></WorkStatus>
                <GtwStatus user={user}></GtwStatus>
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
