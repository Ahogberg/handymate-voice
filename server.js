require('dotenv').config();
const express = require('express');
const http = require('http');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

app.post('/incoming-call', async (req, res) => {
  try {
    console.log('📞 Incoming call:', req.body);
    const { callid, from } = req.body;
    
    // 46elks TTS URL format
    const message = encodeURIComponent("Hej och välkommen till Elexperten. Vänligen lämna ett meddelande efter tonen.");
    
    res.json({
      ivr: `http://tts.api.46elks.com/sv_SE/${message}`,
      next: `${process.env.BASE_URL}/handle-input?callid=${callid}&from=${encodeURIComponent(from || '')}`
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.json({ hangup: true });
  }
});

app.post('/handle-input', async (req, res) => {
  console.log('🎤 Input received:', req.body);
  
  const message = encodeURIComponent("Tack för ditt samtal. Hej då.");
  res.json({
    ivr: `http://tts.api.46elks.com/sv_SE/${message}`,
    next: `${process.env.BASE_URL}/hangup`
  });
});

app.post('/hangup', (req, res) => {
  res.json({ hangup: true });
});

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Handymate Voice Agent running on port ${PORT}`);
});
