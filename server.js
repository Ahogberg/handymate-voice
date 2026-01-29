require('dotenv').config();
const express = require('express');
const http = require('http');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

app.post('/incoming-call', (req, res) => {
  console.log('📞 Incoming call:', req.body);
  res.json({
    connect: 'sip:+46766867337@sip.retellai.com',
    callerid: '+46766867337'
  });
});

app.post('/forward-to-retell', (req, res) => {
  console.log('📞 Forwarding to Retell:', req.body);
  res.json({
    connect: 'sip:+46766867337@sip.retellai.com',
    callerid: '+46766867337'
  });
});

app.post('/call-status', (req, res) => {
  console.log('📊 Call status:', req.body);
  res.sendStatus(200);
});

http.createServer(app).listen(process.env.PORT || 3000, () => {
  console.log('🚀 Running on port', process.env.PORT || 3000);
});
