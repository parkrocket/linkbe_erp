import React, { useState, useEffect } from 'react';
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
    const [txt, setTxt] = useState([]);

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

        //출근, 퇴근일 때 로딩멘드 변경
        let txtContent = [];
        if (type === 'gtw' || type === 'remote_gtw') {
            // 출근(gtw), 재택퇴근(remote_gtw)일때
            txtContent = [
                <span key="1">출</span>,
                <span key="2">근</span>,
                <span key="3">중</span>,
                <span key="4">.</span>,
                <span key="5">.</span>,
            ];
        } else if (type === 'go' || type === 'remote_go') {
            // 퇴근(go), 재택퇴근(remote_go)일때
            txtContent = [
                <span key="1">퇴</span>,
                <span key="2">근</span>,
                <span key="3">중</span>,
                <span key="4">.</span>,
                <span key="5">.</span>,
            ];
        }
        setTxt(txtContent);
    }, [userId, type, platform, slackuser]);

    return (
        <div
            id={GtwStyle.loading_wrapper}
            className="text-align-c display-f align-items-c align-content-c justify-c flex-wrap"
        >
            <div id={GtwStyle.loading}>
                <div></div>
            </div>
            <p className="padding-t40 mo-padding-t40">{txt}</p>
        </div>
    );
}

export default Gtw;
