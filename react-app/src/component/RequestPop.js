import React, { useState } from 'react';

import RequestPopStyle from '../css/RequestPop.module.scss';

function RequestPop({ onClose }) {
    return (
        <div className={`${RequestPopStyle.pop}`}>
            <div className={`${RequestPopStyle.cont}`}>
                <h3 className={`text-align-c padding-b30`}>근태 신청</h3>
                <div className={`${RequestPopStyle.summary}  padding-b30`}>
                    사용가능한 연차 개수 : 10.5 <br />
                    사용가능한 휴가 개수 : 1 <br />
                    이번 달 재택 가능 개수 : 2
                </div>
                <form action="">
                    <fieldset>
                        <legend className="blind">근태신청 폼</legend>
                        <div
                            className={`${RequestPopStyle.form_cont} padding-b30`}
                        >
                            <label
                                htmlFor="date"
                                className="display-b padding-b10"
                            >
                                날짜
                            </label>
                            <input
                                type="date"
                                id="date"
                                className="display-b"
                            />
                        </div>
                        <div className={`${RequestPopStyle.form_cont}`}>
                            <label
                                htmlFor="type"
                                className="display-b padding-b10"
                            >
                                종류
                            </label>
                            <select name="" id="type" className="display-b">
                                <option value="연차">연차</option>
                                <option value="휴가">휴가</option>
                                <option value="반차(오전)">반차(오전)</option>
                                <option value="반차(오후)">반차(오후)</option>
                                <option value="재택">재택</option>
                                <option value="월차">월차</option>
                            </select>
                        </div>
                        <div
                            className={`${RequestPopStyle.form_submit} display-f text-align-c justify-c padding-t20	`}
                        >
                            <button
                                type="button"
                                className={`display-b ${RequestPopStyle.cancel}`}
                                onClick={onClose}
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className={`display-b ${RequestPopStyle.submit}`}
                            >
                                확인
                            </button>
                        </div>
                    </fieldset>
                </form>
            </div>
        </div>
    );
}

export default RequestPop;
