import React from 'react';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import moment from 'moment';
import axios from 'axios';
import SERVER_URL from '../Config';

import LeftGnbStyle from '../css/LeftGnb.module.scss';

import LeftGnb from '../component/LeftGnb';
import Apply from '../component/Apply';
import DailyRecord from '../component/Work/DailyRecord';
import WeeklyRecord from '../component/Work/WeeklyRecord';
import MemberRecord from '../component/Work/MemberRecord';
import MonthlyRecord from '../component/Work/MonthlyRecord';

function Work() {
    console.log('리로딩');

    const [recodeListDate, setRecodeListDate] = useState(
        moment().format('YYYY-MM-DD'),
    );

    const [shiftType, setShiftType] = useState({});

    const [today, setToday] = useState(moment().format('YYYY-MM-DD'));

    const user = useSelector(state => state.user);

    useEffect(() => {
        companyAxiosInfo(setShiftType, user.userData.user.cp_id);
    }, [recodeListDate, user.userData.user.user_id, today]);

    const companyAxiosInfo = (setShiftType, cpId) => {
        const dataTosubmit = { cpId: cpId };

        axios
            .post(`${SERVER_URL}/api/company/info`, dataTosubmit)
            .then(response => {
                setShiftType(response.data.info);
            });
    };

    return (
        <div className={`${LeftGnbStyle.outer} display-f`}>
            <LeftGnb />
            <section className={` margin-c`}>
                <Apply companyInfo={shiftType} />
                <div className="display-f justify-sb">
                    <DailyRecord
                        today={today}
                        setToday={setToday}
                        user={user}
                    />
                    <WeeklyRecord
                        today={today}
                        setToday={setToday}
                        user={user}
                    />
                </div>
                <MemberRecord
                    date={recodeListDate}
                    today={today}
                    setRecodeListDate={setRecodeListDate}
                ></MemberRecord>
                <MonthlyRecord today={today}></MonthlyRecord>
            </section>
        </div>
    );
}

export default Work;
