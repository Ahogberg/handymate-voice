const sdk = require('microsoft-cognitiveservices-speech-sdk');

/**
 * Convert text to speech using Azure TTS
 * @param {string} text - Text to speak
 * @param {string} voice - Voice name (default: Swedish Sofie)
 * @returns {Promise<string>} - Base64 encoded audio
 */
async function speak(text, voice = 'sv-SE-SofieNeural') {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );
    
    // Configure voice
    speechConfig.speechSynthesisVoiceName = voice;
    speechConfig.speechSynthesisOutputFormat = 
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    
    // Use pull audio output stream to get audio data
    const synthesizer = sdk.SpeechSynthesizer.FromConfig(speechConfig, null);
    
    // Use SSML for better control over speech
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="sv-SE">
        <voice name="${voice}">
          <prosody rate="0%">${escapeXml(text)}</prosody>
        </voice>
      </speak>
    `;
    
    synthesizer.speakSsmlAsync(
      ssml,
      result => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          // Convert audio data to base64
          const audioData = result.audioData;
          const base64Audio = Buffer.from(audioData).toString('base64');
          resolve(base64Audio);
        } else {
          console.error('TTS Error:', result.errorDetails);
          reject(new Error(result.errorDetails));
        }
        synthesizer.close();
      },
      error => {
        console.error('TTS Error:', error);
        synthesizer.close();
        reject(error);
      }
    );
  });
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get available Swedish voices
 */
function getSwedishVoices() {
  return [
    { id: 'sv-SE-SofieNeural', name: 'Sofie', gender: 'Female', style: 'Friendly' },
    { id: 'sv-SE-HilleviNeural', name: 'Hillevi', gender: 'Female', style: 'Professional' },
    { id: 'sv-SE-MattiasNeural', name: 'Mattias', gender: 'Male', style: 'Neutral' }
  ];
}

module.exports = {
  speak,
  getSwedishVoices
};
