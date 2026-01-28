require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const { handleIncomingCall, handleCallWebhook } = require('./call-handler');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

// 46elks webhook - incoming call notification
app.post('/incoming-call', async (req, res) => {
  try {
    console.log('📞 Incoming call:', req.body);
    
    const { callid, from } = req.body;
    
    // Enkel TTS via 46elks
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

app.post('/handle-recording', async (req, res) => {
  console.log('🎤 Recording received:', req.body);
  console.log('Query:', req.query);
  
  // För nu, bara svara och lägg på
  res.json({
    play: `https://api.46elks.com/static/tts/sv_SE/${encodeURIComponent("Tack för ditt samtal. Hej då.")}`,
    hangup: true
  });
});
  
  const { callid, from, to, direction } = req.body;
  
  // Tell 46elks to connect this call to our WebSocket audio stream
  const response = {
    connect: `+46766867337`, // Will be replaced with actual audio stream
    callerid: to
  };
  
  // For now, we'll use 46elks "connect" to forward or handle
  // In production, we'd use their audio streaming API
  
  res.json({
    ivr: `${process.env.BASE_URL || 'https://your-railway-url.railway.app'}/voice-stream?callid=${callid}&from=${encodeURIComponent(from)}`
  });
});

// 46elks voice webhook - for IVR/audio control
app.post('/voice-stream', async (req, res) => {
  const { callid, from } = req.query;
  console.log('🎤 Voice stream request:', { callid, from });
  
  // Start the conversation
  const result = await handleIncomingCall(callid, from);
  res.json(result);
});

// 46elks call status webhook
app.post('/call-status', (req, res) => {
  console.log('📊 Call status:', req.body);
  res.sendStatus(200);
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time audio (future enhancement)
const wss = new WebSocketServer({ server, path: '/audio-ws' });

wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket connected');
  
  ws.on('message', (data) => {
    // Handle incoming audio chunks
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
