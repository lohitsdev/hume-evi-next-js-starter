"use client";

import { useState } from "react";
import { useLocalStorageConversation } from "@/utils/useLocalStorageConversation";
import { ConversationHistory } from "./ConversationHistory";
import { Button } from "./ui/button";
import { History, Save } from "lucide-react";

interface ConversationManagerProps {
  userId: string;
}

export function ConversationManager({ userId }: ConversationManagerProps) {
  const [showHistory, setShowHistory] = useState(false);
  
  const conversation = useLocalStorageConversation({
    userId,
    autoSave: true,
    saveInterval: 2, // Save every 2 minutes
    syncToHume: false // Currently only saves to localStorage
  });

  return (
    <>
      {/* Status indicators */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
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
        </div>
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