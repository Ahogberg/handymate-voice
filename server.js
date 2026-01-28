require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

// 46elks webhook - incoming call
app.post('/incoming-call', async (req, res) => {
  try {
    console.log('📞 Incoming call:', req.body);
    
    const { callid, from } = req.body;
    
    const message = "Hej och välkommen till Elexperten. Hur kan jag hjälpa dig?";
    
    console.log('📤 Responding with TTS');
    
    res.json({
      ivr: {
        play: `https://api.46elks.com/static/tts/sv_SE/${encodeURIComponent(message)}`,
        next: {
          record: `${process.env.BASE_URL}/handle-recording?callid=${callid}&from=${encodeURIComponent(from || '')}`
        }
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ hangup: true });
  }
});

// Handle recording from user
app.post('/handle-recording', async (req, res) => {
  console.log('🎤 Recording received:', req.body);
  console.log('Query:', req.query);
  
  res.json({
    play: `https://api.46elks.com/static/tts/sv_SE/${encodeURIComponent("Tack för ditt samtal. Hej då.")}`,
    hangup: true
  });
});

// 46elks call status webhook
app.post('/call-status', (req, res) => {
  console.log('📊 Call status:', req.body);
  res.sendStatus(200);
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for future use
const wss = new WebSocketServer({ server, path: '/audio-ws' });

wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket connected');
  
  ws.on('message', (data) => {
    console.log('🎵 Received audio chunk:', data.length, 'bytes');
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Handymate Voice Agent running on port ${PORT}`);
  console.log(`📞 Webhook URL: /incoming-call`);
  console.log(`🎤 Voice stream: /voice-stream`);
});
