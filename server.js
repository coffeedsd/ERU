require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': req.headers.origin || 'http://localhost:3000',
                'X-Title': 'DeepSeek Chat'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-r1-0528:free',
                messages: req.body.messages
            })
        });
        
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Сервер на порту ${process.env.PORT || 3000}`);
});