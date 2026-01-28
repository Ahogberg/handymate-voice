const fs = require('fs');
const path = require('path');

let openai = null;

function getClient() {
  if (!openai) {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

async function transcribeAudio(audioBuffer) {
  try {
    const tempFile = path.join('/tmp', `audio_${Date.now()}.wav`);
    fs.writeFileSync(tempFile, audioBuffer);
    
    const transcription = await getClient().audio.transcriptions.create({
      file: fs.createReadStream(tempFile),
      model: 'whisper-1',
      language: 'sv',
      response_format: 'text'
    });
    
    fs.unlinkSync(tempFile);
    return transcription.trim();
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
}

async function transcribeBase64(base64Audio) {
  const buffer = Buffer.from(base64Audio, 'base64');
  return transcribeAudio(buffer);
}

module.exports = {
  transcribeAudio,
  transcribeBase64
};
