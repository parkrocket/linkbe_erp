const express = require('express');
const app = express();
const port = 5000; // 사용할 포트 번호

app.get('/api/hello', (req, res) => {
    res.send({ message: 'Hello from Node.js!!!!' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
