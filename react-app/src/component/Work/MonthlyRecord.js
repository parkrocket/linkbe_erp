import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import leftArrowImg from '../../img/chevron_left_24dp_FILL0_wght400_GRAD0_opsz24.svg';
import rightArrowImg from '../../img/chevron_right_24dp_FILL0_wght400_GRAD0_opsz24.svg';
//import downloadImg from '../img/download.svg';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import RightContStyle from '../../css/RightCont.module.scss';
import TableStyle from '../../css/RecordTable.module.scss';
import MonthlyRecordStyle from '../../css/MonthlyRecord.module.scss';

import moment from 'moment';
import Button from '../Button';
import { refresh } from '../../_actions/user_action';
import { gtw } from '../../_actions/gtw_action';

function MonthlyRecord() {
    return (
        <div className={RightContStyle.box01}>
            <h3 className={`${RightContStyle.tit01} text-align-c`}>
                월간 기록
            </h3>
            {/* 날짜 선택 영역 */}
            <div
                className={`${RightContStyle.date} ${RightContStyle.arrow_cont_box01}  display-f align-items-c justify-c text-align-c padding-b50`}
            >
                <button
                    type="button"
                    className={`${RightContStyle.left_arrow} display-b`}
                    id="weekly_prev"
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
                    <dt className={`${RightContStyle.tit02}`}>2024년 9월</dt>
                </dl>
                <button
                    type="button"
                    className={`${RightContStyle.right_arrow} display-b`}
                    id="weekly_next"
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
            {/* 기록 요약 영역 */}
            <ul
                className={`display-f align-items-c justify-sb text-align-c padding-b30 ${MonthlyRecordStyle.summary}`}
            >
                <li className={`display-f justify-sb`}>
                    <span>재택</span>
                    <span>2</span>
                </li>
                <li className={`display-f justify-sb`}>
                    <span>지각</span>
                    <span>2</span>
                </li>
                <li className={`display-f justify-sb`}>
                    <span>초관근무</span>
                    <span>2</span>
                </li>
                <li className={`display-f justify-sb`}>
                    <span>근무미달</span>
                    <span>2</span>
                </li>
                <li className={`display-f justify-sb`}>
                    <span>기록누락</span>
                    <span>2</span>
                </li>
            </ul>
            {/* 테이블 영역 */}
            <table>
                <thead>
                    <tr>
                        <th>날짜</th>
                        <th>근태</th>
                        <th>출근 시간</th>
                        <th>퇴근 시간</th>
                        <th>총근무시간</th>
                        <th>비고</th>
                    </tr>
                </thead>
                <tbody className={TableStyle.work_data}>
                    <tr>
                        <td>09-01(일)</td>
                        <td></td>
                        <td>09:00</td>
                        <td>18:02</td>
                        <td>8시간 2분</td>
                        <td>초과근무</td>
                    </tr>
                    <tr>
                        <td>09-02(월)</td>
                        <td>
                            <span>연차</span>
                            <span>반차</span>
                            <span>월차</span>
                            <span>휴가</span>
                            <span>재택</span>
                        </td>
                        <td>09:00</td>
                        <td>18:02</td>
                        <td>8시간 2분</td>
                        <td>
                            지각
                            <br />
                            초과근무
                            <br />
                            근무미달
                            <br />
                            기록누락
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default MonthlyRecord;
