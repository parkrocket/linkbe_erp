import React from 'react';
import { useState, useEffect } from 'react';

import moment from 'moment';
import axios from 'axios';
import SERVER_URL from '../Config';

import LeftGnbStyle from '../css/LeftGnb.module.scss';

import LeftGnb from '../component/LeftGnb';
import RecordTable from '../component/RecordTable';
import Apply from '../component/Apply';
import DailyRecord from '../component/DailyRecord';
import WeeklyRecord from '../component/WeeklyRecord';
import MemberRecord from '../component/MemberRecord';

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
            <section className={` margin-c`}>
                <Apply />
                <div className="display-f justify-sb">
                    <DailyRecord />
                    <WeeklyRecord />
                </div>
                <MemberRecord
                    list={recodeList}
                    date={recodeListDate}
                    setRecodeListDate={setRecodeListDate}
                    recodeAxiosLIst={recodeAxiosLIst}
                    setRecodeList={setRecodeList}
                ></MemberRecord>
                <RecordTable
                    list={recodeList}
                    date={recodeListDate}
                    setRecodeListDate={setRecodeListDate}
                    recodeAxiosLIst={recodeAxiosLIst}
                    setRecodeList={setRecodeList}
                ></RecordTable>
            </section>
        </div>
    );
}

export default Work;
