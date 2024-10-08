import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import HeaderLogo from './../img/linkbe_logo.svg';

import './../css/Header.css';

import HeaderMenu from '../component/HeadFoot/HeaderMenu';
import HeaderRightLogin from '../component/HeadFoot/HeaderRightLogin';
import HeaderRightLogout from '../component/HeadFoot/HeaderRightLogout';

function Header() {
    const user = useSelector(state => state.user);

    return (
        <header className="">
            <div className="wrapper display-f align-items-c margin-c">
                <h1 className="logo">
                    <Link to="/" className="display-b">
                        <span className="blind">hibye 홈</span>
                        <img src={HeaderLogo} alt="header_logo" />
                    </Link>
                </h1>

                {user.isAuthenticated ? (
                    <>
                        <HeaderMenu />
                        <HeaderRightLogout />
                    </>
                ) : (
                    <HeaderRightLogin />
                )}

                {/* 

                        <div className="header_btn_wrap">
                            <Link className="header_login_btn" to="/login">
                                로그인
                            </Link>
                            <Link className="header_signup_btn" to="/register">
                                회원가입
                            </Link>
                        </div>
						 */}
            </div>
        </header>
    );
}

export default Header;
