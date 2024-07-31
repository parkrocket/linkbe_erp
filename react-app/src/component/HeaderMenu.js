import React from 'react';
import { logout } from '../_actions/user_action';
import { useCookies } from 'react-cookie';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

function HeaderMenu() {
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
        <div className="gnb">
            <div className="links display-f align-items-c">
                {/* <Link to="/vaca" className="display-b">
                    휴가(없어질 메뉴)
                </Link> */}
                <Link to="/work" className="display-b">
                    근태
                </Link>
                <Link to="/sent" className="display-b">
                    결재
                </Link>
                <Link to="/organization" className="display-b">
                    조직
                </Link>
            </div>
            <button className="logout_btn" onClick={logOutHandler}>
                로그아웃
            </button>
        </div>
    );
}

export default HeaderMenu;
