"use client";

import { useEffect, useState } from 'react';
import { useVoice } from '@humeai/voice-react';
import { getCurrentContext, createSessionSettings, getContextChatId } from './contextProvider';

interface UseContextualVoiceOptions {
  autoSetContext?: boolean;
}

export function useContextualVoice(options: UseContextualVoiceOptions = {}) {
  const { autoSetContext = true } = options;
  const voice = useVoice();
  const [contextSent, setContextSent] = useState(false);
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>(() => getContextChatId());
  const [humeChatId, setHumeChatId] = useState<string | null>(null);
  const [humeChatGroupId, setHumeChatGroupId] = useState<string | null>(null);

  // Listen for chat metadata from Hume to get the actual chat ID
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'chat_metadata') {
        console.log('📋 Received chat metadata from Hume:', message);
        setHumeChatId(message.chat_id);
        setHumeChatGroupId(message.chat_group_id);
      }
    };

    // Add message listener
    if (voice.messages) {
      // Check if we already have a chat_metadata message
      const chatMetadata = voice.messages.find(msg => msg.type === 'chat_metadata');
      if (chatMetadata) {
        handleMessage(chatMetadata);
      }
    }

    // Note: The useVoice hook doesn't expose a direct message listener,
    // so we'll need to check messages array changes
    // This is a limitation we'll work around by monitoring the messages array
  }, [voice.messages]);

  // Load context when connected and auto-setting is enabled
  useEffect(() => {
    const sendContextIfConnected = async () => {
      if (
        voice.status.value === 'connected' && 
        autoSetContext && 
        !contextSent && 
        !loadingContext
      ) {
        setLoadingContext(true);
        const chatId = getContextChatId();
        setCurrentChatId(chatId);
        console.log('🔄 Connected to Hume, loading context for chat:', chatId);
        
        try {
          const summary = await getCurrentContext();
          
          if (summary) {
            const sessionSettings = createSessionSettings(summary);
            console.log('📤 Sending session settings with context:', sessionSettings);
            
            voice.sendSessionSettings(sessionSettings);
            setContextSummary(summary);
            setContextSent(true);
            
            console.log('✅ Context successfully set for session:', summary);
          } else {
            console.log('⚠️ No context summary available for chat:', chatId);
          }
        } catch (error) {
          console.error('❌ Error setting context:', error);
        } finally {
          setLoadingContext(false);
        }
      }
    };

    sendContextIfConnected();
  }, [voice.status.value, autoSetContext, contextSent, loadingContext, voice]);

  // Reset context state when disconnecting
  useEffect(() => {
    if (voice.status.value === 'disconnected') {
      setContextSent(false);
      setContextSummary(null);
      setLoadingContext(false);
      setHumeChatId(null);
      setHumeChatGroupId(null);
      console.log('🔄 Disconnected - reset context state');
      
      // Trigger immediate refresh of Hume chats when conversation ends
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('humeConversationEnded', {
          detail: { humeChatId }
        }));
        console.log('📡 Dispatched conversation ended event for immediate Hume sync');
      }
    }
  }, [voice.status.value, humeChatId]);

  // Refresh context (check for changes in chat ID)
  const refreshContext = async () => {
    const chatId = getContextChatId();
    setCurrentChatId(chatId);
    
    if (voice.status.value === 'connected') {
      setLoadingContext(true);
      
      try {
        console.log('🔄 Refreshing context for chat:', chatId);
        const summary = await getCurrentContext();
        
        if (summary) {
          const sessionSettings = createSessionSettings(summary);
          voice.sendSessionSettings(sessionSettings);
          setContextSummary(summary);
          setContextSent(true);
          console.log('✅ Context refreshed successfully:', summary);
        } else {
          console.log('⚠️ No summary available for chat:', chatId);
        }
      } catch (error) {
        console.error('❌ Error refreshing context:', error);
      } finally {
        setLoadingContext(false);
      }
    }
  };

  // Manual function to set context
  const setContext = async () => {
    return refreshContext();
  };

  // Clear context
  const clearContext = () => {
    if (voice.status.value === 'connected') {
      voice.sendSessionSettings({ context: undefined });
      setContextSent(false);
      setContextSummary(null);
      console.log('🗑️ Context cleared from session');
    }
  };

  return {
    ...voice,
    // Context-specific properties
    contextSummary,
    contextSent,
    loadingContext,
    chatId: currentChatId,
    // Hume chat IDs
    humeChatId,
    humeChatGroupId,
    // Context control methods
    setContext,
    clearContext,
    refreshContext,
  };
} 