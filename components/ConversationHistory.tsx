"use client";

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ConversationStorage, Conversation } from '@/utils/localStorage';
import { Search, Download, Upload, Trash2, MessageSquare } from 'lucide-react';

interface ConversationHistoryProps {
  userId: string;
  onClose?: () => void;
}

export function ConversationHistory({ userId, onClose }: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Load conversations on mount
  useEffect(() => {
    // Initialize localStorage to ensure proper format
    ConversationStorage.initializeStorage();
    loadConversations();
  }, [userId]);

  // Filter conversations based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = ConversationStorage.searchConversations(searchQuery, userId);
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchQuery, conversations, userId]);

  const loadConversations = () => {
    const userConversations = ConversationStorage.getConversations(userId);
    userConversations.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    setConversations(userConversations);
  };

  const deleteConversation = (id: string) => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      ConversationStorage.deleteConversation(id);
      loadConversations();
      if (selectedConversation?.id === id) {
        setSelectedConversation(null);
      }
    }
  };

  const exportConversations = () => {
    const data = ConversationStorage.exportConversations();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hume-conversations-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConversations = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (ConversationStorage.importConversations(content)) {
        loadConversations();
        alert('Conversations imported successfully!');
      } else {
        alert('Failed to import conversations. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const clearAllConversations = () => {
    if (confirm('Are you sure you want to delete ALL conversations? This cannot be undone.')) {
      ConversationStorage.clearAll();
      loadConversations();
      setSelectedConversation(null);
    }
  };

  const resetStorage = () => {
    if (confirm('This will reset the storage system and delete all conversations. Continue?')) {
      ConversationStorage.resetStorage();
      loadConversations();
      setSelectedConversation(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 'In progress';
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Conversation History</h2>
          <div className="flex gap-2">
            <Button onClick={exportConversations} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={importConversations}
                className="hidden"
              />
            </label>
            <Button onClick={clearAllConversations} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
            <Button onClick={resetStorage} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Reset Storage
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm">
              ✕
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Conversation List */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedConversation?.id === conversation.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                    }`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {conversation.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(conversation.startTime)}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {conversation.messages.length} messages
                          </span>
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {formatDuration(conversation.startTime, conversation.endTime)}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conversation.id);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Conversation Details */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-lg">{selectedConversation.title}</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <div>Started: {formatDate(selectedConversation.startTime)}</div>
                    {selectedConversation.endTime && (
                      <div>Ended: {formatDate(selectedConversation.endTime)}</div>
                    )}
                    <div>Duration: {formatDuration(selectedConversation.startTime, selectedConversation.endTime)}</div>
                    <div>Messages: {selectedConversation.messages.length}</div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`mb-4 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                        {message.emotions && Object.keys(message.emotions).length > 0 && (
                          <div className="text-xs opacity-70 mt-1">
                            Emotions: {Object.entries(message.emotions)
                              .filter(([_, score]) => score > 0.5)
                              .map(([emotion, score]) => `${emotion}: ${(score * 100).toFixed(0)}%`)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          Storage used: {(ConversationStorage.getStorageSize() / 1024).toFixed(2)} KB | 
          Total conversations: {conversations.length}
        </div>
      </div>
    </div>
  );
} 