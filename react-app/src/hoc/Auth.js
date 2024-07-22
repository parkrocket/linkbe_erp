import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useCookies } from 'react-cookie';
import { auth } from '../_actions/user_action';
import { gtwStatus } from '../_actions/gtw_action';
import Empty from '../pages/Empty';

function Auth(
    ChildrenComponent,
    option,
    adminRoute = false,
    menu = 0,
    subMenu = 0,
) {
    function AuthenticationCheck() {
        const navigate = useNavigate();
        const dispatch = useDispatch();
        const [cookies] = useCookies(['x_auth']);

        const [view, setView] = useState(false);

        useEffect(() => {
            const checkAuth = async () => {
                const response = await dispatch(auth(cookies));
                if (response.payload.isAuth) {
                    if (adminRoute && !response.payload.isAdmin) {
                        alert('관리자가 아닙니다.');
                        navigate('/');
                    } else {
                        if (option === false) {
                            navigate('/');
                        }
                        setView(true);
                    }
                } else {
                    if (option === true) {
                        alert('로그인이 필요합니다!');
                        navigate(`/login?redirect=${window.location.pathname}`);
                    }
                    setView(true);
                }
            };

            checkAuth();

            if (adminRoute === true) {
                const data = { menu, subMenu };
                //dispatch(adminMenu(data));
            }
        }, [cookies, dispatch, navigate, adminRoute, option, menu, subMenu]);

        if (view === false) {
            return (
                <div>
                    <Empty></Empty>
                </div>
            );
        } else {
            return (
                <div>
                    <ChildrenComponent></ChildrenComponent>
                </div>
            );
        }
    }

    return (
        <div>
            <AuthenticationCheck></AuthenticationCheck>
        </div>
    );
}

export default Auth;
