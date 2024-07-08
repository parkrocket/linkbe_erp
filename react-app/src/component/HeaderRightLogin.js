import React from "react";
import { Link } from "react-router-dom";

function HeaderRightLogin() {
    return (
        <div className="header_btn_wrap">
            <div className="header_btn_wrap">
                <Link className="header_login_btn" to="/login">
                    로그인
                </Link>
                <Link className="header_signup_btn" to="/register">
                    회원가입
                </Link>
            </div>
        </div>
    );
}

export default HeaderRightLogin;
