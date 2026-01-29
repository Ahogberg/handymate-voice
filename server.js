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

// Pre-load Anthropic
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
console.log('✅ Anthropic SDK ready');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const conversations = new Map();

// Cache för vanliga TTS-fraser
const ttsCache = new Map();

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

// Generate TTS audio with SSML
app.get('/tts', async (req, res) => {
  const text = decodeURIComponent(req.query.text || 'Hej');
  console.log('🔊 TTS:', text);
  
  // Kolla cache
  if (ttsCache.has(text)) {
    console.log('📦 TTS from cache');
    res.set('Content-Type', 'audio/wav');
    res.send(ttsCache.get(text));
    return;
  }
  
  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
    
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="sv-SE">
        <voice name="sv-SE-SofieNeural">
          <mstts:express-as style="friendly">
            <prosody rate="-5%" pitch="+2%">
              ${text}
            </prosody>
          </mstts:express-as>
        </voice>
      </speak>
    `;
    
    synthesizer.speakSsmlAsync(
      ssml,
      result => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const audioBuffer = Buffer.from(result.audioData);
          // Cacha resultatet
          ttsCache.set(text, audioBuffer);
          res.set('Content-Type', 'audio/wav');
          res.send(audioBuffer);
        } else {
          console.error('❌ TTS failed:', result.errorDetails);
          res.status(500).send('TTS failed');
        }
        synthesizer.close();
      },
      error => {
        console.error('❌ TTS error:', error);
        synthesizer.close();
        res.status(500).send('TTS failed');
      }
    );
  } catch (error) {
    console.error('❌ TTS error:', error);
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

// Listen and respond - allt i ett
app.post('/listen', async (req, res) => {
  const { callid } = req.query;
  const { wav } = req.body;
  
  console.log('👂 Listen called, wav:', wav ? 'yes' : 'no');
  
  if (wav) {
    console.log('🎤 Got recording:', wav);
    
    try {
      // Starta alla requests parallellt för snabbhet
      const startTime = Date.now();
      
      // 1. Transkribera
      console.log('🔄 Transcribing...');
      const transcription = await transcribeAudio(wav);
      console.log('📝 User said:', transcription, `(${Date.now() - startTime}ms)`);
      
      // 2. Hämta Claude-svar
      console.log('🤖 Asking Claude...');
      const response = await getChatResponse(callid, transcription);
      console.log('💬 Lisa says:', response, `(${Date.now() - startTime}ms)`);
      
      // 3. Skicka svar
      const isGoodbye = response.toLowerCase().includes('hej då');
      const reply = {
        play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent(response)}`,
        next: isGoodbye 
          ? `${process.env.BASE_URL}/hangup`
          : `${process.env.BASE_URL}/listen?callid=${callid}`
      };
      
      console.log('📤 Sending reply:', JSON.stringify(reply), `(${Date.now() - startTime}ms total)`);
      res.json(reply);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      res.json({
        play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent('Ursäkta, kan du upprepa?')}`,
        next: `${process.env.BASE_URL}/listen?callid=${callid}`
      });
    }
  } else {
    // Starta inspelning
    console.log('🎙️ Starting recording...');
    res.json({
      record: `${process.env.BASE_URL}/listen?callid=${callid}`,
      timeout: 10,
      silence: 2
    });
  }
});

app.post('/hangup', (req, res) => {
  console.log('📞 Call ended');
  res.json({ hangup: true });
});

// Transcribe audio with Whisper
async function transcribeAudio(audioUrl) {
  const audioResponse = await axios.get(audioUrl, { 
    responseType: 'arraybuffer',
    timeout: 8000,
    auth: {
      username: process.env.ELKS_API_USERNAME,
      password: process.env.ELKS_API_PASSWORD
    }
  });
  
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
      timeout: 10000,
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
  const conv = conversations.get(callid) || { messages: [] };
  conv.messages.push({ role: 'user', content: userMessage });
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    system: `Du är Lisa, receptionist på Elexperten Stockholm. 

REGLER:
- Svara KORT (max 2 meningar)
- Prata svenska
- Hjälp kunden boka elektriker
- Fråga vad problemet är
- Fråga om namn om du inte vet det
- Fråga om adress
- Föreslå en tid (t.ex. "imorgon klockan 10")
- När allt är klart, säg "Tack för samtalet. Hej då."

Var vänlig och professionell.`,
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
