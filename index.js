const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();

let authKeys;
try {
    const data = fs.readFileSync('auto.json', 'utf8');
    authKeys = JSON.parse(data);
} catch (err) {
    console.error('Error reading auto.json file:', err);
    process.exit(1);
}

app.use(express.json());

const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (!apiKey || !authKeys[apiKey]) {
        return res.status(401).json({ error: 'Invalid API Key' });
    }
    req.originalAuthKey = authKeys[apiKey];
    next();
};

app.use('/*', validateApiKey);

app.all('/*', async (req, res) => {
    const targetUrl = 'http://192.168.3.6:7999' + req.originalUrl;
    console.log(`Proxying to ${targetUrl}`);
    if (req.body.model === 'gpt-4-32k') {
        req.body.model = 'gpt-4-mobile';
        console.log(`Model changed to ${req.body.model}`);
    }
    try {
        axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: { 'Authorization': `Bearer ${req.originalAuthKey}` },
            responseType: 'stream'
        }).then(response => {
            res.writeHead(response.status, response.headers);
            response.data.on('data', chunk => {
                res.write(chunk);
            });
            response.data.on('end', () => {
                res.end();
            });
        }).catch(error => {
            if (error.response) {
                res.status(error.response.status).json({ message: "Error from target API" });
                console.log(error.response.data);
            } else {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});