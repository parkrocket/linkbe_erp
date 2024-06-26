
import React from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import HeaderRightLogin from "../component/HeaderRightLogin";
import HeaderRightLogout from "../component/HeaderRightLogout";
import "./../css/Common.css";
import "./../css/Header.css";
import HeaderLogo from "./../img/header_logo.svg";


function Header() {
    const user = useSelector((state) => state.user);

    return (
        <div>
            <header>
                <div className="container">
                    <div className="wrapper">
                        <h1>
                            <Link to="/" className="display-b">
                                <span className="blind">오늘의 업무 홈</span>
                                <img src={HeaderLogo} alt="header_logo" />
                            </Link>
                        </h1>

                        {user.isAuthenticated ? (
                            <div>
                                <HeaderRightLogout />
                            </div>
                        ) : (
                            <div>
                                <HeaderRightLogin />
                            </div>
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
                </div>
            </header>
        </div>
    );
}

export default Header;
