import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { registerUser } from '../_actions/user_action';
import { useNavigate } from 'react-router-dom';
import RegisterStyle from '../css/Register.module.css';

function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordCheck, setPasswordCheck] = useState('');
    const [isValidEmail, setIsValidEmail] = useState(true);
    const [isValidPassword, setIsValidPassword] = useState(true);
    const [isValidPasswordCheck, setIsValidPasswordCheck] = useState(true);
    const [isValidName, setIsValidName] = useState(true);
    const [isValidPhone, setIsValidPhone] = useState(true);
    const [agreeCheckAll, setAgreeCheckAll] = useState(false);
    const [termsChecked, setTermsChecked] = useState(false);
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [marketingChecked, setMarketingChecked] = useState(false);

    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);
    const passwordCheckInputRef = useRef(null);
    const nameInputRef = useRef(null);
    const phoneInputRef = useRef(null);

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
        if (!password_rule.test(passwordVal)) {
            setIsValidPassword(false);
        } else {
            setIsValidPassword(true);
        }
        if (passwordCheck !== passwordVal) {
            setIsValidPasswordCheck(false);
        }
    };

    //비밀번호 확인 유효성 검사
    const handlePasswordCheckInputChange = (e) => {
        const passwordCheckVal = e.target.value;
        setPasswordCheck(passwordCheckVal);
        if (passwordCheckVal === password) {
            setIsValidPasswordCheck(true);
        } else {
            setIsValidPasswordCheck(false);
        }
    };

    //이름 유효성 검사
    const handleNameInputChange = (e) => {
        const nameVal = e.target.value;
        const nameRule = /^[가-힣]+$/;
        if (nameVal.length < 2 || !nameRule.test(nameVal)) {
            setIsValidName(false);
        } else {
            setIsValidName(true);
        }
    };

    //핸드폰 유효성 검사 + 하이픈 추가
    const handlePhoneInputChange = (e) => {
        //핸드폰번호에 하이픈 추가
        let value = e.target.value;
        value = value.replace(/[^0-9]/g, '');

        if (value.length <= 3) {
            e.target.value = value;
        } else if (value.length <= 7) {
            e.target.value = `${value.slice(0, 3)}-${value.slice(3)}`;
        } else {
            e.target.value = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
        }

        const phoneVal = e.target.value;
        if (phoneVal.length < 13) {
            setIsValidPhone(false);
        } else {
            setIsValidPhone(true);
        }
    };

    //전체 동의 선택 시 이벤트
    useEffect(() => {
        const allChecked = termsChecked && privacyChecked && marketingChecked;
        setAgreeCheckAll(allChecked);
    }, [termsChecked, privacyChecked, marketingChecked]);

    const handleAgreeCheckAllChange = (e) => {
        const checked = e.target.checked;

        setAgreeCheckAll(checked);
        setTermsChecked(checked);
        setPrivacyChecked(checked);
        setMarketingChecked(checked);
        console.log(checked);
    };

    //이용약관 동의 선택 시 이벤트
    const handleTermsChange = (e) => {
        setTermsChecked(e.target.checked);
    };

    //개인정보 동의 선택 시 이벤트
    const handlePrivacyChange = (e) => {
        setPrivacyChecked(e.target.checked);
    };

    //마케팅 동의 선택 시 이벤트
    const handleMarketingChange = (e) => {
        setMarketingChecked(e.target.checked);
    };

    const onSubmit = (e) => {
        e.preventDefault();

        if (!isValidEmail) {
            alert('이메일 형식을 확인해주세요.');
            emailInputRef.current.focus();
            return;
        }
        if (!isValidPassword) {
            alert('비밀번호를 확인해주세요.');
            passwordInputRef.current.focus();
            return;
        }
        if (!isValidPasswordCheck) {
            alert('비밀번호 확인을 확인해주세요.');
            passwordCheckInputRef.current.focus();
            return;
        }
        if (!isValidName) {
            alert('이름을 확인해주세요.');
            nameInputRef.current.focus();
            return;
        }
        if (!isValidPhone) {
            alert('핸드폰 번호를 확인해주세요.');
            phoneInputRef.current.focus();
            return;
        }
        // alert("success");
        // return;

        const loginData = {
            email,
            password,
        };

        dispatch(registerUser(loginData)).then((response) => {
            if (response.payload.registerSuccess) {
                //console.log(response);
                navigate('/login');
            } else {
                //console.log(response);
                alert(response.payload.error);
            }
        });
    };

    return (
        <div>
            <h2 className={RegisterStyle.tit}>회원가입</h2>
            <form className={RegisterStyle.register_form} name="register_form" onSubmit={onSubmit}>
                <h3>계정정보</h3>
                <div className={RegisterStyle.essential_area}>
                    <div>
                        <div className={RegisterStyle.label_area}>
                            <label htmlFor="email">이메일</label>
                            <p className={`${RegisterStyle.error} ${RegisterStyle.error_email} ${isValidEmail ? '' : `${RegisterStyle.on}`} `}>
                                올바르지 않은 이메일 형식입니다.
                            </p>
                        </div>
                        <input
                            id="email"
                            type="text"
                            placeholder="이메일을 입력해주세요."
                            autoComplete="off"
                            name="email"
                            required
                            onChange={handleEmailInputChange}
                            className={isValidEmail ? '' : `${RegisterStyle.on}`}
                            ref={emailInputRef}
                            value={email}
                        />
                    </div>
                    <div>
                        <div className={RegisterStyle.label_area}>
                            <label htmlFor="password">비밀번호</label>
                            <p className={`${RegisterStyle.error} ${RegisterStyle.error_password}  ${isValidPassword ? '' : `${RegisterStyle.on}`}`}>
                                영어 대소문자, 숫자, 특수문자 중 2종류 조합의 8-15자
                            </p>
                        </div>
                        <input
                            id="password"
                            type="password"
                            placeholder="영어 대소문자, 숫자, 특수문자 중 2종류 조합의 8-15자"
                            autoComplete="off"
                            name="password"
                            required
                            onChange={handlePasswordInputChange}
                            className={isValidPassword ? '' : `${RegisterStyle.on}`}
                            ref={passwordInputRef}
                            value={password}
                        />
                    </div>
                    <div>
                        <div className={RegisterStyle.label_area}>
                            <label htmlFor="passwordConfirm">비밀번호 확인</label>
                            <p
                                className={`${RegisterStyle.error} ${RegisterStyle.error_confirm} ${
                                    isValidPasswordCheck ? '' : `${RegisterStyle.on}`
                                }`}
                            >
                                비밀번호가 일치하지 않습니다.
                            </p>
                        </div>
                        <input
                            id="passwordConfirm"
                            type="password"
                            placeholder="비밀번호를 다시 입력해 주세요."
                            autoComplete="off"
                            name="passwordConfirm"
                            required
                            onChange={handlePasswordCheckInputChange}
                            className={isValidPasswordCheck ? '' : `${RegisterStyle.on}`}
                            ref={passwordCheckInputRef}
                        />
                    </div>
                    <div>
                        <label htmlFor="name">이름</label>
                        <input
                            id="name"
                            type="text"
                            placeholder="이름을 입력해주세요."
                            autoComplete="off"
                            name="name"
                            onChange={handleNameInputChange}
                            className={RegisterStyle.essential}
                            required
                            ref={nameInputRef}
                        />
                    </div>
                    <div className={RegisterStyle.border_box}>
                        <label htmlFor="phone">휴대폰 번호</label>
                        <input
                            id="phone"
                            type="text"
                            placeholder="휴대폰 번호를 입력해주세요."
                            autoComplete="off"
                            name="phone"
                            onChange={handlePhoneInputChange}
                            className={RegisterStyle.essential}
                            maxLength="13"
                            required
                            ref={phoneInputRef}
                        />
                    </div>

                    <h3>회사 정보</h3>
                    <div>
                        <label htmlFor="corpName">회사명</label>
                        <input
                            id="corpName"
                            type="text"
                            placeholder="회사명을 입력해 주세요."
                            autoComplete="off"
                            name="corpName"
                            className={RegisterStyle.essential}
                        />
                    </div>
                    <div>
                        <label htmlFor="homepage">회사 홈페이지</label>
                        <input
                            id="homepage"
                            type="text"
                            placeholder="회사 홈페이지를 입력해 주세요."
                            autoComplete="off"
                            name="homepage"
                            className={RegisterStyle.essential}
                        />
                    </div>
                    <div>
                        <label htmlFor="address">사업장 주소</label>
                        <input
                            id="address"
                            type="text"
                            placeholder="사업장 주소를 입력해 주세요."
                            autoComplete="off"
                            name="address"
                            className={RegisterStyle.essential}
                        />
                    </div>
                </div>
                <div className={RegisterStyle.vacation}>
                    <span>연차 계산 방식</span>
                    <div className={RegisterStyle.radio_wrap}>
                        <div>
                            <label>
                                <input type="radio" name="vacation_type" defaultValue="FINANCE_YEAR" defaultChecked />
                                <span className={RegisterStyle.label}>회계연도 기준</span>
                            </label>
                        </div>
                        <div>
                            <label>
                                <input type="radio" name="vacation_type" defaultValue="ENTRYDATE" />
                                <span className={RegisterStyle.label}>입사일 기준</span>
                            </label>
                        </div>
                        <div>
                            <label>
                                <input type="radio" name="vacation_type" defaultValue="FINANCE_YEAR_BY_ENTRYDATE" />
                                <span className={RegisterStyle.label}>회계연도 기준(입사일 기준 부여)</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div>
                    <label htmlFor="registNumber">사업자등록번호(선택)</label>
                    <input id="registNumber" type="text" placeholder="숫자를 입력해주세요." autoComplete="off" name="registNumber" maxLength="10" />
                </div>
                <div className={RegisterStyle.border_box}>
                    <label htmlFor="workSectorCode">업종코드(선택)</label>
                    <input
                        id="workSectorCode"
                        type="text"
                        placeholder="숫자를 입력해주세요."
                        autoComplete="off"
                        name="workSectorCode"
                        maxLength="6"
                    />
                </div>

                <h3>약관동의</h3>
                <div className={`${RegisterStyle.checkbox_wrap} ${RegisterStyle.border}`}>
                    <label>
                        <input
                            id="selectAll"
                            type="checkbox"
                            defaultValue="agree_all"
                            name="checkAll"
                            onChange={handleAgreeCheckAllChange}
                            checked={agreeCheckAll}
                        />
                        <span className={RegisterStyle.label}>전체동의</span>
                    </label>
                    <a href="#">자세히보기</a>
                </div>
                <div className={RegisterStyle.checkbox_wrap}>
                    <label>
                        <input
                            type="checkbox"
                            className={RegisterStyle.checkbox}
                            name="check01"
                            required
                            onChange={handleTermsChange}
                            checked={termsChecked}
                        />
                        <span className={RegisterStyle.label}>이용약관 동의 (필수)</span>
                    </label>
                    <a href="#">자세히보기</a>
                </div>
                <div className={RegisterStyle.checkbox_wrap}>
                    <label>
                        <input
                            type="checkbox"
                            className={RegisterStyle.checkbox}
                            name="check02"
                            required
                            onChange={handlePrivacyChange}
                            checked={privacyChecked}
                        />
                        <span className={RegisterStyle.label}>개인정보 수집 및 이용 동의 (필수)</span>
                    </label>
                    <a href="#">자세히보기</a>
                </div>
                <div className={`${RegisterStyle.checkbox_wrap} ${RegisterStyle.border_box}`}>
                    <label>
                        <input
                            type="checkbox"
                            className={RegisterStyle.checkbox}
                            name="check03"
                            onChange={handleMarketingChange}
                            checked={marketingChecked}
                        />
                        <span className={RegisterStyle.label}>마케팅 정보 수신에 대한 동의 (선택)</span>
                    </label>
                    <a href="#">자세히보기</a>
                </div>
                <button type="submit" className={RegisterStyle.submit_btn}>
                    회원가입
                </button>
            </form>
            {/* 

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100vh" }}>
                <form style={{ display: "flex", flexDirection: "column" }} onSubmit={onSubmit}>
                    <input type="text" placeholder="ID" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="password" placeholder="PW" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="submit">Register</button>
                </form>
            </div>	
			*/}
        </div>
    );
}

export default Register;
