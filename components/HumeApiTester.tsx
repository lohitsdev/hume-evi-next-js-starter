"use client";

import { useState } from 'react';
import { Button } from './ui/button';
import { humeApiClient, HumeChat, HumeChatGroup } from '@/utils/humeApiClient';
import { ConversationStorage } from '@/utils/localStorage';
import { RefreshCw, Download, RotateCcw, Database } from 'lucide-react';

export function HumeApiTester() {
  const [chats, setChats] = useState<HumeChat[]>([]);
  const [chatGroups, setChatGroups] = useState<HumeChatGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const fetchChats = async () => {
    setLoading(true);
    setError(null);
    try {
      const allChats = await humeApiClient.getAllChats();
      setChats(allChats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chats');
      setChats([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchChatGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await humeApiClient.getChatGroups();
      setChatGroups(response?.chat_groups_page || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chat groups');
      setChatGroups([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const syncToLocalStorage = async () => {
    setLoading(true);
    setSyncStatus('Syncing...');
    try {
      await humeApiClient.syncAllChatsToLocalStorage('demo-user');
      setSyncStatus('Successfully synced all chats to localStorage');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync chats');
      setSyncStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const exportLocalStorage = () => {
    const data = ConversationStorage.exportConversations();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localStorage-conversations-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg max-w-sm">
      <h3 className="font-semibold mb-3 text-sm">Hume API Tester</h3>
      
      <div className="space-y-2">
        <Button
          onClick={fetchChats}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Fetch Chats ({chats?.length || 0})
        </Button>

        <Button
          onClick={fetchChatGroups}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full text-xs"
        >
          <Database className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Fetch Groups ({chatGroups?.length || 0})
        </Button>

        <Button
          onClick={syncToLocalStorage}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full text-xs"
        >
          <RotateCcw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Sync to LocalStorage
        </Button>

        <Button
          onClick={exportLocalStorage}
          variant="outline"
          size="sm"
          className="w-full text-xs"
        >
          <Download className="w-3 h-3 mr-1" />
          Export LocalStorage
        </Button>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs rounded">
          {error}
        </div>
      )}

      {syncStatus && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
          {syncStatus}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        <div>Chats: {chats?.length || 0}</div>
        <div>Groups: {chatGroups?.length || 0}</div>
        <div>LocalStorage: {(ConversationStorage.getStorageSize() / 1024).toFixed(1)}KB</div>
      </div>
    </div>
  );
} 