import React from "react";

import leftArrowImg from "../img/chevron_left_24dp_FILL0_wght400_GRAD0_opsz24.svg";
import rightArrowImg from "../img/chevron_right_24dp_FILL0_wght400_GRAD0_opsz24.svg";
import downloadImg from "../img/download.svg";
import TableStyle from "../css/RecordTable.module.css";

function RecordTable() {
    return (
        <section className=" margin-c">
            <div>
                <h1 className={TableStyle.title}>날짜별 근무 기록</h1>
                {/* 날짜 및 다운로드 영역 */}
                <div className={`${TableStyle.wrapper} display-f justify-sb`}>
                    <div className={TableStyle.date_wrapper}>
                        <span class={TableStyle.left_arrow}>
                            <img src={leftArrowImg} alt="left-arrow" />
                        </span>
                        <input type="date" id="currentDate" />
                        <span class={TableStyle.right_arrow}>
                            <img src={rightArrowImg} alt="right-arrow" />
                        </span>
                        <button type="button" name="today">
                            오늘
                        </button>
                    </div>
                    <div class={TableStyle.download_wrapper}>
                        <img src={downloadImg} alt="download" />
                        <a href="#" download="#">
                            데이터 다운로드
                        </a>
                    </div>
                </div>
                {/* 탭 선택 및 정렬 영역 */}
                <div class={TableStyle.work_wrapper}>
                    <ul>
                        <li class={`${TableStyle.click} ${TableStyle.all_button}`}>
                            <a href="#">전체</a>
                        </li>
                        <li class="work-button">
                            <a href="#">출근</a>
                        </li>
                        <li class="work-end-button">
                            <a href="#">퇴근</a>
                        </li>
                        <li class="not-work-button">
                            <a href="#">미출근</a>
                        </li>
                    </ul>
                    <div>
                        <select name="workview" id={TableStyle.workview}>
                            <option value="view1">20개씩 전체보기</option>
                        </select>
                    </div>
                </div>
                {/* 테이블 영역 */}
                <table>
                    <thead>
                        <tr>
                            <th>닉네임</th>
                            <th>근무 상태</th>
                            <th>출근 시간</th>
                            <th>출근 방법</th>
                            <th>퇴근 시간</th>
                            <th>퇴근 방법</th>
                            <th>근무 시간</th>
                            <th>비고</th>
                        </tr>
                    </thead>
                    <tbody class={TableStyle.work_data}>
                        <tr>
                            <td>이원석</td>
                            <td>
                                <span>회사 출근</span>
                            </td>
                            <td>09:02</td>
                            <td>회사 출근</td>
                            <td></td>
                            <td></td>
                            <td>05:36</td>
                            <td>근무중</td>
                        </tr>
                    </tbody>
                    <tbody class={TableStyle.work_end_data}>
                        <tr>
                            <td>이원석</td>
                            <td>
                                <span>퇴근</span>
                            </td>
                            <td>09:02</td>
                            <td>회사 출근</td>
                            <td>18:05</td>
                            <td>회사 퇴근</td>
                            <td>09:03</td>
                            <td>퇴근</td>
                        </tr>
                    </tbody>
                    <tbody class={TableStyle.not_work_data}>
                        <tr>
                            <td>이원석</td>
                            <td>
                                <span>미출근</span>
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default RecordTable;
