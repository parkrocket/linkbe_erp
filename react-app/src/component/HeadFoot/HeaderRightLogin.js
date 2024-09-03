import React from 'react';
import { Link } from 'react-router-dom';

function HeaderRightLogin() {
    return (
        <div className="util">
            <Link className="login_btn" to="/login">
                로그인
            </Link>
            <Link className="sign_btn" to="/register">
                회원가입
            </Link>
        </div>
    );
}

export default HeaderRightLogin;
