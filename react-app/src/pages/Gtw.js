import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SERVER_URL from '../Config';

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
                const params = new URLSearchParams({ userId, type, platform, slackuser });
                const response = await axios.get(`${SERVER_URL}/api/slack/gtwCheck?${params.toString()}`);

                if (response.data.windowClose) {
                    window.open('', '_self').close();
                } else {
                    alert(response.data.message);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        if (userId === null || type === null || platform === null || slackuser === null) {
            alert('정상적인 접근이 아닙니다.');
            //window.open('', '_self').close();
            navigate('/');
        } else {
            fetchData();
        }
    }, [userId, type, platform, slackuser]);

    return (
        <div>
            <h1>슬랙 로그인 페이지</h1>
        </div>
    );
}

export default Gtw;
