require('dotenv').config();
const express = require('express');
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
    
    console.log('📤 Responding with IVR');
    
    const response = {
      ivr: {
        say: {
          text: "Hej och välkommen till Elexperten. Hur kan jag hjälpa dig?",
          voice: "Astrid"
        },
        next: `${process.env.BASE_URL}/handle-recording?callid=${callid}&from=${encodeURIComponent(from || '')}`
      }
    };
    
    console.log('Response:', JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.error('❌ Error:', error);
    res.json({ hangup: true });
  }
});

// Handle recording from user
app.post('/handle-recording', async (req, res) => {
  console.log('🎤 Recording received:', req.body);
  console.log('Query:', req.query);
  
  res.json({
    ivr: {
      say: {
        text: "Tack för ditt samtal. Hej då.",
        voice: "Astrid"
      },
      hangup: true
    }
  });
});

// 46elks call status webhook
app.post('/call-status', (req, res) => {
  console.log('📊 Call status:', req.body);
  res.sendStatus(200);
});

// Create HTTP server
const server = http.createServer(app);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Handymate Voice Agent running on port ${PORT}`);
  console.log(`📞 Webhook URL: /incoming-call`);
});
