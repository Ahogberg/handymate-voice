require('dotenv').config();
const express = require('express');
const http = require('http');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const axios = require('axios');
const FormData = require('form-data');
const OpenAI = require('openai');

console.log('🔧 Loading SDKs...');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log('✅ Ready');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const conversations = new Map();
const ttsCache = new Map();

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Handymate Voice Agent' });
});

app.get('/tts', async (req, res) => {
  const text = decodeURIComponent(req.query.text || 'Hej');
  console.log('🔊 TTS:', text);
  
  if (ttsCache.has(text)) {
    res.set('Content-Type', 'audio/wav');
    return res.send(ttsCache.get(text));
  }
  
  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="sv-SE">
      <voice name="sv-SE-SofieNeural"><prosody rate="-5%">${text}</prosody></voice>
    </speak>`;
    
    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const buf = Buffer.from(result.audioData);
        ttsCache.set(text, buf);
        res.set('Content-Type', 'audio/wav');
        res.send(buf);
      } else {
        res.status(500).send('TTS failed');
      }
      synthesizer.close();
    }, err => {
      synthesizer.close();
      res.status(500).send('TTS failed');
    });
  } catch (e) {
    res.status(500).send('TTS failed');
  }
});

app.post('/incoming-call', (req, res) => {
  console.log('📞 Call:', req.body.callid);
  const { callid, from } = req.body;
  conversations.set(callid, { from, messages: [] });
  
  res.json({
    play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent('Elexperten, Lisa. Vad gäller det?')}`,
    next: `${process.env.BASE_URL}/listen?callid=${callid}`
  });
});

app.post('/listen', async (req, res) => {
  const { callid } = req.query;
  const { wav } = req.body;
  
  if (!wav) {
    return res.json({
      record: `${process.env.BASE_URL}/listen?callid=${callid}`,
      timeout: 8,
      silence: 2
    });
  }
  
  const start = Date.now();
  
  try {
    // Transkribera
    const audio = await axios.get(wav, { 
      responseType: 'arraybuffer', 
      timeout: 4000,
      auth: { username: process.env.ELKS_API_USERNAME, password: process.env.ELKS_API_PASSWORD }
    });
    
    const form = new FormData();
    form.append('file', Buffer.from(audio.data), { filename: 'a.wav', contentType: 'audio/wav' });
    form.append('model', 'whisper-1');
    form.append('language', 'sv');
    
    const transcript = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      timeout: 4000,
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }
    });
    
    const userText = transcript.data.text;
    console.log(`📝 "${userText}" (${Date.now()-start}ms)`);
    
    // GPT svar
    const conv = conversations.get(callid) || { messages: [] };
    conv.messages.push({ role: 'user', content: userText });
    
    const gpt = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 60,
      messages: [
        { role: 'system', content: 'Du är Lisa på Elexperten. Svara med MAX 10 ord. Hjälp boka elektriker. Fråga vad problemet är, namn, adress. Avsluta med "Hej då!"' },
        ...conv.messages
      ]
    });
    
    const reply = gpt.choices[0].message.content;
    conv.messages.push({ role: 'assistant', content: reply });
    conversations.set(callid, conv);
    
    console.log(`💬 "${reply}" (${Date.now()-start}ms)`);
    
    res.json({
      play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent(reply)}`,
      next: reply.toLowerCase().includes('hej då') 
        ? `${process.env.BASE_URL}/hangup`
        : `${process.env.BASE_URL}/listen?callid=${callid}`
    });
    
  } catch (e) {
    console.error('❌', e.message);
    res.json({
      play: `${process.env.BASE_URL}/tts?text=${encodeURIComponent('Förlåt, säg igen?')}`,
      next: `${process.env.BASE_URL}/listen?callid=${callid}`
    });
  }
});

app.post('/hangup', (req, res) => {
  console.log('📞 Hangup');
  res.json({ hangup: true });
});
{
  "connect": "sip:+46766867337@sip.retellai.com"
}
http.createServer(app).listen(process.env.PORT || 3000, () => {
  console.log('🚀 Running');
});
