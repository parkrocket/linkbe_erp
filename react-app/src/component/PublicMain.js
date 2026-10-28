import React from 'react';
import { Link } from 'react-router-dom';
function PublicMain() {
    return (
        <p className="text-align-c" style={{ paddingTop: '200px' }}>
            <Link to="/login">링크비 관리 플랫폼에 오신 것을 환영합니다 😎😎</Link>
        </p>
    );
}

export default PublicMain;
