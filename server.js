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
    
    // 46elks IVR format - ivr ska vara en URL till ljudfil
    res.json({
      ivr: "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3",
      next: `${process.env.BASE_URL}/handle-input?callid=${callid}&from=${encodeURIComponent(from || '')}`
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.json({ hangup: true });
  }
});

// Handle input
app.post('/handle-input', async (req, res) => {
  console.log('🎤 Input received:', req.body);
  res.json({ hangup: true });
});

// Create HTTP server
const server = http.createServer(app);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Handymate Voice Agent running on port ${PORT}`);
});
