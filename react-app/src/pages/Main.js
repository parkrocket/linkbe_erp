import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { useSelector, useDispatch } from 'react-redux';
import { logout, refresh } from '../_actions/user_action';
import { gtw } from '../_actions/gtw_action';
import { Link, useNavigate } from 'react-router-dom';
import MainStyle from '../css/Main.module.css';
import Button from '../component/Button';

import SERVER_URL from '../Config';
import axios from 'axios';

function Main() {
    const user = useSelector((state) => state.user);

    const navigate = useNavigate();

    const dispatch = useDispatch();
    const [, , removeCookie] = useCookies(['x_auth']);
    const [gtwStatus, setGtwStatus] = useState(false);

    const logOutHandler = (event) => {
        dispatch(logout(user)).then((response) => {
            if (response.payload.logoutSuccess === true) {
                localStorage.removeItem('userId');
                removeCookie('x_auth');
                navigate('/');
            } else {
                alert('로그아웃에 실패하였습니다ㅠㅠㅠㅠ');
            }
        });
    };

    const handleClick = (message) => {
        const userId = user.userData.user.user_id;
        const type = 'gtw';
        const platform = 'homepage';

        const dataTosubmit = { message, userId, type, platform };

        dispatch(gtw(dataTosubmit)).then((response) => {
            if (response.payload.gtwSuccess === true) {
                console.log(userId);

                dispatch(refresh(dataTosubmit)).then((response) => {
                    if (response.payload.refreshSuccess === true) {
                        setGtwStatus(true);
                    } else {
                        setGtwStatus(false);
                    }
                });
            } else {
                setGtwStatus(false);
                alert(response.payload.error);
            }
        });
        /*
        axios.post(`${SERVER_URL}/api/gtw/companyIn`, dataTosubmit).then((response) => {
            if (response.data.gtwSuccess) {
                
            } else {
                
            }
        });
        */
    };

    return (
        <div>
            <main>
                <div className={`${MainStyle.container} display-f align-items-c justify-c text-align-c`}>
                    <div className={MainStyle.wrapper}>
                        {user.isAuthenticated ? (
                            <p>
                                <Button
                                    onClick={() => handleClick('출근하자')}
                                    className="bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 p-20"
                                >
                                    {user.userData.user.gtw_status === 0 ? '출근하기' : '퇴근하기'}
                                </Button>
                            </p>
                        ) : (
                            <p className="text-align-c">
                                <Link to="/login">로그인 해주세요!! 수정해봅니다.</Link>
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Main;
