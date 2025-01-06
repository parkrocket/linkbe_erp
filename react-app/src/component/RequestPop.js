import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import RequestPopStyle from '../css/RequestPop.module.scss';
import SERVER_URL from '../Config';

function RequestPop({ onClose }) {
    const user = useSelector(state => state.user);
    const [date, setDate] = useState('');
    const [type, setType] = useState('');

    const userStip = user.userData.user.user_stip;
    const userVaca = user.userData.user.user_vaca;
    const userId = user.userData.user.user_id;
    const userName = user.userData.user.user_name;

    const handleSubmit = async e => {
        e.preventDefault(); // 폼 기본 제출 방지
        console.log('날짜:', date, '타입:', type);

        if (!date || !type) {
            alert('날짜와 타입을 선택해주세요.');
            return;
        }

        try {
            // Axios를 사용한 POST 요청
            const response = await axios.post(
                `${SERVER_URL}/api/apply/applyIn`,
                {
                    date,
                    type,
                    userId,
                    userName,
                },
            );

            if (response.status === 200) {
                alert('신청이 완료되었습니다.');
                onClose(); // 팝업 닫기
            } else {
                alert('신청에 실패했습니다. 다시 시도해주세요.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('통신 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className={`${RequestPopStyle.pop}`}>
            <div className={`${RequestPopStyle.bg}`} onClick={onClose}></div>
            <div className={`${RequestPopStyle.cont}`}>
                <h3 className={`text-align-c padding-b30`}>근태 신청</h3>
                <div className={`${RequestPopStyle.summary}  padding-b30`}>
                    사용가능한 연차 개수 : {userStip} <br />
                    사용가능한 휴가 개수 : {userVaca} <br />
                </div>
                <form onSubmit={handleSubmit}>
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
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                        <div className={`${RequestPopStyle.form_cont}`}>
                            <label
                                htmlFor="type"
                                className="display-b padding-b10"
                            >
                                종류
                            </label>
                            <select
                                id="type"
                                className="display-b"
                                value={type}
                                onChange={e => setType(e.target.value)}
                            >
                                <option value="">선택하세요</option>
                                <option value="day">연차</option>
                                <option value="half">반차</option>
                                <option value="vacation">휴가</option>
                                <option value="home">재택</option>
                            </select>
                        </div>
                        <div
                            className={`${RequestPopStyle.form_submit} display-f text-align-c justify-c padding-t20`}
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
