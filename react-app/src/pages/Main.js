import React from 'react';
import { useSelector } from 'react-redux';

import UserMain from '../component/UserMain';
import PublicMain from '../component/PublicMain';

function Main() {
    const user = useSelector(state => state.user);

    return (
        <div className="container max_1300 margin-c">
            {user.isAuthenticated ? <UserMain /> : <PublicMain />}
        </div>
    );
}

export default Main;
