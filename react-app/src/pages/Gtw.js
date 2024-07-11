import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import SERVER_URL from '../Config';

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

function Gtw() {
    const query = useQuery();

    console.log(query);

    const userId = query.get('userId');
    const type = query.get('type');
    const platform = query.get('platform');
    const slackuser = query.get('slackuser');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const params = new URLSearchParams({ userId, type, platform, slackuser });
                const response = await axios.get(`${SERVER_URL}/api/slack/gtwCheck?${params.toString()}`);
                console.log(response.data);
                if (response.data.windowClose) {
                    window.open('', '_self').close();
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, [userId, type, platform, slackuser]);

    return (
        <div>
            <h1>Gtw</h1>
            <p>User ID: {userId}</p>
            <p>Type: {type}</p>
            <p>Platform: {platform}</p>
            <p>Slack User: {slackuser}</p>
        </div>
    );
}

export default Gtw;
