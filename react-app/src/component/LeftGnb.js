import React, { useState, useEffect } from 'react';
import LeftGnbStyle from '../css/LeftGnb.module.scss';
import { Link, useLocation } from 'react-router-dom';

function LeftGnb() {
    const [leftGnbHeight, setLeftGnbHeight] = useState(0);
    const location = useLocation();

    useEffect(() => {
        setLeftGnbHeight(window.innerHeight - 75);
    }, []);
    // console.log(leftGnbHeight);

    const getLinkClassName = path => {
        return location.pathname === path
            ? `${LeftGnbStyle.on} display-b`
            : 'display-b';
    };
    const renderLinks = () => {
        const path = location.pathname;

        if (path.startsWith('/work') || path.startsWith('/vaca')) {
            return (
                <>
                    <h3>근태</h3>
                    <div className={LeftGnbStyle.gnb_list}>
                        <Link to="/work" className={getLinkClassName('/work')}>
                            근무
                        </Link>
                        <Link to="/vaca" className={getLinkClassName('/vaca')}>
                            연차/휴가
                        </Link>
                        <Link
                            to="/workHistory"
                            className={getLinkClassName('/workHistory')}
                        >
                            내 근태 신청내역
                        </Link>
                    </div>
                </>
            );
        } else if (path.startsWith('/sent') || path.startsWith('/rece')) {
            return (
                <>
                    <h3>결재</h3>
                    <div className={LeftGnbStyle.gnb_list}>
                        <Link to="/sent" className={getLinkClassName('/sent')}>
                            상신함
                        </Link>
                        <Link
                            to="/receive"
                            className={getLinkClassName('/rece')}
                        >
                            수신함
                        </Link>
                    </div>
                </>
            );
        } else {
            return null; // Or render a default section if needed
        }
    };

    return (
        <div
            className={LeftGnbStyle.left_gnb}
            style={{ height: leftGnbHeight }}
        >
            {renderLinks()}
        </div>
    );
}

export default LeftGnb;
