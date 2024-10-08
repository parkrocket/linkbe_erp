import React from 'react';
import { useSelector } from 'react-redux';

import './../css/Footer.scss';

import FooterMobileMenu from '../component/HeadFoot/FooterMobileMenu';

function Footer() {
    const user = useSelector(state => state.user);
    return (
        <footer>
            <div className="container pc_only padding-t30 padding-b30">
                <div className="wrapper max_1700 margin-c">
                    <div className="info ">
                        <p>
                            <span>사업자 등록번호 : 000-00-00000</span> |{' '}
                            <span>통신판매업신고번호: 제 0000호</span> <br />
                            <span>대표 : 홍길동</span> |{' '}
                            <span>
                                주소 : 서울시 금천구 디지털로9길 65(가산동,
                                백상스타타워1차)
                            </span>{' '}
                            <br />
                            <span>전화 : 02--000-0000</span> |{' '}
                            <span>이메일 : linkbe.kr</span>{' '}
                        </p>
                        <p className="copyright">
                            Copyright 2024. Linkbe. All rights reserved.
                        </p>{' '}
                    </div>
                </div>
            </div>
            {user.isAuthenticated ? (
                // 로그인 했을 때
                <div className="container mo_only padding-t30 padding-b30">
                    <div className="wrapper max_1700 margin-c">
                        <FooterMobileMenu />
                    </div>
                </div>
            ) : (
                // 로그인 안했을 때
                ''
            )}
        </footer>
    );
}

export default Footer;
