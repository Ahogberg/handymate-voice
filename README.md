# Handymate Voice Agent

Custom AI-powered voice agent for Swedish electrician booking service.

## Architecture

```
Incoming Call (46elks)
        ↓
    Node.js Server
        ↓
    Whisper (STT) → Claude (AI) → Azure TTS
        ↓
    n8n Tools (Supabase, Calendar, SMS)
        ↓
    Response to Caller
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
- `OPENAI_API_KEY` - For Whisper transcription
- `ANTHROPIC_API_KEY` - For Claude conversation
- `AZURE_SPEECH_KEY` - For Swedish TTS
- `AZURE_SPEECH_REGION` - Azure region (e.g., `northeurope`)
- `ELKS_API_USERNAME` - 46elks API username
- `ELKS_API_PASSWORD` - 46elks API password
- `ELKS_PHONE_NUMBER` - Your 46elks phone number
- `N8N_WEBHOOK_URL` - Your n8n tools webhook
- `BASE_URL` - Your deployed server URL

### 2. Deploy to Railway

1. Push this code to a GitHub repository
2. Connect the repo to Railway
3. Add environment variables in Railway dashboard
4. Deploy!

### 3. Configure 46elks

After deploying, configure your 46elks number to point to the webhook:

```bash
curl -X POST https://api.46elks.com/a1/numbers/+46766867337 \
  -u "USERNAME:PASSWORD" \
  -d "voice_start=https://your-app.railway.app/incoming-call"
```

## Local Development

```bash
npm install
npm run dev
```

Use ngrok to expose local server for testing:

```bash
ngrok http 3000
```

## API Endpoints

- `GET /` - Health check
- `POST /incoming-call` - 46elks incoming call webhook
- `POST /voice-stream` - Voice IVR handler
- `POST /call-status` - Call status updates

## Files

- `server.js` - Express server and WebSocket setup
- `call-handler.js` - Main conversation logic
- `services/whisper.js` - OpenAI Whisper STT
- `services/claude.js` - Anthropic Claude AI
- `services/azure-tts.js` - Azure Text-to-Speech
- `services/n8n-tools.js` - n8n webhook integration
- `services/elks.js` - 46elks telephony

## Swedish Voice

Using Azure TTS `sv-SE-SofieNeural` for natural Swedish speech.

Alternative voices:
- `sv-SE-HilleviNeural` - More formal
- `sv-SE-MattiasNeural` - Male voice
