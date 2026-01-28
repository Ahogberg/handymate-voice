const { transcribeAudio } = require('./services/whisper');
const { chat, chatWithTools } = require('./services/claude');
const { speak } = require('./services/azure-tts');
const { callTool } = require('./services/n8n-tools');

// Store active conversations
const conversations = new Map();

// System prompt for Lisa
const SYSTEM_PROMPT = `Du är Lisa, receptionist på Elexperten Stockholm. Du pratar endast svenska.

STARTA ALLTID MED: "Elexperten, Lisa. Hur kan jag hjälpa dig?"

FLÖDE:
1. Lyssna på kundens problem
2. När du vet problemet: "Okej, [sammanfatta kort]. Då bokar vi in en elektriker."
3. Använd LOOKUP_CUSTOMER_BY_PHONE för att kolla om kunden finns (du har telefonnumret)
4. Om kunden finns: "Är det [namn]?" - bekräfta
5. Om ny kund: Fråga namn, sedan adress. Använd CREATE_CUSTOMER.
6. Använd CHECK_AVAILABILITY för lediga tider
7. Föreslå EN tid: "Vi har [dag] klockan [tid]. Passar det?"
8. Om ja: Använd CONFIRM_BOOKING. "Perfekt, du får ett SMS."
9. "Tack för samtalet. Hej då."

REGLER:
- Fråga ALDRIG efter telefonnummer - du har det redan
- Vänta på svar innan du fortsätter
- Var vänlig men kortfattad
- Säg datum på svenska: "tisdag den tredje februari"
- När du kör ett verktyg, säg INGET - vänta på resultatet först`;

// Tool definitions for Claude
const TOOLS = [
  {
    name: "LOOKUP_CUSTOMER_BY_PHONE",
    description: "Slå upp kund baserat på telefonnummer",
    input_schema: {
      type: "object",
      properties: {
        phone_number: { type: "string", description: "Kundens telefonnummer" }
      },
      required: ["phone_number"]
    }
  },
  {
    name: "CREATE_CUSTOMER",
    description: "Skapa ny kund",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Kundens namn" },
        phone_number: { type: "string", description: "Telefonnummer" },
        address_line: { type: "string", description: "Gatuadress" },
        city: { type: "string", description: "Stad" }
      },
      required: ["name", "phone_number"]
    }
  },
  {
    name: "CHECK_AVAILABILITY",
    description: "Kolla lediga tider för bokning",
    input_schema: {
      type: "object",
      properties: {
        preference: { type: "string", description: "Önskemål om tid" }
      },
      required: []
    }
  },
  {
    name: "CONFIRM_BOOKING",
    description: "Bekräfta och slutför bokning",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Kund-ID" },
        slot_id: { type: "string", description: "Tid-slot ID" }
      },
      required: ["customer_id", "slot_id"]
    }
  }
];

/**
 * Initialize a new call
 */
async function handleIncomingCall(callId, fromNumber) {
  console.log(`📞 Starting conversation for call ${callId} from ${fromNumber}`);
  
  // Initialize conversation state
  conversations.set(callId, {
    callId,
    fromNumber,
    messages: [],
    customerId: null,
    customerName: null,
    createdAt: new Date()
  });
  
  // Generate initial greeting
  const greeting = "Elexperten, Lisa. Hur kan jag hjälpa dig?";
  
  // Convert to speech
  const audioBase64 = await speak(greeting);
  
  // Add to conversation history
  const conv = conversations.get(callId);
  conv.messages.push({ role: 'assistant', content: greeting });
  
  return {
    play: {
      audio: audioBase64,
      format: 'wav'
    },
    next: `${process.env.BASE_URL}/continue-call?callid=${callId}`
  };
}

/**
 * Process user input and generate response
 */
async function processUserInput(callId, audioBuffer) {
  const conv = conversations.get(callId);
  if (!conv) {
    throw new Error(`No conversation found for call ${callId}`);
  }
  
  // 1. Transcribe audio to text using Whisper
  console.log('🎤 Transcribing audio...');
  const userText = await transcribeAudio(audioBuffer);
  console.log(`👤 User said: "${userText}"`);
  
  // Add to conversation history
  conv.messages.push({ role: 'user', content: userText });
  
  // 2. Get Claude's response (with tool use)
  console.log('🤖 Getting Claude response...');
  const response = await chatWithTools(
    SYSTEM_PROMPT,
    conv.messages,
    TOOLS,
    { fromNumber: conv.fromNumber, customerId: conv.customerId }
  );
  
  // 3. Handle tool calls if any
  let assistantText = '';
  
  if (response.stopReason === 'tool_use') {
    // Process tool calls
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`🔧 Calling tool: ${block.name}`, block.input);
        
        // Add phone number if needed
        if (block.name === 'LOOKUP_CUSTOMER_BY_PHONE' && !block.input.phone_number) {
          block.input.phone_number = conv.fromNumber;
        }
        
        // Call the tool via n8n
        const toolResult = await callTool(block.name, block.input, callId);
        console.log(`🔧 Tool result:`, toolResult);
        
        // Store customer ID if we got one
        if (toolResult.customer_id) {
          conv.customerId = toolResult.customer_id;
        }
        if (toolResult.customer?.customer_id) {
          conv.customerId = toolResult.customer.customer_id;
          conv.customerName = toolResult.customer.name;
        }
        
        // Add tool result to messages
        conv.messages.push({
          role: 'assistant',
          content: response.content
        });
        conv.messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(toolResult)
          }]
        });
        
        // Get Claude's follow-up response
        const followUp = await chat(SYSTEM_PROMPT, conv.messages);
        assistantText = followUp.content[0].text;
      }
    }
  } else {
    // Regular text response
    assistantText = response.content[0].text;
  }
  
  // Add assistant response to history
  conv.messages.push({ role: 'assistant', content: assistantText });
  
  console.log(`🤖 Lisa says: "${assistantText}"`);
  
  // 4. Convert to speech using Azure TTS
  const audioBase64 = await speak(assistantText);
  
  return {
    text: assistantText,
    audio: audioBase64
  };
}

/**
 * End a call and clean up
 */
function endCall(callId) {
  console.log(`📞 Ending call ${callId}`);
  conversations.delete(callId);
}

/**
 * Get conversation state
 */
function getConversation(callId) {
  return conversations.get(callId);
}

module.exports = {
  handleIncomingCall,
  processUserInput,
  endCall,
  getConversation
};
