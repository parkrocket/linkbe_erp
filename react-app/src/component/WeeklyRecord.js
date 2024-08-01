import React from 'react';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import RightContStyle from '../css/RightCont.module.scss';

function WeeklyRecord() {
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
                    id="daily_prev"
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
                    <dt className={`${RightContStyle.tit02}`}>8월 1째주</dt>
                    <dd>7월 29일(월) - 8월 4일(일)</dd>
                </dl>
                <button
                    type="button"
                    className={`${RightContStyle.right_arrow} display-b`}
                    id="daily_next"
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
                    <div className={`${RightContStyle.current} text-align-c`}>
                        13%
                    </div>
                    <div className={`${RightContStyle.standard}`}></div>
                </div>{' '}
                <p className={`${RightContStyle.work_time} padding-t20`}>
                    <span>3시간 10분</span> 근무중 입니다.
                </p>
                <div className={`${RightContStyle.info} padding-t20`}>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>잔여시간 / 잔여일</dt>
                        <dd>40시간/2일</dd>
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
                        <dd>0분</dd>
                    </dl>
                </div>
            </div>
        </div>
    );
}

export default WeeklyRecord;
