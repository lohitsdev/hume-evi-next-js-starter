# Conversation Storage with Pinecone

This application now includes automatic conversation storage using Pinecone vector database. All conversations are automatically saved with emotional analysis data and can be searched semantically.

## Features

✅ **Automatic Saving**: Conversations are automatically saved every 2 minutes during a call and when the call ends
✅ **Smart Titles**: Conversation titles are automatically generated from the first user message
✅ **AI Summaries**: Each conversation gets an AI-generated summary using OpenAI
✅ **Emotional Data**: Prosody scores (emotions) are stored with each message
✅ **Semantic Search**: Search through conversations using natural language
✅ **Vector Embeddings**: Conversations are stored as embeddings for intelligent retrieval
✅ **User Organization**: All conversations are organized by user ID (currently "fake-user")

## Environment Variables Required

Add these to your `.env.local` file:

```env
# Existing Hume variables
HUME_API_KEY=your_hume_api_key_here
HUME_SECRET_KEY=your_hume_secret_key_here
NEXT_PUBLIC_HUME_CONFIG_ID=your_hume_config_id_here

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=hume-conversations

# OpenAI Configuration (for embeddings and summaries)
OPENAI_API_KEY=your_openai_api_key_here
```

## Pinecone Setup

1. **Create a Pinecone Account**: Go to [Pinecone](https://www.pinecone.io/) and create an account
2. **Create an Index**: 
   - Name: `hume-conversations` (or whatever you set in `PINECONE_INDEX_NAME`)
   - Dimensions: `1536` (for OpenAI text-embedding-3-small)
   - Metric: `cosine`
   - Cloud: Choose your preferred region
3. **Get API Key**: Copy your Pinecone API key from the dashboard

## How It Works

### Data Structure

Each conversation is stored with:
- **Conversation ID**: Unique identifier (`conv_fake-user_timestamp_random`)
- **User ID**: Currently set to "fake-user" 
- **Title**: Auto-generated from first user message
- **Messages**: Array of all user and assistant messages
- **Emotions**: Prosody scores for emotional analysis
- **Summary**: AI-generated conversation summary
- **Timestamps**: Start and end times
- **Metadata**: Message count, duration, etc.

### Saving Process

1. **Connection Start**: New conversation ID generated when call starts
2. **Auto-Save**: Every 2 minutes during conversation (configurable)
3. **Manual Save**: Can be triggered manually if needed
4. **End Save**: Automatic save when call disconnects
5. **Embedding Generation**: OpenAI creates vector embeddings for search
6. **Pinecone Storage**: Data stored with metadata for retrieval

### Search & Retrieval

- **Semantic Search**: Find conversations by meaning, not just keywords
- **User Filtering**: Only shows conversations for the current user
- **Metadata Search**: Filter by date, duration, message count
- **Similarity Scoring**: Results ranked by relevance

## UI Components

### Save Indicators
- **Blue indicator**: "Saving conversation..." (while saving)
- **Yellow indicator**: Shows count of unsaved messages

### History Modal
- **Access**: Click "History" button in top navigation
- **Search**: Semantic search through all conversations
- **Filters**: View by user, date, relevance
- **Metadata**: See message count, duration, timestamps

## API Endpoints

### POST `/api/conversations`
Save a new conversation:
```json
{
  "conversation": {
    "id": "conv_fake-user_1234567890_abc123",
    "userId": "fake-user",
    "title": "Discussion about weather...",
    "messages": [...],
    "startTime": "2024-01-15T10:30:00Z",
    "endTime": "2024-01-15T10:45:00Z"
  }
}
```

### GET `/api/conversations?userId=fake-user&query=optional&limit=20`
Retrieve conversations:
```json
{
  "conversations": [
    {
      "id": "conv_id",
      "score": 0.95,
      "metadata": {
        "userId": "fake-user",
        "title": "Weather Discussion",
        "summary": "Brief conversation about...",
        "messageCount": 12,
        "startTime": "2024-01-15T10:30:00Z"
      }
    }
  ],
  "count": 1
}
```

## Customization Options

### Change User ID
In `components/Chat.tsx`, modify the `ConversationManager`:
```tsx
<ConversationManager />
// becomes
<ConversationManager userId="your-actual-user-id" />
```

### Adjust Auto-Save Interval
In `utils/useConversation.ts`:
```tsx
const conversation = useConversation({
  userId: 'fake-user',
  autoSave: true,
  saveInterval: 5, // minutes - change this value
});
```

### Disable Auto-Save
```tsx
const conversation = useConversation({
  autoSave: false, // Disable automatic saving
});
```

## Troubleshooting

### Common Issues

1. **"Pinecone client not initialized"**
   - Check your `PINECONE_API_KEY` environment variable
   - Ensure your Pinecone index exists and is active

2. **"OpenAI client not initialized"**
   - Check your `OPENAI_API_KEY` environment variable
   - Verify your OpenAI account has API access

3. **Conversations not saving**
   - Check browser console for error messages
   - Verify all environment variables are set
   - Ensure Pinecone index dimensions match (1536)

4. **Search not working**
   - Verify conversations are being saved first
   - Check OpenAI API quota and billing
   - Ensure search queries are meaningful

### Debug Mode

Add console logging to see what's happening:
```tsx
const conversation = useConversation({
  userId: 'fake-user',
  autoSave: true,
  saveInterval: 2,
});

console.log('Conversation state:', {
  id: conversation.conversationId,
  saving: conversation.isSaving,
  messageCount: conversation.messagesCount,
  unsaved: conversation.hasUnsavedChanges
});
```

## Future Enhancements

- **User Authentication**: Replace "fake-user" with real user accounts
- **Conversation Analytics**: Emotional trends, conversation insights
- **Export Features**: Download conversations as PDF/JSON
- **Real-time Collaboration**: Share conversations between users
- **Advanced Filtering**: Filter by emotions, duration, topics
- **Conversation Templates**: Save and reuse conversation starters 