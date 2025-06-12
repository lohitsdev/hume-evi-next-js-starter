"use client";

import { humeApiClient } from './humeApiClient';

// Cache for storing summaries - shared with HumeChatViewer
const CACHE_KEY = 'hume_chat_summaries';
const CONTEXT_CHAT_ID_KEY = 'hume_context_chat_id';
const ALL_CONVERSATIONS_CONTEXT_KEY = 'all_conversations';

// Load cached summary for a specific chat
export const getCachedSummary = (chatId: string): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed[chatId] || null;
    }
  } catch (error) {
    console.error('Error loading cached summary:', error);
  }
  return null;
};

// Get all cached summaries
export const getAllCachedSummaries = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading all cached summaries:', error);
  }
  return {};
};

// Generate summary for a chat if not cached
export const getOrGenerateSummary = async (chatId: string): Promise<string | null> => {
  // Check cache first
  const cached = getCachedSummary(chatId);
  if (cached) {
    console.log('✅ Using cached summary for context:', chatId);
    return cached;
  }

  // Generate new summary
  try {
    console.log('🔄 Generating new summary for context:', chatId);
    const events = await humeApiClient.getAllChatEvents(chatId);
    const userMessages = events
      .filter(event => event.type === 'USER_MESSAGE')
      .map(event => event.message_text)
      .filter(text => text && text.trim() !== '');

    if (userMessages.length === 0) {
      console.log('❌ No user messages found for context generation');
      return null;
    }

    const response = await fetch('/api/generate-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userMessages }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate summary');
    }

    const data = await response.json();
    const summary = data.summary;

    // Cache the summary
    const stored = localStorage.getItem(CACHE_KEY);
    const cache = stored ? JSON.parse(stored) : {};
    cache[chatId] = summary;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));

    console.log('✅ Generated and cached summary for context:', chatId);
    return summary;
  } catch (error) {
    console.error('❌ Error generating summary for context:', error);
    return null;
  }
};

// Generate comprehensive context from all conversations
export const generateAllConversationsContext = async (): Promise<string | null> => {
  try {
    console.log('🔄 Generating comprehensive context from all conversations...');
    
    // Get all cached summaries
    const allSummaries = getAllCachedSummaries();
    const summaryTexts = Object.values(allSummaries).filter(Boolean);
    
    if (summaryTexts.length === 0) {
      console.log('❌ No cached summaries found for comprehensive context');
      return null;
    }

    if (summaryTexts.length === 1) {
      console.log('✅ Using single summary as comprehensive context');
      return summaryTexts[0];
    }

    // Combine all summaries into one comprehensive context
    const combinedText = summaryTexts.join(' ');
    
    // Use AI to create a meta-summary of all conversations
    console.log('🤖 Creating meta-summary from', summaryTexts.length, 'conversation summaries...');
    
    const response = await fetch('/api/generate-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        userMessages: [
          `Create a comprehensive user profile summary based on these conversation summaries: ${combinedText}. Focus on the user's main interests, goals, preferences, and recurring themes across all conversations.`
        ]
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate comprehensive context');
    }

    const data = await response.json();
    const comprehensiveContext = data.summary;

    console.log('✅ Generated comprehensive context from', summaryTexts.length, 'conversations');
    return comprehensiveContext;
    
  } catch (error) {
    console.error('❌ Error generating comprehensive context:', error);
    // Fallback: just combine the summaries with simple concatenation
    const allSummaries = getAllCachedSummaries();
    const summaryTexts = Object.values(allSummaries).filter(Boolean);
    
    if (summaryTexts.length > 0) {
      console.log('⚠️ Falling back to simple summary combination');
      return `User profile based on ${summaryTexts.length} conversations: ${summaryTexts.join('. ')}`;
    }
    
    return null;
  }
};

// Get/Set the current context chat ID
export const getContextChatId = (): string => {
  if (typeof window === 'undefined') return DEMO_CHAT_ID;
  
  try {
    const stored = localStorage.getItem(CONTEXT_CHAT_ID_KEY);
    return stored || DEMO_CHAT_ID;
  } catch (error) {
    console.error('Error loading context chat ID:', error);
    return DEMO_CHAT_ID;
  }
};

export const setContextChatId = (chatId: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CONTEXT_CHAT_ID_KEY, chatId);
    console.log('📝 Context chat ID set to:', chatId);
  } catch (error) {
    console.error('Error saving context chat ID:', error);
  }
};

// Check if using all conversations as context
export const isUsingAllConversationsContext = (): boolean => {
  return getContextChatId() === ALL_CONVERSATIONS_CONTEXT_KEY;
};

// Set to use all conversations as context
export const setAllConversationsContext = (): void => {
  setContextChatId(ALL_CONVERSATIONS_CONTEXT_KEY);
};

// Create session settings message for Hume
export const createSessionSettings = (contextText: string) => {
  return {
    context: {
      text: contextText,
      type: "persistent" as const
    }
  };
};

// Predefined chat ID for demo (you can make this configurable)
export const DEMO_CHAT_ID = "03ffdafc-02e4-4926-b905-59dc834d8c79";

// Special constant for all conversations context
export { ALL_CONVERSATIONS_CONTEXT_KEY };

// Get context for the current context chat
export const getCurrentContext = async (): Promise<string | null> => {
  const contextChatId = getContextChatId();
  
  // Check if using all conversations
  if (contextChatId === ALL_CONVERSATIONS_CONTEXT_KEY) {
    return generateAllConversationsContext();
  }
  
  // Use single chat context
  return getOrGenerateSummary(contextChatId);
};

// Get context for the demo chat (backwards compatibility)
export const getDemoContext = async (): Promise<string | null> => {
  return getCurrentContext();
}; 