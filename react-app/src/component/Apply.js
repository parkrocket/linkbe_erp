import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import RightContStyle from '../css/RightCont.module.scss';
import RequestPop from './RequestPop';

function Apply(info) {
    const user = useSelector(state => state.user);
    const [isRequestPopVisible, setIsRequestPopVisible] = useState(false);

    const location = useLocation();
    let titleText = '';
    let subTitleText = '';

    if (location.pathname.startsWith('/work')) {
        titleText = '내 근무 현황';
        let shiftTypeText = '';

        if (info.companyInfo.cp_shift_type === 'fix') {
            shiftTypeText = '고정근무';
        } else if (info.companyInfo.cp_shift_type === 'free') {
            shiftTypeText = '시차 자율근무';
        } else {
            shiftTypeText = '알 수 없는 근무유형'; // 필요한 경우 기본값 추가
        }

        subTitleText = `님의 근무유형은 ${shiftTypeText} 입니다.`;
    } else if (location.pathname.startsWith('/vaca')) {
        titleText = '내 연차/휴가 현황';
        subTitleText = '님의 연차 부여는 회계일 기준입니다.';
    }

    const handleButtonClick = () => {
        setIsRequestPopVisible(!isRequestPopVisible);
    };

    const handleCloseRequestPop = () => {
        setIsRequestPopVisible(false);
    };
    return (
        <div
            className={`${RightContStyle.box01} display-f align-items-c justify-sb`}
        >
            <div className={RightContStyle.tit_ara}>
                <h2 className={`${RightContStyle.tit} padding-b10`}>
                    {titleText}
                </h2>
                <p>
                    {user.userData &&
                    user.userData.user &&
                    user.userData.user.user_name ? (
                        <span>{user.userData.user.user_name}</span>
                    ) : (
                        ''
                    )}
                    {subTitleText}
                </p>
            </div>
            <button
                type="button"
                className={`${RightContStyle.app_btn} ${RightContStyle.btn01}`}
                onClick={handleButtonClick}
            >
                근태신청
            </button>
            {isRequestPopVisible && (
                <RequestPop onClose={handleCloseRequestPop} />
            )}
        </div>
    );
}

export default Apply;
