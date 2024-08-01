import React from 'react';
import { logout } from '../_actions/user_action';
import { useCookies } from 'react-cookie';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function HeaderRightLogout() {
    const user = useSelector(state => state.user);

    const navigate = useNavigate();

    const dispatch = useDispatch();
    const [, , removeCookie] = useCookies(['x_auth']);
    const logOutHandler = event => {
        dispatch(logout(user)).then(response => {
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
        <div className="util display-f align-items-c">
            {' '}
            <button type="button" className="alarm display-b">
                <span className="blind">알림</span>
                <FontAwesomeIcon
                    icon={faCommentDots}
                    style={{ color: '#3562e4' }}
                    size="lg"
                />
            </button>{' '}
            <button
                type="button"
                className="logout_btn display-b"
                onClick={logOutHandler}
            >
                <span className="blind">로그아웃</span>
                <FontAwesomeIcon
                    icon={faRightFromBracket}
                    style={{ color: '#3562e4' }}
                    size="lg"
                />
            </button>
            <Link className="user" to="/">
                {user.userData &&
                user.userData.user &&
                user.userData.user.user_name ? (
                    <span>{user.userData.user.user_name.charAt(0)}</span>
                ) : (
                    ''
                )}
            </Link>
        </div>
    );
}

export default HeaderRightLogout;
