import React from 'react';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

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
    const [shiftType, setShiftType] = useState({});
    const [dayGtw, setDayGtw] = useState({});

    const [today, setToday] = useState(moment().format('YYYY-MM-DD'));

    const user = useSelector(state => state.user);

    useEffect(() => {
        recodeAxiosLIst(setRecodeList, recodeListDate);
        companyAxiosInfo(setShiftType, user.userData.user.cp_id);
        gtwAxiosDay(setDayGtw, user.userData.user.user_id, today);
    }, [recodeListDate, user.userData.user.user_id, today]);

    const recodeAxiosLIst = (setRecodeList, recodeListDate) => {
        const dataTosubmit = { date: recodeListDate };

        axios
            .post(`${SERVER_URL}/api/list/lists`, dataTosubmit)
            .then(response => {
                setRecodeList(response.data.list);
            });
    };

    const companyAxiosInfo = (setShiftType, cpId) => {
        const dataTosubmit = { cpId: cpId };

        axios
            .post(`${SERVER_URL}/api/company/info`, dataTosubmit)
            .then(response => {
                setShiftType(response.data.info);
            });
    };

    const gtwAxiosDay = (setDayGtw, userId, today) => {
        console.log(today);

        const dataTosubmit = { userId: userId, date: today };

        axios
            .post(`${SERVER_URL}/api/gtw/gtwStatus`, dataTosubmit)
            .then(response => {
                setDayGtw(response.data.gtw);
            });
    };

    return (
        <div className={`${LeftGnbStyle.outer} display-f`}>
            <LeftGnb />
            <section className={` margin-c`}>
                <Apply companyInfo={shiftType} />
                <div className="display-f justify-sb">
                    <DailyRecord
                        dayGtw={dayGtw}
                        today={today}
                        setToday={setToday}
                    />
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
