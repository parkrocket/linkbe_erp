import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { registerUser } from '../_actions/user_action';
import { useNavigate } from 'react-router-dom';
import RegisterStyle from '../css/Register.module.css';

import axios from 'axios';
import SERVER_URL from '../Config';

function Register() {
    const [form, setForm] = useState({
        email: '',
        password: '',
        passwordCheck: '',
        name: '',
        phone: '',
        cp_id: '',
        companyName: '',
        companyHomepage: '',
        companyAddr: '',
        companyStandard: 'finance_year',
        companyNumber: '',
        companyCode: '',
    });
    const [validity, setValidity] = useState({
        isValidEmail: true,
        isValidPassword: true,
        isValidPasswordCheck: true,
        isValidName: true,
        isValidPhone: true,
    });
    const [agreeCheckAll, setAgreeCheckAll] = useState(false);
    const [termsChecked, setTermsChecked] = useState(false);
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [marketingChecked, setMarketingChecked] = useState(false);
    const [companyList, setCompanyList] = useState([]);

    const { email, password, passwordCheck, name, phone } = form;
    const {
        isValidEmail,
        isValidPassword,
        isValidPasswordCheck,
        isValidName,
        isValidPhone,
    } = validity;

    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);
    const passwordCheckInputRef = useRef(null);
    const nameInputRef = useRef(null);
    const phoneInputRef = useRef(null);

    const navigate = useNavigate();
    const dispatch = useDispatch();

    const handleInputChange = e => {
        const { name, value } = e.target;
        if (name === 'companyName') {
            const selectedCompany = companyList.find(
                company => company.cp_name === value,
            );
            if (selectedCompany) {
                setForm({
                    ...form,
                    cpId: selectedCompany.cp_id,
                    companyName: selectedCompany.cp_name,
                    companyHomepage: selectedCompany.cp_homepage,
                    companyAddr: selectedCompany.cp_addr,
                    companyStandard: selectedCompany.cp_type,
                    companyNumber: selectedCompany.cp_regi_number,
                    companyCode: selectedCompany.cp_code,
                });
            } else {
                setForm({ ...form, [name]: value });
            }
        } else {
            setForm({ ...form, [name]: value });
        }

        if (name === 'email') {
            const emailRule =
                /^[a-z A-Z 0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;
            setValidity({ ...validity, isValidEmail: emailRule.test(value) });
        } else if (name === 'password') {
            const passwordRule =
                /^(?=.*[A-Za-z])(?=.*\d|.*[\p{P}\p{S}])[A-Za-z\d\p{P}\p{S}]{8,15}$/u;
            setValidity({
                ...validity,
                isValidPassword: passwordRule.test(value),
            });
            setValidity({
                ...validity,
                isValidPasswordCheck: value === passwordCheck,
            });
        } else if (name === 'passwordCheck') {
            setValidity({
                ...validity,
                isValidPasswordCheck: value === password,
            });
        } else if (name === 'name') {
            const nameRule = /^[가-힣]+$/;
            setValidity({
                ...validity,
                isValidName: value.length >= 2 && nameRule.test(value),
            });
        } else if (name === 'phone') {
            let formattedValue = value.replace(/[^0-9]/g, '');
            if (formattedValue.length <= 3) {
                e.target.value = formattedValue;
            } else if (formattedValue.length <= 7) {
                e.target.value = `${formattedValue.slice(
                    0,
                    3,
                )}-${formattedValue.slice(3)}`;
            } else {
                e.target.value = `${formattedValue.slice(
                    0,
                    3,
                )}-${formattedValue.slice(3, 7)}-${formattedValue.slice(
                    7,
                    11,
                )}`;
            }
            setValidity({
                ...validity,
                isValidPhone: e.target.value.length === 13,
            });
        }
    };

    useEffect(() => {
        axios.post(`${SERVER_URL}/api/company/list`).then(response => {
            console.log(response.data);

            setCompanyList(response.data.list);
        });

        const allChecked = termsChecked && privacyChecked && marketingChecked;
        setAgreeCheckAll(allChecked);
    }, [termsChecked, privacyChecked, marketingChecked, form]);

    const handleAgreeCheckAllChange = e => {
        const checked = e.target.checked;
        setAgreeCheckAll(checked);
        setTermsChecked(checked);
        setPrivacyChecked(checked);
        setMarketingChecked(checked);
    };

    const onSubmit = e => {
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

        dispatch(registerUser(form)).then(response => {
            if (response.payload.registerSuccess) {
                navigate('/login');
            } else {
                alert(response.payload.error);
            }
        });
    };

    return (
        <div className="margin-c">
            <h2 className={RegisterStyle.tit}>회원가입</h2>
            <form
                className={RegisterStyle.register_form}
                name="register_form"
                onSubmit={onSubmit}
            >
                <h3>계정정보</h3>
                <div className={RegisterStyle.essential_area}>
                    <div>
                        <div className={RegisterStyle.label_area}>
                            <label htmlFor="email">이메일</label>
                            <p
                                className={`${RegisterStyle.error} ${
                                    RegisterStyle.error_email
                                } ${isValidEmail ? '' : RegisterStyle.on}`}
                            >
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
                            onChange={handleInputChange}
                            className={isValidEmail ? '' : RegisterStyle.on}
                            ref={emailInputRef}
                            value={email}
                        />
                    </div>
                    <div>
                        <div className={RegisterStyle.label_area}>
                            <label htmlFor="password">비밀번호</label>
                            <p
                                className={`${RegisterStyle.error} ${
                                    RegisterStyle.error_password
                                } ${isValidPassword ? '' : RegisterStyle.on}`}
                            >
                                영어 대소문자, 숫자, 특수문자 중 2종류 조합의
                                8-15자
                            </p>
                        </div>
                        <input
                            id="password"
                            type="password"
                            placeholder="영어 대소문자, 숫자, 특수문자 중 2종류 조합의 8-15자"
                            autoComplete="off"
                            name="password"
                            required
                            onChange={handleInputChange}
                            className={isValidPassword ? '' : RegisterStyle.on}
                            ref={passwordInputRef}
                            value={password}
                        />
                    </div>
                    <div>
                        <div className={RegisterStyle.label_area}>
                            <label htmlFor="passwordConfirm">
                                비밀번호 확인
                            </label>
                            <p
                                className={`${RegisterStyle.error} ${
                                    RegisterStyle.error_confirm
                                } ${
                                    isValidPasswordCheck ? '' : RegisterStyle.on
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
                            name="passwordCheck"
                            required
                            onChange={handleInputChange}
                            className={
                                isValidPasswordCheck ? '' : RegisterStyle.on
                            }
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
                            onChange={handleInputChange}
                            className={RegisterStyle.essential}
                            required
                            ref={nameInputRef}
                            value={name}
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
                            onChange={handleInputChange}
                            className={RegisterStyle.essential}
                            maxLength="13"
                            required
                            ref={phoneInputRef}
                        />
                    </div>

                    <h3>회사 정보</h3>
                    <div>
                        <label htmlFor="corpName">회사명</label>
                        <select
                            id="corpName"
                            name="companyName"
                            className={RegisterStyle.essential}
                            value={form.companyName}
                            onChange={handleInputChange}
                        >
                            <option value="">회사명을 선택해 주세요</option>
                            {companyList.map((company, index) => (
                                <option
                                    key={company.cp_id}
                                    value={company.cp_name}
                                >
                                    {company.cp_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="homepage">회사 홈페이지</label>
                        <input
                            id="homepage"
                            type="text"
                            placeholder="회사 홈페이지를 입력해 주세요."
                            autoComplete="off"
                            name="companyHomepage"
                            className={RegisterStyle.essential}
                            value={form.companyHomepage}
                            onChange={handleInputChange}
                            readOnly
                        />
                    </div>
                    <div>
                        <label htmlFor="address">사업장 주소</label>
                        <input
                            id="address"
                            type="text"
                            placeholder="사업장 주소를 입력해 주세요."
                            autoComplete="off"
                            name="companyAddr"
                            className={RegisterStyle.essential}
                            value={form.companyAddr}
                            onChange={handleInputChange}
                            readOnly
                        />
                    </div>
                </div>
                <div className={RegisterStyle.vacation}>
                    <span>연차 계산 방식</span>
                    <div className={RegisterStyle.radio_wrap}>
                        <div>
                            <label>
                                <input
                                    type="radio"
                                    name="vacation_type"
                                    value="finance_year"
                                    checked={
                                        form.companyStandard === 'finance_year'
                                    }
                                    readOnly
                                />
                                <span className={RegisterStyle.label}>
                                    회계연도 기준
                                </span>
                            </label>
                        </div>
                        <div>
                            <label>
                                <input
                                    type="radio"
                                    name="vacation_type"
                                    value="entrydate"
                                    checked={
                                        form.companyStandard === 'entrydate'
                                    }
                                    readOnly
                                />
                                <span className={RegisterStyle.label}>
                                    입사일 기준
                                </span>
                            </label>
                        </div>
                        <div>
                            <label>
                                <input
                                    type="radio"
                                    name="vacation_type"
                                    value="finance_year_by_entrydate"
                                    checked={
                                        form.companyStandard ===
                                        'finance_year_by_entrydate'
                                    }
                                    readOnly
                                />
                                <span className={RegisterStyle.label}>
                                    회계연도 기준(입사일 기준 부여)
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
                <div>
                    <label htmlFor="registNumber">사업자등록번호(선택)</label>
                    <input
                        id="registNumber"
                        type="text"
                        placeholder="숫자를 입력해주세요."
                        autoComplete="off"
                        name="companyNumber"
                        maxLength="10"
                        value={form.companyNumber}
                        onChange={handleInputChange}
                        readOnly
                    />
                </div>
                <div className={RegisterStyle.border_box}>
                    <label htmlFor="workSectorCode">업종코드(선택)</label>
                    <input
                        id="workSectorCode"
                        type="text"
                        placeholder="숫자를 입력해주세요."
                        autoComplete="off"
                        name="companyCode"
                        maxLength="6"
                        value={form.companyCode}
                        onChange={handleInputChange}
                        readOnly
                    />
                </div>

                <h3>약관동의</h3>
                <div
                    className={`${RegisterStyle.checkbox_wrap} ${RegisterStyle.border}`}
                >
                    <label>
                        <input
                            id="selectAll"
                            type="checkbox"
                            value="agree_all"
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
                            onChange={e => setTermsChecked(e.target.checked)}
                            checked={termsChecked}
                        />
                        <span className={RegisterStyle.label}>
                            이용약관 동의 (필수)
                        </span>
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
                            onChange={e => setPrivacyChecked(e.target.checked)}
                            checked={privacyChecked}
                        />
                        <span className={RegisterStyle.label}>
                            개인정보 수집 및 이용 동의 (필수)
                        </span>
                    </label>
                    <a href="#">자세히보기</a>
                </div>
                <div
                    className={`${RegisterStyle.checkbox_wrap} ${RegisterStyle.border_box}`}
                >
                    <label>
                        <input
                            type="checkbox"
                            className={RegisterStyle.checkbox}
                            name="check03"
                            onChange={e =>
                                setMarketingChecked(e.target.checked)
                            }
                            checked={marketingChecked}
                        />
                        <span className={RegisterStyle.label}>
                            마케팅 정보 수신에 대한 동의 (선택)
                        </span>
                    </label>
                    <a href="#">자세히보기</a>
                </div>
                <button type="submit" className={RegisterStyle.submit_btn}>
                    회원가입
                </button>
            </form>
        </div>
    );
}

export default Register;
