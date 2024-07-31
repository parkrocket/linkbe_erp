import React from 'react';
import LeftGnb from '../component/LeftGnb';
import LeftGnbStyle from '../css/LeftGnb.module.scss';

function Sent() {
    return (
        <div className={`${LeftGnbStyle.outer} display-f`}>
            <LeftGnb />
            <section></section>
        </div>
    );
}

export default Sent;
