import React, { useRef } from 'react';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import RightContStyle from '../css/RightCont.module.scss';

function DailyRecord() {
    const memoRef = useRef(null);
    const handlePencilClick = () => {
        alert('pencil clicked');
        if (memoRef.current) {
            memoRef.current.focus();
        }
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
                    <dd>8월 1일(목)</dd>
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
            <div className="max_400 margin-c ">
                <div
                    className={`${RightContStyle.time} display-f justify-sb align-items-c padding-b10`}
                >
                    <p className={`${RightContStyle.start_time}`}>
                        <span>출근시간</span>
                        <br />
                        10:30
                        <br />
                    </p>
                    <p className={`${RightContStyle.end_time} text-align-r`}>
                        <span>예상 퇴근 시간</span>
                        <br />
                        19:30
                    </p>
                </div>
                <div className={`${RightContStyle.percentage}`}>
                    <div className={`${RightContStyle.current} text-align-c`}>
                        13%
                    </div>{' '}
                    <div className={`${RightContStyle.standard}`}></div>
                </div>
                <p className={`${RightContStyle.work_time} padding-t20`}>
                    <span>3시간 10분</span> 근무중(재택) 입니다.
                </p>
                <div className={`${RightContStyle.info} padding-t20`}>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>잔여시간</dt>
                        <dd>6시간 30분</dd>
                    </dl>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>휴게시간</dt>
                        <dd>1시간(13:00 - 13:00)</dd>
                    </dl>
                    <dl className="display-f align-items-c justify-sb">
                        <dt>최과 근무 시간</dt>
                        <dd>0분</dd>
                    </dl>
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
                </div>
            </div>
        </div>
    );
}

export default DailyRecord;
