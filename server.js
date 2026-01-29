require('dotenv').config();
const express = require('express');
const http = require('http');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const axios = require('axios');
const FormData = require('form-data');

// Pre-load Azure SDK
console.log('🔧 Loading Azure Speech SDK...');
const preloadConfig = sdk.SpeechConfig.fromSubscription(
  process.env.AZURE_SPEECH_KEY,
  process.env.AZURE_SPEECH_REGION
);
console.log('✅ Azure SDK ready');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const conversations = new Map();

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

// Generate TTS audio
app.get('/tts', async (req, res) => {
  const text = decodeURIComponent(req.query.text || 'Hej');
  console.log('🔊 TTS:', text);
  
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
          res.status(500).send('TTS failed');
        }
        synthesizer.close();
      },
      error => {
        synthesizer.close();
        res.status(500).send('TTS failed');
      }
    );
  } catch (error) {
    res.status(500).send('TTS failed');
  }
});

// Incoming call
app.post('/incoming-call', async (req, res) => {
  console.log('📞 Incoming call:', req.body);
  const { callid, from } = req.body;
  
  conversations.set(callid, {
    from: from,
    messages: []
  });
  
  const greeting = encodeURIComponent('Hej och välkommen till Elexperten. Hur kan jag hjälpa dig?');
  
  const response = {
    play: `${process.env.BASE_URL}/tts?text=${greeting}`,
    next: `${process.env.BASE_URL}/listen?callid=${callid}`
  };
  
  console.log('📤 Sending response:', JSON.stringify(response));
  res.json(response);
});

// Listen for user input
app.post('/listen', async (req, res) => {
  const { callid } = req.query;
  
  console.log('👂 Listen called:', req.body);
  
  // Tell 46elks to record - record ska vara en URL
  res.json({
    record: `${process.env.BASE_URL}/handle-recording?callid=${callid}`,
    timeout: 10,
    silence: 3
  });
});

// Handle the actual recording
app.post('/handle-recording', async (req, res) => {
  const { callid } = req.query;
  const { recording } = req.body;
  
  console.log('🎤 Recording received:', req.body);
  
  if (!recording) {
    console.log('❌ No recording URL');
    res.json({
      play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent('Jag hörde inte. Kan du upprepa?')}`,
      next: `${process.env.BASE_URL}/listen?callid=${callid}`
    });
    return;
  }
  
  try {
    // Transcribe with Whisper
    console.log('🔄 Transcribing...');
    const transcription = await transcribeAudio(recording);
    console.log('📝 User said:', transcription);
    
    // Get Claude response
    console.log('🤖 Asking Claude...');
    const response = await getChatResponse(callid, transcription);
    console.log('💬 Lisa says:', response);
    
    // Check if conversation should end
    if (response.toLowerCase().includes('hej då')) {
      res.json({
        play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent(response)}`,
        next: `${process.env.BASE_URL}/hangup`
      });
    } else {
      res.json({
        play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent(response)}`,
        next: `${process.env.BASE_URL}/listen?callid=${callid}`
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.json({
      play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent('Ursäkta, något gick fel. Hej då.')}`,
      next: `${process.env.BASE_URL}/hangup`
    });
  }
});

app.post('/hangup', (req, res) => {
  console.log('📞 Call ended');
  res.json({ hangup: true });
});

// Transcribe audio with Whisper
async function transcribeAudio(audioUrl) {
  // Download audio from 46elks
  const audioResponse = await axios.get(audioUrl, { 
    responseType: 'arraybuffer',
    auth: {
      username: process.env.ELKS_API_USERNAME,
      password: process.env.ELKS_API_PASSWORD
    }
  });
  
  // Create form data for Whisper
  const formData = new FormData();
  formData.append('file', Buffer.from(audioResponse.data), {
    filename: 'audio.wav',
    contentType: 'audio/wav'
  });
  formData.append('model', 'whisper-1');
  formData.append('language', 'sv');
  
  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    formData,
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      }
    }
  );
  
  return response.data.text;
}

// Get Claude response
async function getChatResponse(callid, userMessage) {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const conv = conversations.get(callid) || { messages: [] };
  conv.messages.push({ role: 'user', content: userMessage });
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: `Du är Lisa, receptionist på Elexperten Stockholm. 
Svara kort och koncist på svenska. 
Hjälp kunden boka elektriker.
Om kunden vill avsluta, säg "Tack för samtalet. Hej då."`,
    messages: conv.messages
  });
  
  const assistantMessage = response.content[0].text;
  conv.messages.push({ role: 'assistant', content: assistantMessage });
  conversations.set(callid, conv);
  
  return assistantMessage;
}

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Handymate Voice Agent running on port ${PORT}`);
});
