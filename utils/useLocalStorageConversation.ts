"use client";

import { useEffect, useState, useCallback } from 'react';
import { useVoice } from "@humeai/voice-react";
import { ConversationStorage, Conversation, ConversationMessage } from './localStorage';

interface UseLocalStorageConversationOptions {
  userId: string;
  autoSave?: boolean;
  saveInterval?: number; // minutes
  syncToHume?: boolean; // New option to sync to Hume servers
  humeChatId?: string | null; // Hume chat ID to associate with this conversation
  humeChatGroupId?: string | null; // Hume chat group ID
}

export function useLocalStorageConversation({
  userId,
  autoSave = true,
  saveInterval = 2,
  syncToHume = false,
  humeChatId = null,
  humeChatGroupId = null
}: UseLocalStorageConversationOptions) {
  const { messages, status, connect, disconnect } = useVoice();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedMessageCount, setLastSavedMessageCount] = useState(0);
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);

  // Generate conversation ID when connecting
  useEffect(() => {
    if (status.value === 'connected' && !conversationId) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      // Use Hume chat ID if available, otherwise generate our own
      const newId = humeChatId || `conv_${userId}_${timestamp}_${random}`;
      const currentTime = new Date().toISOString();
      setConversationId(newId);
      setStartTime(currentTime);
      console.log('New conversation started:', newId, humeChatId ? '(Using Hume chat ID)' : '(Generated ID)');
    }
  }, [status.value, conversationId, userId, humeChatId]);

  // Reset conversation when disconnected
  useEffect(() => {
    if (status.value === 'disconnected') {
      // Don't reset immediately - let the save happen first
      setTimeout(() => {
        setConversationId(null);
        setStartTime(null);
        setLastSavedMessageCount(0);
      }, 2000); // Increased delay to 2 seconds
    }
  }, [status.value]);

  // Convert Hume messages to our format
  const convertMessages = useCallback((): ConversationMessage[] => {
    return messages.map((msg, index) => {
      // Type guard for message content
      const content = (msg as any).message?.content || '';
      const emotions = (msg as any).models?.prosody?.scores || undefined;
      
      // Ensure proper type mapping
      let messageType: 'user' | 'assistant' = 'assistant';
      if (msg.type === 'user_message') {
        messageType = 'user';
      }
      
      return {
        id: `msg_${index}_${Date.now()}`,
        type: messageType,
        content: content,
        timestamp: new Date().toISOString(),
        emotions: emotions
      };
    });
  }, [messages]);

  // Save conversation to localStorage with Hume sync info
  const saveConversation = useCallback(async () => {
    if (!conversationId || !startTime || messages.length === 0) {
      console.log('Cannot save conversation:', { conversationId, startTime, messageCount: messages.length });
      return;
    }

    setIsSaving(true);
    try {
      const convertedMessages = convertMessages();
      const title = convertedMessages.find(m => m.type === 'user')?.content?.substring(0, 50) || 'Untitled Conversation';
      
      const conversation: Conversation = {
        id: conversationId,
        userId,
        title: title + (title.length >= 50 ? '...' : ''),
        messages: convertedMessages,
        startTime: startTime,
        endTime: status.value === 'disconnected' ? new Date().toISOString() : undefined,
        humeConfigId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID,
        // Add Hume sync information
        humeChatId: humeChatId || undefined,
        humeChatGroupId: humeChatGroupId || undefined,
        syncedToHume: !!humeChatId
      };

      // Save to localStorage
      ConversationStorage.saveConversation(conversation);
      
      // Optionally sync to Hume servers
      if (syncToHume && humeChatId) {
        try {
          console.log('✅ Conversation linked to Hume chat:', humeChatId);
          // The conversation is already on Hume's servers since we're using their chat ID
          // We're just making sure our localStorage version has the correct association
        } catch (humeError) {
          console.error('Error syncing to Hume servers:', humeError);
        }
      }
      
      setLastSavedMessageCount(messages.length);
      
      console.log('Conversation saved to localStorage:', {
        id: conversationId,
        messageCount: messages.length,
        title: conversation.title,
        status: status.value,
        humeChatId: humeChatId,
        syncedToHume: !!humeChatId
      });
    } catch (error) {
      console.error('Error saving conversation:', error);
    } finally {
      setIsSaving(false);
    }
  }, [conversationId, startTime, messages, convertMessages, userId, status.value, syncToHume, humeChatId, humeChatGroupId]);

  // Sync current conversation to Hume chat (when we get the chat ID)
  const syncToHumeChat = useCallback(async (newHumeChatId: string, newHumeChatGroupId?: string) => {
    if (conversationId && messages.length > 0) {
      console.log(`🔄 Syncing conversation ${conversationId} to Hume chat ${newHumeChatId}`);
      
      try {
        const convertedMessages = convertMessages();
        const title = convertedMessages.find(m => m.type === 'user')?.content?.substring(0, 50) || 'Untitled Conversation';
        
        const conversation: Conversation = {
          id: newHumeChatId, // Use Hume chat ID as the conversation ID
          userId,
          title: title + (title.length >= 50 ? '...' : ''),
          messages: convertedMessages,
          startTime: startTime!,
          endTime: status.value === 'disconnected' ? new Date().toISOString() : undefined,
          humeConfigId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID,
          humeChatId: newHumeChatId,
          humeChatGroupId: newHumeChatGroupId,
          syncedToHume: true
        };

        // Remove old conversation if it exists
        if (conversationId !== newHumeChatId) {
          ConversationStorage.deleteConversation(conversationId);
        }

        // Save with new Hume chat ID
        ConversationStorage.saveConversation(conversation);
        setConversationId(newHumeChatId);
        
        console.log('✅ Conversation synced to Hume chat:', newHumeChatId);
      } catch (error) {
        console.error('❌ Error syncing conversation to Hume chat:', error);
      }
    }
  }, [conversationId, messages, convertMessages, userId, startTime, status.value]);

  // Auto-save logic
  useEffect(() => {
    if (!autoSave || !conversationId || messages.length === 0) return;

    // Clear existing timer
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    // Set new timer for auto-save
    const timer = setTimeout(() => {
      if (messages.length > lastSavedMessageCount) {
        console.log('Auto-saving conversation...');
        saveConversation();
      }
    }, saveInterval * 60 * 1000); // Convert minutes to milliseconds

    setSaveTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [messages.length, saveInterval, autoSave, conversationId, lastSavedMessageCount, saveConversation]);

  // Save when disconnecting - with immediate execution
  useEffect(() => {
    if (status.value === 'disconnected' && conversationId && messages.length > 0) {
      console.log('Call ended, saving conversation immediately...');
      // Save immediately without delay
      const saveImmediately = async () => {
        if (!conversationId || !startTime || messages.length === 0) {
          console.log('Cannot save conversation on disconnect:', { conversationId, startTime, messageCount: messages.length });
          return;
        }

        try {
          const convertedMessages = messages.map((msg, index) => {
            // Type guard for message content
            const content = (msg as any).message?.content || '';
            const emotions = (msg as any).models?.prosody?.scores || undefined;
            
            // Ensure proper type mapping
            let messageType: 'user' | 'assistant' = 'assistant';
            if (msg.type === 'user_message') {
              messageType = 'user';
            }
            
            return {
              id: `msg_${index}_${Date.now()}`,
              type: messageType,
              content: content,
              timestamp: new Date().toISOString(),
              emotions: emotions
            };
          });

          const title = convertedMessages.find(m => m.type === 'user')?.content?.substring(0, 50) || 'Untitled Conversation';
          
          const conversation: Conversation = {
            id: conversationId,
            userId,
            title: title + (title.length >= 50 ? '...' : ''),
            messages: convertedMessages,
            startTime: startTime,
            endTime: new Date().toISOString(),
            humeConfigId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID,
            humeChatId: humeChatId || undefined,
            humeChatGroupId: humeChatGroupId || undefined,
            syncedToHume: !!humeChatId
          };

          ConversationStorage.saveConversation(conversation);
          console.log('Conversation saved on disconnect:', conversation.id);
        } catch (error) {
          console.error('Error saving conversation on disconnect:', error);
        }
      };

      saveImmediately();
    }
  }, [status.value, conversationId, startTime, messages, userId, humeChatId, humeChatGroupId]);

  // Log status changes for debugging
  useEffect(() => {
    console.log('Voice status changed:', status.value);
  }, [status.value]);

  // Manual save function
  const manualSave = useCallback(() => {
    console.log('Manual save triggered');
    saveConversation();
  }, [saveConversation]);

  // Get conversation history
  const getConversationHistory = useCallback((userId?: string) => {
    return ConversationStorage.getConversations(userId);
  }, []);

  // Search conversations
  const searchConversations = useCallback((query: string) => {
    return ConversationStorage.searchConversations(query);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback((conversationId: string) => {
    ConversationStorage.deleteConversation(conversationId);
  }, []);

  // Get conversation count
  const getConversationCount = useCallback(() => {
    return ConversationStorage.getConversations().length;
  }, []);

  // Clear all conversations
  const clearAllConversations = useCallback(() => {
    ConversationStorage.clearAll();
  }, []);

  // Check if there are unsaved changes
  const hasUnsavedChanges = messages.length > lastSavedMessageCount;

  return {
    // Conversation state
    conversationId,
    messagesCount: messages.length,
    hasUnsavedChanges,
    isSaving,
    
    // Hume sync state
    humeChatId,
    humeChatGroupId,
    syncedToHume: !!humeChatId,
    
    // Actions
    saveConversation: manualSave,
    syncToHumeChat,
    getConversationHistory,
    searchConversations,
    deleteConversation,
    getConversationCount,
    clearAllConversations,
  };
} 