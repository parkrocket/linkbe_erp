import React, { useEffect, useState } from 'react';
import { Routes } from './pages/Routes';

function App() {
    const [message, setMessage] = useState('');

    const apiUrl = process.env.REACT_APP_API_URL;

    useEffect(() => {
        // 로컬 Node.js 서버의 API 엔드포인트 호출
        fetch(apiUrl)
            .then((response) => response.json())
            .then((data) => setMessage(data.message))
            .catch((error) => console.error('Error fetching data:', error));
    }, []);

    return (
        <React.Fragment>
            <Routes />
        </React.Fragment>
    );
}

export default App;
