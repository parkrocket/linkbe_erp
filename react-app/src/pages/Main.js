import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { Link } from 'react-router-dom';
import RecordTable from '../component/RecordTable';
import MainStyle from '../css/Main.module.css';
import axios from 'axios';
import SERVER_URL from '../Config';
import moment from 'moment';

function Main() {
    const user = useSelector(state => state.user);

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
        <div>
            <main>
                <div className={`${MainStyle.container}`}>
                    <div className={MainStyle.wrapper}>
                        {user.isAuthenticated ? (
                            <div>
                                <RecordTable
                                    list={recodeList}
                                    date={recodeListDate}
                                    setRecodeListDate={setRecodeListDate}
                                    recodeAxiosLIst={recodeAxiosLIst}
                                    setRecodeList={setRecodeList}
                                ></RecordTable>
                            </div>
                        ) : (
                            <p className="text-align-c">
                                <Link to="/login">
                                    로그인 해주세요!! 수정해봅니다.
                                </Link>
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Main;
