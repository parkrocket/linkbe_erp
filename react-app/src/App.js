import React, { useEffect, useState } from 'react';

function App() {
    const [message, setMessage] = useState('');

    useEffect(() => {
        // 로컬 Node.js 서버의 API 엔드포인트 호출
        fetch('http://localhost:5000/api/hello')
            .then((response) => response.json())
            .then((data) => setMessage(data.message))
            .catch((error) => console.error('Error fetching data:', error));
    }, []);

    return (
        <div className="App">
            <header className="App-header">
                <h1>통신테스트:</h1>
                <p>{message}</p>
            </header>
        </div>
    );
}

export default App;
