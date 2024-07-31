import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { Link } from 'react-router-dom';
import RecordTable from '../component/RecordTable';

function Main() {
    const user = useSelector(state => state.user);

    return (
        <div className="wrapper max_1700 margin-c">
            {user.isAuthenticated ? (
                <p className="text-align-c" style={{ paddingTop: '200px' }}>
                    Hi{'~! '}
                    {user.userData &&
                    user.userData.user &&
                    user.userData.user.user_name ? (
                        <span>{user.userData.user.user_name}</span>
                    ) : (
                        ''
                    )}
                    😎
                </p>
            ) : (
                <p className="text-align-c" style={{ paddingTop: '200px' }}>
                    <Link to="/login">
                        링크비 관리 플랫폼에 오신걸 환영합니다 😎😎
                    </Link>
                </p>
            )}
        </div>
    );
}

export default Main;
