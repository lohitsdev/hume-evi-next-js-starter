"use client";

import { useState, useEffect } from "react";
import { useLocalStorageConversation } from "@/utils/useLocalStorageConversation";
import { ConversationHistory } from "./ConversationHistory";
import { Button } from "./ui/button";
import { History, Save, Brain, Loader2, Users, Link } from "lucide-react";
import { useContextualVoice } from "@/utils/useContextualVoice";
import { isUsingAllConversationsContext, ALL_CONVERSATIONS_CONTEXT_KEY } from "@/utils/contextProvider";

interface ContextualConversationManagerProps {
  userId: string;
}

export function ContextualConversationManager({ userId }: ContextualConversationManagerProps) {
  const [showHistory, setShowHistory] = useState(false);
  
  // Use contextual voice hook instead of regular useVoice
  const contextualVoice = useContextualVoice({
    autoSetContext: true
  });
  
  const conversation = useLocalStorageConversation({
    userId,
    autoSave: true,
    saveInterval: 2, // Save every 2 minutes
    syncToHume: true, // Enable Hume sync
    humeChatId: contextualVoice.humeChatId,
    humeChatGroupId: contextualVoice.humeChatGroupId
  });

  // Sync conversation when we get Hume chat ID
  useEffect(() => {
    if (contextualVoice.humeChatId && !conversation.syncedToHume) {
      console.log('🔄 Auto-syncing conversation to Hume chat:', contextualVoice.humeChatId);
      conversation.syncToHumeChat(
        contextualVoice.humeChatId, 
        contextualVoice.humeChatGroupId || undefined
      );
    }
  }, [contextualVoice.humeChatId, contextualVoice.humeChatGroupId, conversation.syncedToHume, conversation.syncToHumeChat]);

  return (
    <>
      {/* Status indicators */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {/* Context status indicator */}
        {contextualVoice.loadingContext && (
          <div className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading context...
          </div>
        )}
        {contextualVoice.contextSent && !contextualVoice.loadingContext && (
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
            <Brain className="w-3 h-3" />
            Context set
          </div>
        )}
        
        {/* Hume sync status */}
        {contextualVoice.humeChatId && (
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
            <Link className="w-3 h-3" />
            Synced to Hume
          </div>
        )}
        
        {/* Conversation status indicators */}
        {conversation.isSaving && (
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Saving conversation...
          </div>
        )}
        {conversation.hasUnsavedChanges && !conversation.isSaving && (
          <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs">
            {conversation.messagesCount} unsaved messages
          </div>
        )}
        
        {/* Control buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => setShowHistory(true)}
            variant="secondary"
            size="sm"
            className="text-xs"
          >
            <History className="w-3 h-3 mr-1" />
            History
          </Button>
          <Button
            onClick={conversation.saveConversation}
            variant="secondary"
            size="sm"
            className="text-xs"
            disabled={conversation.isSaving}
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          {contextualVoice.status.value === 'connected' && (
            <Button
              onClick={() => contextualVoice.refreshContext()}
              variant="secondary"
              size="sm"
              className="text-xs"
              disabled={contextualVoice.loadingContext}
            >
              <Brain className="w-3 h-3 mr-1" />
              {contextualVoice.contextSent ? 'Refresh Context' : 'Set Context'}
            </Button>
          )}
        </div>
        
        {/* Context summary display */}
        {contextualVoice.contextSummary && (
          <div className="bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700 rounded-lg p-3 max-w-xs">
            <div className="text-xs font-semibold text-purple-800 dark:text-purple-200 mb-1 flex items-center gap-1">
              {contextualVoice.chatId === ALL_CONVERSATIONS_CONTEXT_KEY ? (
                <>
                  <Users className="w-3 h-3" />
                  All Conversations Context:
                </>
              ) : (
                <>
                  <Brain className="w-3 h-3" />
                  Context Summary:
                </>
              )}
            </div>
            <div className="text-xs text-purple-700 dark:text-purple-300 italic">
              "{contextualVoice.contextSummary}"
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {contextualVoice.chatId === ALL_CONVERSATIONS_CONTEXT_KEY 
                ? 'Comprehensive context from all conversations'
                : `Chat ID: ${contextualVoice.chatId.substring(0, 8)}...`
              }
            </div>
            {/* Show Hume chat ID if available */}
            {contextualVoice.humeChatId && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                <Link className="w-3 h-3" />
                Hume: {contextualVoice.humeChatId.substring(0, 8)}...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversation History Modal */}
      {showHistory && (
        <ConversationHistory
          userId={userId}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
} 