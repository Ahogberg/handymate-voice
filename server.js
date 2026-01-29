require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, 'audio')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

// Test TTS endpoint - generates audio on the fly
app.get('/tts', async (req, res) => {
  const text = req.query.text || 'Hej och välkommen';
  
  try {
    const sdk = require('microsoft-cognitiveservices-speech-sdk');
    
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );
    speechConfig.speechSynthesisVoiceName = 'sv-SE-SofieNeural';
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
    
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    
    synthesizer.speakTextAsync(
      text,
      result => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          res.set('Content-Type', 'audio/wav');
          res.send(Buffer.from(result.audioData));
        } else {
          console.error('TTS Error:', result.errorDetails);
          res.status(500).send('TTS failed');
        }
        synthesizer.close();
      },
      error => {
        console.error('TTS Error:', error);
        synthesizer.close();
        res.status(500).send('TTS failed');
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).send('TTS failed');
  }
});

app.post('/incoming-call', async (req, res) => {
  try {
    console.log('📞 Incoming call:', req.body);
    const { callid, from } = req.body;
    
    const message = encodeURIComponent('Hej och välkommen till Elexperten. Hur kan jag hjälpa dig?');
    
    res.json({
      ivr: `${process.env.BASE_URL}/tts?text=${message}`,
      next: `${process.env.BASE_URL}/handle-input?callid=${callid}&from=${encodeURIComponent(from || '')}`
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.json({ hangup: true });
  }
});

app.post('/handle-input', async (req, res) => {
  console.log('🎤 Input received:', req.body);
  
  const message = encodeURIComponent('Tack för ditt samtal. Hej då.');
  res.json({
    ivr: `${process.env.BASE_URL}/tts?text=${message}`,
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
