import React from 'react';
import LeftGnb from '../component/LeftGnb';
import LeftGnbStyle from '../css/LeftGnb.module.scss';
import { useState, useEffect } from 'react';
import moment from 'moment';
import axios from 'axios';
import RecordTable from '../component/RecordTable';
import SERVER_URL from '../Config';

function Work() {
    const [recodeListDate, setRecodeListDate] = useState(
        moment().format('YYYY-MM-DD'),
    );
    const [recodeList, setRecodeList] = useState([]);

    useEffect(() => {
        recodeAxiosLIst(setRecodeList, recodeListDate);
    }, [recodeListDate]);

    const recodeAxiosLIst = (setRecodeList, recodeListDate) => {
        const dataTosubmit = { date: recodeListDate };

        axios
            .post(`${SERVER_URL}/api/list/lists`, dataTosubmit)
            .then(response => {
                setRecodeList(response.data.list);
            });
    };
    return (
        <div className={`${LeftGnbStyle.outer} display-f`}>
            <LeftGnb />
            <RecordTable
                list={recodeList}
                date={recodeListDate}
                setRecodeListDate={setRecodeListDate}
                recodeAxiosLIst={recodeAxiosLIst}
                setRecodeList={setRecodeList}
            ></RecordTable>
        </div>
    );
}

export default Work;
