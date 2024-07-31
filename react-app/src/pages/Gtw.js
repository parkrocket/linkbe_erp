import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SERVER_URL from '../Config';
import GtwStyle from './../css/Gtw.module.css';

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

function Gtw() {
    const query = useQuery();

    const userId = query.get('userId');
    const type = query.get('type');
    const platform = query.get('platform');
    const slackuser = query.get('slackuser');

    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const params = new URLSearchParams({
                    userId,
                    type,
                    platform,
                    slackuser,
                });
                const response = await axios.get(
                    `${SERVER_URL}/api/slack/gtwCheck?${params.toString()}`,
                );

                console.log(response);

                if (response.data.windowClose) {
                    window.open('', '_self').close();
                } else {
                    alert(response.data.message);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        if (
            userId === null ||
            type === null ||
            platform === null ||
            slackuser === null
        ) {
            alert('정상적인 접근이 아닙니다.');
            //window.open('', '_self').close();
            navigate('/');
        } else {
            fetchData();
        }
    }, [userId, type, platform, slackuser]);

    return (
        <div id={GtwStyle.loading_wrapper} className="text-align-c">
            <div id={GtwStyle.loading}>
                <div></div>
            </div>
            <p className="padding-t40 mo-padding-t40">
                <span>출</span>
                <span>근</span>
                <span>중</span>
                <span>.</span>
                <span>.</span>
            </p>
        </div>
    );
}

export default Gtw;
