const axios = require('axios');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://handymate.app.n8n.cloud/webhook/vapi-tools';

/**
 * Call a tool via n8n webhook
 * @param {string} toolName - Name of the tool to call
 * @param {Object} args - Arguments for the tool
 * @param {string} callId - Call ID for tracking
 * @returns {Promise<Object>} - Tool result
 */
async function callTool(toolName, args, callId) {
  try {
    console.log(`🔧 Calling n8n tool: ${toolName}`, args);
    
    // Format request for our n8n Tool Router (Retell format)
    const payload = {
      name: toolName,
      args: args,
      call: {
        call_id: callId
      }
    };
    
    const response = await axios.post(N8N_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log(`🔧 Tool response:`, response.data);
    
    // Handle different response formats
    if (response.data.result) {
      return response.data.result;
    }
    if (response.data.results?.[0]?.result) {
      // Vapi format response
      const result = response.data.results[0].result;
      return typeof result === 'string' ? JSON.parse(result) : result;
    }
    
    return response.data;
  } catch (error) {
    console.error(`🔧 Tool error (${toolName}):`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Lookup customer by phone number
 */
async function lookupCustomer(phoneNumber, callId) {
  return callTool('LOOKUP_CUSTOMER_BY_PHONE', { phone_number: phoneNumber }, callId);
}

/**
 * Create a new customer
 */
async function createCustomer(name, phoneNumber, address, city, callId) {
  return callTool('CREATE_CUSTOMER', {
    name,
    phone_number: phoneNumber,
    address_line: address,
    city
  }, callId);
}

/**
 * Check available time slots
 */
async function checkAvailability(preference, callId) {
  return callTool('CHECK_AVAILABILITY', { preference }, callId);
}

/**
 * Confirm a booking
 */
async function confirmBooking(customerId, slotId, callId) {
  return callTool('CONFIRM_BOOKING', {
    customer_id: customerId,
    slot_id: slotId
  }, callId);
}

module.exports = {
  callTool,
  lookupCustomer,
  createCustomer,
  checkAvailability,
  confirmBooking
};
