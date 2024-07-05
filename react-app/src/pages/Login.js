import React from 'react';
import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { loginUser } from '../_actions/user_action';
import { useNavigate } from 'react-router-dom';
import { useCookies } from 'react-cookie';
import { Link } from 'react-router-dom';
import LoginStyle from '../css/Login.module.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [, setCookie] = useCookies(['x_auth']);
    const [isValidEmail, setIsValidEmail] = useState(true);
    const [isValidPassword, setIsValidPassword] = useState(true);
    const [isErrorHover1, setIsErrorHover1] = useState(false);
    const [isErrorHover2, setIsErrorHover2] = useState(false);

    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);

    const navigate = useNavigate();

    const dispatch = useDispatch();

    // 메일 주소 유효성 검사
    const handleEmailInputChange = (e) => {
        const emailVal = e.target.value;
        setEmail(emailVal);
        const email_rule = /^[a-z A-Z 0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;
        const isValid = email_rule.test(emailVal);
        setIsValidEmail(isValid);
    };

    //비밀번호 유효성 검사
    const handlePasswordInputChange = (e) => {
        const passwordVal = e.target.value;
        setPassword(passwordVal);
        const password_rule = /^(?=.*[A-Za-z])(?=.*\d|.*[\p{P}\p{S}])[A-Za-z\d\p{P}\p{S}]{8,15}$/u;
        const isValid2 = password_rule.test(passwordVal);
        setIsValidPassword(isValid2);
    };

    //이메일 오류! 마우스 이벤트
    const handleErrorMouseEnter1 = () => {
        setIsErrorHover1(true);
    };
    const handleErrorMouseLeave1 = () => {
        setIsErrorHover1(false);
    };
    //비밀번호 오류! 마우스 이벤트
    const handleErrorMouseEnter2 = () => {
        setIsErrorHover2(true);
    };
    const handleErrorMouseLeave2 = () => {
        setIsErrorHover2(false);
    };

    const onSubmit = (e) => {
        e.preventDefault();

        if (!isValidEmail) {
            alert('이메일 형식을 확인해주세요.');
            emailInputRef.current.focus();
            return;
        }

        /*
        if (!isValidPassword) {
            alert("비밀번호를 확인해주세요.");
            passwordInputRef.current.focus();
            return;
        }*/

        const loginData = {
            email,
            password,
        };

        dispatch(loginUser(loginData)).then((response) => {
            if (response.payload.loginSuccess) {
                setCookie('x_auth', response.payload.token);
                window.localStorage.setItem('userId', response.payload.user.user_id);
                navigate('/');
            } else {
                alert(response.payload.error);
                navigate('/login');
            }
        });
    };

    return (
        <div>
            {/* ------ 로그인 ------ */}
            <main>
                <div className={LoginStyle.container}>
                    <div className={LoginStyle.wrapper}>
                        <h1>로그인</h1>
                        <form id={LoginStyle.login_from} name="fsearchbox" onSubmit={onSubmit}>
                            <div className={LoginStyle.form_cont}>
                                <div className={`${LoginStyle.from_wrap} ${LoginStyle.user_id}`}>
                                    <label htmlFor="userId">이메일</label>
                                    <div className={LoginStyle.input_box}>
                                        <svg
                                            width="18"
                                            height="14"
                                            viewBox="0 0 18 14"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={LoginStyle.input_icon}
                                        >
                                            <mask
                                                id="path-1-outside-1_8_2"
                                                maskUnits="userSpaceOnUse"
                                                x="-0.75"
                                                y="-0.25"
                                                width="19"
                                                height="14"
                                                fill="black"
                                            >
                                                <rect fill="white" x="-0.75" y="-0.25" width="19" height="14"></rect>
                                                <path d="M16.5 0.75H1.5C1.16848 0.75 0.850537 0.881696 0.616116 1.11612C0.381696 1.35054 0.25 1.66848 0.25 2V12C0.25 12.3315 0.381696 12.6495 0.616116 12.8839C0.850537 13.1183 1.16848 13.25 1.5 13.25H16.5C16.8315 13.25 17.1495 13.1183 17.3839 12.8839C17.6183 12.6495 17.75 12.3315 17.75 12V2C17.75 1.66848 17.6183 1.35054 17.3839 1.11612C17.1495 0.881696 16.8315 0.75 16.5 0.75V0.75ZM15.125 2L9 6.2375L2.875 2H15.125ZM1.5 12V2.56875L8.64375 7.5125C8.74837 7.58508 8.87267 7.62397 9 7.62397C9.12733 7.62397 9.25163 7.58508 9.35625 7.5125L16.5 2.56875V12H1.5Z"></path>
                                            </mask>
                                            <path
                                                d="M16.5 0.75H1.5C1.16848 0.75 0.850537 0.881696 0.616116 1.11612C0.381696 1.35054 0.25 1.66848 0.25 2V12C0.25 12.3315 0.381696 12.6495 0.616116 12.8839C0.850537 13.1183 1.16848 13.25 1.5 13.25H16.5C16.8315 13.25 17.1495 13.1183 17.3839 12.8839C17.6183 12.6495 17.75 12.3315 17.75 12V2C17.75 1.66848 17.6183 1.35054 17.3839 1.11612C17.1495 0.881696 16.8315 0.75 16.5 0.75V0.75ZM15.125 2L9 6.2375L2.875 2H15.125ZM1.5 12V2.56875L8.64375 7.5125C8.74837 7.58508 8.87267 7.62397 9 7.62397C9.12733 7.62397 9.25163 7.58508 9.35625 7.5125L16.5 2.56875V12H1.5Z"
                                                fill="#74797D"
                                            ></path>
                                            <path
                                                d="M16.5 0.75H1.5C1.16848 0.75 0.850537 0.881696 0.616116 1.11612C0.381696 1.35054 0.25 1.66848 0.25 2V12C0.25 12.3315 0.381696 12.6495 0.616116 12.8839C0.850537 13.1183 1.16848 13.25 1.5 13.25H16.5C16.8315 13.25 17.1495 13.1183 17.3839 12.8839C17.6183 12.6495 17.75 12.3315 17.75 12V2C17.75 1.66848 17.6183 1.35054 17.3839 1.11612C17.1495 0.881696 16.8315 0.75 16.5 0.75V0.75ZM15.125 2L9 6.2375L2.875 2H15.125ZM1.5 12V2.56875L8.64375 7.5125C8.74837 7.58508 8.87267 7.62397 9 7.62397C9.12733 7.62397 9.25163 7.58508 9.35625 7.5125L16.5 2.56875V12H1.5Z"
                                                stroke="#74797D"
                                                strokeWidth="0.1"
                                                mask="url(#path-1-outside-1_8_2)"
                                            ></path>
                                        </svg>

                                        <input
                                            id="userId"
                                            type="text"
                                            placeholder="이메일을 입력해주세요."
                                            name="stx1"
                                            value={email}
                                            onChange={handleEmailInputChange}
                                            className={isValidEmail ? '' : `${LoginStyle.input_error}`}
                                            required
                                            ref={emailInputRef}
                                        />
                                        <div className={`${LoginStyle.error_wrap} ${LoginStyle.error_wrap1} ${isValidEmail ? '' : LoginStyle.on}`}>
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                onMouseEnter={handleErrorMouseEnter1}
                                                onMouseLeave={handleErrorMouseLeave1}
                                            >
                                                <path
                                                    d="M10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20Z"
                                                    fill="#F03738"
                                                ></path>
                                                <path
                                                    fillRule="evenodd"
                                                    clipRule="evenodd"
                                                    d="M11.077 6.99999C11.077 6.40628 10.5957 5.92499 10.002 5.92499C9.40825 5.92499 8.92696 6.40628 8.92696 6.99999V11C8.92696 11.5937 9.40825 12.075 10.002 12.075C10.5957 12.075 11.077 11.5937 11.077 11V6.99999ZM10.002 12.925C9.40825 12.925 8.92696 13.4063 8.92696 14C8.92696 14.5937 9.40825 15.075 10.002 15.075H10.012C10.6057 15.075 11.087 14.5937 11.087 14C11.087 13.4063 10.6057 12.925 10.012 12.925H10.002Z"
                                                    fill="white"
                                                ></path>
                                            </svg>

                                            <p className={`${LoginStyle.error_txt} hide1 ${isErrorHover1 ? '' : `${LoginStyle.in}`}`}>
                                                이메일 형식을 확인해주세요.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className={`${LoginStyle.from_wrap} ${LoginStyle.user_password}`}>
                                    <label htmlFor="userPassword">비밀번호</label>
                                    <div className={LoginStyle.input_box}>
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={LoginStyle.input_icon}
                                        >
                                            <path
                                                d="M6.66602 14.9998L8.33268 13.3331H9.99935L11.1327 12.1998C12.2912 12.6034 13.5523 12.6018 14.7098 12.1952C15.8672 11.7887 16.8524 11.0013 17.504 9.96193C18.1557 8.92255 18.4352 7.69275 18.2969 6.47381C18.1585 5.25488 17.6105 4.119 16.7425 3.25209C15.8745 2.38518 14.7379 1.83858 13.5188 1.70177C12.2997 1.56495 11.0703 1.84602 10.0317 2.49897C8.99315 3.15192 8.20699 4.13807 7.80191 5.29602C7.39682 6.45397 7.3968 7.71514 7.80185 8.87311L1.66602 14.9998V18.3331H4.99935L6.66602 16.6664V14.9998Z"
                                                stroke="#74797D"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            ></path>
                                            <path
                                                d="M14.1654 6.66667C14.6256 6.66667 14.9987 6.29357 14.9987 5.83333C14.9987 5.3731 14.6256 5 14.1654 5C13.7051 5 13.332 5.3731 13.332 5.83333C13.332 6.29357 13.7051 6.66667 14.1654 6.66667Z"
                                                stroke="#74797D"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            ></path>
                                        </svg>
                                        <input
                                            id="userPassword"
                                            type="password"
                                            placeholder="영문 대소문자,숫자,특수문자 중 2종류 조합의 8-15자"
                                            name="stx2"
                                            value={password}
                                            onChange={handlePasswordInputChange}
                                            className={isValidPassword ? '' : `${LoginStyle.input_error}`}
                                            required
                                            ref={passwordInputRef}
                                        />
                                        <div className={`${LoginStyle.error_wrap} ${LoginStyle.error_wrap2} ${isValidPassword ? '' : LoginStyle.on}`}>
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                onMouseEnter={handleErrorMouseEnter2}
                                                onMouseLeave={handleErrorMouseLeave2}
                                            >
                                                <path
                                                    d="M10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20Z"
                                                    fill="#F03738"
                                                ></path>

                                                <path
                                                    fillRule="evenodd"
                                                    clipRule="evenodd"
                                                    d="M11.077 6.99999C11.077 6.40628 10.5957 5.92499 10.002 5.92499C9.40825 5.92499 8.92696 6.40628 8.92696 6.99999V11C8.92696 11.5937 9.40825 12.075 10.002 12.075C10.5957 12.075 11.077 11.5937 11.077 11V6.99999ZM10.002 12.925C9.40825 12.925 8.92696 13.4063 8.92696 14C8.92696 14.5937 9.40825 15.075 10.002 15.075H10.012C10.6057 15.075 11.087 14.5937 11.087 14C11.087 13.4063 10.6057 12.925 10.012 12.925H10.002Z"
                                                    fill="white"
                                                ></path>
                                            </svg>
                                            <p className={`${LoginStyle.error_txt} hide2 ${isErrorHover2 ? `${LoginStyle.in}` : ''}`}>
                                                비밀번호를 확인해주세요.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={LoginStyle.submit_cont}>
                                <button type="submit" className={LoginStyle.login_btn} id="main_login_btn">
                                    로그인
                                </button>
                                <Link className={LoginStyle.main_signup_btn} to="/register">
                                    가입하기
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </main>

            {/* 
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100vh" }}>
                <form style={{ display: "flex", flexDirection: "column" }} onSubmit={onSubmit}>
                    <input type="text" placeholder="ID" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="password" placeholder="PW" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="submit">Login</button>
                </form>
            </div>
			 */}
        </div>
    );
}

export default Login;
