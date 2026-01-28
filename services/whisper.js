const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Transcribe audio buffer to text using Whisper
 * @param {Buffer} audioBuffer - Audio data in WAV/MP3 format
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer) {
  try {
    // Save buffer temporarily (Whisper API needs a file)
    const tempFile = path.join('/tmp', `audio_${Date.now()}.wav`);
    fs.writeFileSync(tempFile, audioBuffer);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFile),
      model: 'whisper-1',
      language: 'sv', // Swedish
      response_format: 'text'
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    return transcription.trim();
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
}

/**
 * Transcribe audio from base64 string
 * @param {string} base64Audio - Base64 encoded audio
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeBase64(base64Audio) {
  const buffer = Buffer.from(base64Audio, 'base64');
  return transcribeAudio(buffer);
}

module.exports = {
  transcribeAudio,
  transcribeBase64
};
