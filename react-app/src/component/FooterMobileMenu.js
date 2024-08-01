import React from 'react';
import { Link } from 'react-router-dom';

import { faHouse } from '@fortawesome/free-solid-svg-icons';
import { faClock } from '@fortawesome/free-regular-svg-icons';
import { faUmbrellaBeach } from '@fortawesome/free-solid-svg-icons';
import { faPen } from '@fortawesome/free-solid-svg-icons';
import { faEllipsis } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function FooterMobileMenu() {
    return (
        <div className="links display-g align-items-c text-align-c">
            <Link to="/">
                {' '}
                <FontAwesomeIcon
                    icon={faHouse}
                    style={{ color: '#4368A2' }}
                    size="lg"
                    className="display-b margin-c"
                />
                <span>홈</span>
            </Link>
            <Link to="/work">
                <FontAwesomeIcon
                    icon={faClock}
                    style={{ color: '#4368A2' }}
                    size="lg"
                    className="display-b margin-c"
                />
                <span>근무관리</span>
            </Link>
            <Link to="/vaca">
                <FontAwesomeIcon
                    icon={faUmbrellaBeach}
                    style={{ color: '#4368A2' }}
                    size="lg"
                    className="display-b margin-c"
                />
                <span>휴가관리</span>
            </Link>
            <Link to="/sent">
                <FontAwesomeIcon
                    icon={faPen}
                    style={{ color: '#4368A2' }}
                    size="lg"
                    className="display-b margin-c"
                />
                <span>결재</span>
            </Link>
            <Link to="/etc">
                <FontAwesomeIcon
                    icon={faEllipsis}
                    style={{ color: '#4368A2' }}
                    size="lg"
                    className="display-b margin-c"
                />
                <span>기타</span>
            </Link>
        </div>
    );
}

export default FooterMobileMenu;
