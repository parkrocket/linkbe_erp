import React, { useState } from 'react';
import { useCookies } from 'react-cookie';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../_actions/user_action';
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
        const dataTosubmit = { message };

        console.log(message);
        axios.post(`${SERVER_URL}/api/gtw/companyIn`, dataTosubmit).then((response) => response.data);
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
                                    출근하기
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
