import React from 'react';

import LeftGnbStyle from '../css/LeftGnb.module.scss';

import LeftGnb from '../component/LeftGnb';

function WorkHistory() {
    return (
        <div className={`${LeftGnbStyle.outer} display-f`}>
            <LeftGnb />
            <section></section>
        </div>
    );
}

export default WorkHistory;
