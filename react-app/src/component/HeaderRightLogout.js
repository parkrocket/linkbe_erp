import React from 'react';
import { logout } from '../_actions/user_action';
import { useCookies } from 'react-cookie';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

function HeaderRightLogout() {
    const user = useSelector((state) => state.user);

    const navigate = useNavigate();

    const dispatch = useDispatch();
    const [, , removeCookie] = useCookies(['x_auth']);
    const logOutHandler = (event) => {
        dispatch(logout(user)).then((response) => {
            console.log(response);
            if (response.payload.logoutSuccess === true) {
                localStorage.removeItem('userId');
                removeCookie('x_auth');
                navigate('/');
            } else {
                alert('로그아웃에 실패하였습니다ㅠㅠㅠㅠ');
            }
        });
    };
    return (
        <div className="header_btn_wrap">
            <div className="mypage_btn_warp">
                <Link className="mypage_btn" to="/">
                    {user.userData.user.user_id ? user.userData.user.user_id : ''}
                </Link>
                <p>님 안녕하세요.</p>
            </div>
            <button className="header_signup_btn" onClick={logOutHandler}>
                로그아웃
            </button>

            {/* <p>
                <a href="#!" onClick={logOutHandler}>
                    {user.userData.user.mb_id}로그아웃
                </a>
            </p> */}
        </div>
    );
}

export default HeaderRightLogout;
