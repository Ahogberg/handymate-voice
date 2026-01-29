require('dotenv').config();
const express = require('express');
const http = require('http');
const sdk = require('microsoft-cognitiveservices-speech-sdk');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store conversations
const conversations = new Map();

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

// Generate TTS audio
app.get('/tts', async (req, res) => {
  const text = req.query.text || 'Hej';
  
  try {
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

// Incoming call - greet and start recording
app.post('/incoming-call', async (req, res) => {
  try {
    console.log('📞 Incoming call:', req.body);
    const { callid, from } = req.body;
    
    // Initialize conversation
    conversations.set(callid, {
      from: from,
      messages: [{ role: 'assistant', content: 'Hej och välkommen till Elexperten. Hur kan jag hjälpa dig?' }]
    });
    
    const greeting = encodeURIComponent('Hej och välkommen till Elexperten. Hur kan jag hjälpa dig?');
    
    res.json({
      play: `${process.env.BASE_URL}/tts?text=${greeting}`,
      next: `${process.env.BASE_URL}/record?callid=${callid}`
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.json({ hangup: true });
  }
});

// Record user speech
app.post('/record', async (req, res) => {
  const { callid } = req.query;
  console.log('🎙️ Starting recording for:', callid);
  
  res.json({
    record: `${process.env.BASE_URL}/handle-recording?callid=${callid}`,
    timeout: 5,
    silence: 3
  });
});

// Handle recording - transcribe and respond
app.post('/handle-recording', async (req, res) => {
  const { callid } = req.query;
  const { recording } = req.body;
  
  console.log('🎤 Recording received for:', callid);
  console.log('Recording URL:', recording);
  
  try {
    // For now, just acknowledge and hang up
    // We'll add Whisper + Claude next
    
    const response = encodeURIComponent('Tack, jag hörde vad du sa. Vi arbetar på att koppla in AI-assistenten. Hej då!');
    
    res.json({
      play: `${process.env.BASE_URL}/tts?text=${response}`,
      next: `${process.env.BASE_URL}/hangup`
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.json({ hangup: true });
  }
});

app.post('/hangup', (req, res) => {
  console.log('📞 Call ended');
  res.json({ hangup: true });
});

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Handymate Voice Agent running on port ${PORT}`);
});
