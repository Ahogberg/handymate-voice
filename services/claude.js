const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Send a message to Claude and get a response
 * @param {string} systemPrompt - System instructions
 * @param {Array} messages - Conversation history
 * @returns {Promise<Object>} - Claude's response
 */
async function chat(systemPrompt, messages) {
  try {
    // Convert messages to Anthropic format
    const formattedMessages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }
      return msg;
    });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: formattedMessages
    });
    
    return {
      content: response.content,
      stopReason: response.stop_reason
    };
  } catch (error) {
    console.error('Claude chat error:', error);
    throw error;
  }
}

/**
 * Send a message to Claude with tool definitions
 * @param {string} systemPrompt - System instructions
 * @param {Array} messages - Conversation history
 * @param {Array} tools - Tool definitions
 * @param {Object} context - Additional context (phone number, etc)
 * @returns {Promise<Object>} - Claude's response with potential tool calls
 */
async function chatWithTools(systemPrompt, messages, tools, context = {}) {
  try {
    // Add context to system prompt
    const enhancedSystemPrompt = `${systemPrompt}

KONTEXT:
- Kundens telefonnummer: ${context.fromNumber || 'okänt'}
- Kund-ID (om känt): ${context.customerId || 'ej uppslagen ännu'}`;

    // Convert messages to Anthropic format
    const formattedMessages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }
      return msg;
    });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: enhancedSystemPrompt,
      messages: formattedMessages,
      tools: tools
    });
    
    return {
      content: response.content,
      stopReason: response.stop_reason
    };
  } catch (error) {
    console.error('Claude chat with tools error:', error);
    throw error;
  }
}

module.exports = {
  chat,
  chatWithTools
};
