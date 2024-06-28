import React, { useState } from "react";
import { useCookies } from "react-cookie";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../_actions/user_action";
import { Link, useNavigate } from "react-router-dom";
import MainStyle from "../css/Main.module.css";

function Main() {
    const user = useSelector((state) => state.user);

    const navigate = useNavigate();

    const dispatch = useDispatch();
    const [, , removeCookie] = useCookies(["x_auth"]);

    const logOutHandler = (event) => {
        dispatch(logout(user)).then((response) => {
            console.log(response);
            if (response.payload.logoutSuccess === true) {
                localStorage.removeItem("userId");
                removeCookie("x_auth");
                navigate("/");
            } else {
                alert("로그아웃에 실패하였습니다ㅠㅠㅠㅠ");
            }
        });
    };

    return (
        <div>
            <main>
                <div className={`${MainStyle.container} display-f align-items-c justify-c text-align-c`}>
                    <div className={MainStyle.wrapper}>
                        {user.isAuthenticated ? (
                            <p>
                                <a href="#!" onClick={logOutHandler}>
                                    {user.userData.user.mb_id}로그아웃
                                </a>
                            </p>
                        ) : (
                            <p className="text-align-c">
                                <Link to="/login">로그인 해주세요!! 수정해봅니다.</Link>
                            </p>
                        )}
                        <div>Main</div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Main;
