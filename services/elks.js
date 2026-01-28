const axios = require('axios');

const ELKS_API_URL = 'https://api.46elks.com/a1';
const auth = Buffer.from(
  `${process.env.ELKS_API_USERNAME}:${process.env.ELKS_API_PASSWORD}`
).toString('base64');

/**
 * Configure phone number to point to our webhook
 * Run this once to set up the phone number
 */
async function configurePhoneNumber() {
  try {
    const phoneNumber = process.env.ELKS_PHONE_NUMBER;
    const baseUrl = process.env.BASE_URL;
    
    const response = await axios.post(
      `${ELKS_API_URL}/numbers/${phoneNumber}`,
      new URLSearchParams({
        voice_start: `${baseUrl}/incoming-call`
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('📞 Phone number configured:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to configure phone number:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Make an outbound call
 */
async function makeCall(to, webhookUrl) {
  try {
    const response = await axios.post(
      `${ELKS_API_URL}/calls`,
      new URLSearchParams({
        from: process.env.ELKS_PHONE_NUMBER,
        to: to,
        voice_start: webhookUrl
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('📞 Outbound call initiated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to make call:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Hang up a call
 */
async function hangupCall(callId) {
  try {
    const response = await axios.post(
      `${ELKS_API_URL}/calls/${callId}`,
      new URLSearchParams({
        action: 'hangup'
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to hang up call:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Play audio in a call (using 46elks IVR)
 */
function createPlayResponse(audioUrl, nextWebhook) {
  return {
    play: audioUrl,
    next: nextWebhook
  };
}

/**
 * Record user input and send to webhook
 */
function createRecordResponse(webhookUrl, maxDuration = 30) {
  return {
    record: webhookUrl,
    timeout: 3,
    max_duration: maxDuration
  };
}

/**
 * Connect call to another number
 */
function createConnectResponse(phoneNumber) {
  return {
    connect: phoneNumber
  };
}

module.exports = {
  configurePhoneNumber,
  makeCall,
  hangupCall,
  createPlayResponse,
  createRecordResponse,
  createConnectResponse
};
