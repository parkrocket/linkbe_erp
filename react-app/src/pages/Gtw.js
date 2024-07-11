import React from 'react';
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

    const dataTosubmit = { userId, type, platform, slackUser };

    axios.get(`${SERVER_URL}/api/slack/gtwCheck`, dataTosubmit).then((response) => {
        console.log(response);
    });

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
