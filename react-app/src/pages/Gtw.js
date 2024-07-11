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
    const slackUser = query.get('slackuser');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const params = new URLSearchParams({ userId, type, platform, slackUser });
                const response = await axios.get(`${SERVER_URL}/api/slack/gtwCheck?${params.toString()}`);
                console.log(response.data);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, [userId, type, platform, slackUser]);

    return (
        <div>
            <h1>Gtw</h1>
            <p>User ID: {userId}</p>
            <p>Type: {type}</p>
            <p>Platform: {platform}</p>
            <p>Slack User: {slackUser}</p>
        </div>
    );
}

export default Gtw;
