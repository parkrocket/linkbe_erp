import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SERVER_URL from '../Config';
import { useSelector } from 'react-redux';

import LeftGnbStyle from '../css/LeftGnb.module.scss';
import RightContStyle from '../css/RightCont.module.scss';

import VacaTable from '../component/Vacation/VacaTable';
import LeftGnb from '../component/LeftGnb';
import Apply from '../component/Apply';
import VacaSummary from '../component/Vacation/VacaSummary';

function Vaca() {
    const [recordList, setRecordList] = useState([]);
    const user = useSelector(state => state.user);

    const recordAxiosList = (setRecordList, userId) => {
        const dataToSubmit = { user_id: userId };

        axios
            .post(`${SERVER_URL}/api/vacation/list`, dataToSubmit)
            .then(response => {
                setRecordList(response.data.vacationList);
            });
    };

    useEffect(() => {
        if (user && user.userData && user.userData.user) {
            recordAxiosList(setRecordList, user.userData.user.user_id);
        }
    }, [user]);

    return (
        <div className={`${LeftGnbStyle.outer} display-f`}>
            <LeftGnb />
            <section className={` margin-c`}>
                <Apply />
                <div className={RightContStyle.box01}>
                    <VacaSummary />
                    <VacaTable
                        list={recordList}
                        setRecordList={setRecordList}
                    />
                </div>
            </section>
        </div>
    );
}

export default Vaca;
