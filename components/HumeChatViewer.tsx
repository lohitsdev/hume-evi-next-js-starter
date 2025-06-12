"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { humeApiClient, HumeChat, HumeChatEvent } from '@/utils/humeApiClient';
import { Search, RefreshCw, MessageSquare, User, Calendar, Clock, FileText, Loader2, Brain, Users, RotateCcw } from 'lucide-react';
import { setContextChatId, getContextChatId, setAllConversationsContext, isUsingAllConversationsContext, ALL_CONVERSATIONS_CONTEXT_KEY } from '@/utils/contextProvider';

interface HumeChatViewerProps {
  onClose?: () => void;
}

// Cache for storing summaries
const summaryCache = new Map<string, string>();

// LocalStorage key for persistent cache
const CACHE_KEY = 'hume_chat_summaries';

// Load cache from localStorage on component mount
const loadCacheFromStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([chatId, summary]) => {
          summaryCache.set(chatId, summary as string);
        });
        console.log('Loaded', summaryCache.size, 'cached summaries from localStorage');
      }
    } catch (error) {
      console.error('Error loading cache from localStorage:', error);
    }
  }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const cacheObject = Object.fromEntries(summaryCache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
      console.log('Saved', summaryCache.size, 'summaries to localStorage cache');
    } catch (error) {
      console.error('Error saving cache to localStorage:', error);
    }
  }
};

export function HumeChatViewer({ onClose }: HumeChatViewerProps) {
  const [chats, setChats] = useState<HumeChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<HumeChat | null>(null);
  const [chatEvents, setChatEvents] = useState<HumeChatEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState({ total: 0, hit: 0 });
  const [currentContextChatId, setCurrentContextChatId] = useState<string>(() => getContextChatId());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [newConversationsFound, setNewConversationsFound] = useState(0);
  
  // Initialize cache on component mount
  const cacheInitialized = useRef(false);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!cacheInitialized.current) {
      loadCacheFromStorage();
      cacheInitialized.current = true;
      setCacheStats({ total: summaryCache.size, hit: 0 });
    }
  }, []);

  // Fetch chats on component mount
  useEffect(() => {
    fetchChats();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      // Set up polling every 30 seconds
      refreshInterval.current = setInterval(() => {
        console.log('🔄 Auto-refreshing conversations...');
        fetchChats(true); // Background refresh
      }, 30000); // 30 seconds

      console.log('✅ Auto-refresh enabled (every 30 seconds)');
    } else {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
      console.log('⏹️ Auto-refresh disabled');
    }

    // Cleanup on unmount or when autoRefresh changes
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
    };
  }, [autoRefresh, chats.length]); // Include chats.length to detect changes

  // Listen for conversation ended events for immediate refresh
  useEffect(() => {
    const handleConversationEnded = (event: CustomEvent) => {
      console.log('🔔 Conversation ended event received, triggering immediate refresh...', event.detail);
      // Wait a moment for the conversation to be fully processed on Hume's side
      setTimeout(() => {
        fetchChats(true);
      }, 2000); // 2 second delay to allow Hume to process
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('humeConversationEnded', handleConversationEnded as EventListener);
      console.log('🎧 Listening for conversation ended events');
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('humeConversationEnded', handleConversationEnded as EventListener);
      }
    };
  }, []);

  const fetchChats = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    setError(null);
    try {
      console.log(`🔄 Fetching ALL chats from Hume (${isBackgroundRefresh ? 'background' : 'manual'})...`);
      // Use getAllChats() to fetch all conversations across all pages
      const allChats = await humeApiClient.getAllChats();
      
      // Check if we have new conversations
      const newChatsCount = allChats.length - chats.length;
      if (isBackgroundRefresh && newChatsCount > 0) {
        console.log(`🆕 Found ${newChatsCount} new conversations!`);
        setNewConversationsFound(newChatsCount);
        // Clear the notification after 5 seconds
        setTimeout(() => setNewConversationsFound(0), 5000);
      } else if (!isBackgroundRefresh) {
        // Reset counter on manual refresh
        setNewConversationsFound(0);
      }
      
      setChats(allChats);
      setLastRefresh(new Date());
      console.log(`✅ Fetched ALL chats from Hume: ${allChats.length} conversations (${isBackgroundRefresh ? 'background' : 'manual'})`);
    } catch (err) {
      if (!isBackgroundRefresh) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chats from Hume');
      }
      console.error('Error fetching chats:', err);
    } finally {
      if (!isBackgroundRefresh) {
        setLoading(false);
      }
    }
  };

  // Sync all conversations - generate summaries for all chats that don't have them
  const syncAllConversations = async () => {
    if (chats.length === 0) {
      console.log('No chats to sync');
      return;
    }

    setSyncingAll(true);
    setSyncProgress({ current: 0, total: chats.length });
    
    try {
      console.log('🔄 Starting sync of all conversations...');
      let processed = 0;
      let newSummaries = 0;

      for (const chat of chats) {
        try {
          setSyncProgress({ current: processed + 1, total: chats.length });
          
          // Skip if already cached
          if (summaryCache.has(chat.id)) {
            console.log(`⏭️ Skipping ${chat.id} - already cached`);
            processed++;
            continue;
          }

          console.log(`🔄 Processing chat ${chat.id}...`);
          
          // Fetch events for this chat
          const events = await humeApiClient.getAllChatEvents(chat.id);
          const userMessages = events
            .filter(event => event.type === 'USER_MESSAGE')
            .map(event => event.message_text)
            .filter((text): text is string => typeof text === 'string' && text.trim() !== '');

          if (userMessages.length === 0) {
            console.log(`⚠️ No user messages in chat ${chat.id}`);
            processed++;
            continue;
          }

          // Generate summary
          const response = await fetch('/api/generate-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userMessages }),
          });

          if (!response.ok) {
            throw new Error(`Failed to generate summary for chat ${chat.id}`);
          }

          const data = await response.json();
          const generatedSummary = data.summary;
          
          // Cache the summary
          summaryCache.set(chat.id, generatedSummary);
          newSummaries++;
          
          console.log(`✅ Generated summary for chat ${chat.id}`);
          
        } catch (err) {
          console.error(`❌ Error processing chat ${chat.id}:`, err);
        }
        
        processed++;
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Save all new summaries to localStorage
      saveCacheToStorage();
      setCacheStats({ total: summaryCache.size, hit: 0 });
      
      console.log(`✅ Sync complete! Generated ${newSummaries} new summaries. Total cached: ${summaryCache.size}`);
      
      // Show success message
      if (typeof window !== 'undefined') {
        alert(`Sync complete! Generated ${newSummaries} new summaries from ${chats.length} conversations.`);
      }
      
    } catch (err) {
      console.error('❌ Error during sync:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync conversations');
    } finally {
      setSyncingAll(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  // Combined refresh and sync function
  const refreshAndSync = async () => {
    console.log('🔄 Starting manual refresh and sync process...');
    await fetchChats(false); // Manual refresh, not background
    // After fetching chats, automatically start syncing summaries
    setTimeout(() => {
      console.log('📊 Auto-starting summary sync for all conversations...');
      syncAllConversations();
    }, 500);
  };

  const generateSummary = async (chatId: string, userMessages: string[]) => {
    if (userMessages.length === 0) {
      setSummary('No user messages to summarize.');
      return;
    }

    // Check cache first
    const cachedSummary = summaryCache.get(chatId);
    if (cachedSummary) {
      setSummary(cachedSummary);
      setCacheStats(prev => ({ ...prev, hit: prev.hit + 1 }));
      console.log('✅ Using cached summary for chat:', chatId);
      return;
    }

    setLoadingSummary(true);
    try {
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
      const generatedSummary = data.summary;
      
      // Cache the summary
      summaryCache.set(chatId, generatedSummary);
      setCacheStats(prev => ({ total: summaryCache.size, hit: prev.hit }));
      
      // Save to localStorage
      saveCacheToStorage();
      
      setSummary(generatedSummary);
      console.log('🆕 Generated and cached new summary for chat:', chatId);
    } catch (err) {
      console.error('Error generating summary:', err);
      setSummary('Failed to generate summary. Please try again.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchChatEvents = async (chatId: string) => {
    setLoadingEvents(true);
    setSummary(''); // Clear previous summary
    try {
      const events = await humeApiClient.getAllChatEvents(chatId);
      // Filter to show only USER_MESSAGE events
      const userMessages = events.filter(event => event.type === 'USER_MESSAGE');
      setChatEvents(userMessages);
      console.log('Fetched user messages:', userMessages.length);

      // Generate summary from user messages (with caching)
      const messageTexts = userMessages
        .map(event => event.message_text)
        .filter((text): text is string => typeof text === 'string' && text.trim() !== '');
      
      if (messageTexts.length > 0) {
        await generateSummary(chatId, messageTexts);
      } else {
        setSummary('No user messages found to summarize.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chat events');
      console.error('Error fetching chat events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleChatSelect = (chat: HumeChat) => {
    setSelectedChat(chat);
    fetchChatEvents(chat.id);
  };

  const clearCache = () => {
    summaryCache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }
    setCacheStats({ total: 0, hit: 0 });
    setSummary('');
    console.log('🗑️ Cache cleared');
  };

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      chat.id.toLowerCase().includes(searchLower) ||
      chat.name?.toLowerCase().includes(searchLower) ||
      new Date(chat.created_on || chat.start_timestamp).toLocaleString().toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string | number) => {
    if (typeof dateString === 'number') {
      return new Date(dateString).toLocaleString();
    }
    return new Date(dateString).toLocaleString();
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const setAsContext = (chatId: string) => {
    setContextChatId(chatId);
    setCurrentContextChatId(chatId);
    console.log(`✅ Set chat ${chatId.substring(0, 8)}... as context for new conversations`);
    
    // Show confirmation to user
    if (typeof window !== 'undefined') {
      // You could also use a toast notification library here
      const chatName = chats.find(c => c.id === chatId)?.name || `Chat ${chatId.substring(0, 8)}...`;
      alert(`"${chatName}" has been set as the context for new conversations!`);
    }
  };

  const setAllConversationsAsContext = () => {
    setAllConversationsContext();
    setCurrentContextChatId(ALL_CONVERSATIONS_CONTEXT_KEY);
    console.log(`✅ Set ALL conversations as context for new conversations`);
    
    // Show confirmation to user
    if (typeof window !== 'undefined') {
      alert(`All conversations (${cacheStats.total} summaries) will now be used as context for new conversations!`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Hume Chat History - User Messages with AI Summary</h2>
            <div className="text-xs text-gray-500 mt-1">
              Cache: {cacheStats.total} summaries stored | {cacheStats.hit} cache hits
              {currentContextChatId && (
                <span className="ml-4 text-purple-600">
                  Current context: {
                    currentContextChatId === ALL_CONVERSATIONS_CONTEXT_KEY 
                      ? `All conversations (${cacheStats.total})` 
                      : currentContextChatId.substring(0, 8) + '...'
                  }
                </span>
              )}
              {syncingAll && (
                <span className="ml-4 text-blue-600">
                  Syncing: {syncProgress.current}/{syncProgress.total} chats
                </span>
              )}
              {autoRefresh && (
                <span className="ml-4 text-green-600">
                  🔄 Auto-refresh ON | Last: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              {newConversationsFound > 0 && (
                <span className="ml-4 text-blue-600 font-semibold animate-pulse">
                  🆕 {newConversationsFound} new conversation{newConversationsFound > 1 ? 's' : ''} found!
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setAutoRefresh(!autoRefresh)} 
              variant={autoRefresh ? "default" : "outline"} 
              size="sm" 
              className="text-xs"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
            </Button>
            {cacheStats.total > 1 && (
              <Button 
                onClick={setAllConversationsAsContext} 
                variant={isUsingAllConversationsContext() ? "default" : "outline"} 
                size="sm" 
                className="text-xs"
                disabled={isUsingAllConversationsContext()}
              >
                <Users className="w-4 h-4 mr-2" />
                {isUsingAllConversationsContext() ? 'Using All Conversations' : 'Use All as Context'}
              </Button>
            )}
            <Button 
              onClick={syncAllConversations} 
              variant="outline" 
              size="sm" 
              className="text-xs"
              disabled={syncingAll || loading}
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? `Syncing (${syncProgress.current}/${syncProgress.total})` : 'Sync All'}
            </Button>
            <Button onClick={clearCache} variant="outline" size="sm" className="text-xs">
              Clear Cache
            </Button>
            <Button 
              onClick={() => refreshAndSync()} 
              variant="outline" 
              size="sm" 
              disabled={loading || syncingAll}
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Manual Refresh
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm">
              ✕
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Chat List */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* All Conversations Context Info */}
            {isUsingAllConversationsContext() && (
              <div className="p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 border-b border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-purple-800 dark:text-purple-300">All Conversations Context</h4>
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300">
                  Using {cacheStats.total} conversation summaries as comprehensive context for new chats.
                </div>
              </div>
            )}

            {/* Sync Progress Bar */}
            {syncingAll && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCcw className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Syncing Conversations ({syncProgress.current}/{syncProgress.total})
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Generating summaries for all conversations...
                </div>
              </div>
            )}

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search chats by ID, name, or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center">
                  <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm font-medium">Fetching all conversations from Hume...</p>
                  <p className="text-xs text-gray-500 mt-1">This may take a moment for large conversation histories</p>
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-500">
                  <p className="text-sm">{error}</p>
                  <Button onClick={fetchChats} variant="outline" size="sm" className="mt-2">
                    Try Again
                  </Button>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'No chats found matching your search' : 'No chats found on Hume servers'}
                </div>
              ) : (
                filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedChat?.id === chat.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                    } ${
                      currentContextChatId === chat.id ? 'ring-2 ring-purple-500' : ''
                    } ${
                      isUsingAllConversationsContext() && summaryCache.has(chat.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                    }`}
                    onClick={() => handleChatSelect(chat)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {chat.name || `Chat ${chat.id.substring(0, 8)}...`}
                        </h3>
                        {summaryCache.has(chat.id) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Cached
                          </span>
                        )}
                        {currentContextChatId === chat.id && currentContextChatId !== ALL_CONVERSATIONS_CONTEXT_KEY && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            Current Context
                          </span>
                        )}
                        {isUsingAllConversationsContext() && summaryCache.has(chat.id) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                            In Context
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ID: {chat.id}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(chat.created_on || chat.start_timestamp)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Status: {chat.status || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Events: {chat.event_count || 0}
                      </div>
                      {chat.metadata && Object.keys(chat.metadata).length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Metadata: {JSON.stringify(chat.metadata).substring(0, 50)}...
                        </div>
                      )}
                      
                      {/* Use as Context button - only show if not using all conversations */}
                      {summaryCache.has(chat.id) && !isUsingAllConversationsContext() && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            onClick={() => setAsContext(chat.id)}
                            variant={currentContextChatId === chat.id ? "default" : "outline"}
                            size="sm"
                            className="text-xs w-full"
                            disabled={currentContextChatId === chat.id}
                          >
                            <Brain className="w-3 h-3 mr-1" />
                            {currentContextChatId === chat.id ? 'Current Context' : 'Use as Context'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - User Messages with Summary */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-lg">
                    {selectedChat.name || `Chat ${selectedChat.id.substring(0, 16)}...`}
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <div>Chat ID: {selectedChat.id}</div>
                    <div>Status: {selectedChat.status || 'Unknown'}</div>
                    <div>Started: {formatDate(selectedChat.created_on || selectedChat.start_timestamp)}</div>
                    {selectedChat.end_timestamp && (
                      <div>Ended: {formatDate(selectedChat.end_timestamp)}</div>
                    )}
                    <div>User Messages: {chatEvents.length}</div>
                  </div>
                </div>

                {/* AI Summary Section */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-800 dark:text-purple-300">AI Conversation Summary</h4>
                    {loadingSummary && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
                    {selectedChat && summaryCache.has(selectedChat.id) && !loadingSummary && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        From Cache
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 italic">
                    {loadingSummary ? 'Generating summary...' : summary || 'Select a chat to generate summary'}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingEvents ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p>Loading user messages...</p>
                      </div>
                    </div>
                  ) : chatEvents.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No user messages found in this chat</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatEvents.map((event, index) => (
                        <div
                          key={event.id || index}
                          className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border-l-4 border-blue-500"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">User Message #{index + 1}</span>
                            <div className="flex items-center gap-1 ml-auto text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {formatMessageTime(event.timestamp)}
                            </div>
                          </div>
                          
                          <div className="text-gray-900 dark:text-gray-100">
                            {event.message_text || 'No message content'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a chat to view user messages and AI summary</p>
                  <p className="text-sm mt-2">Found {chats.length} chats on Hume servers</p>
                  {isUsingAllConversationsContext() && (
                    <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                      <div className="flex items-center gap-2 justify-center mb-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        <span className="text-purple-800 dark:text-purple-300 font-semibold">All Conversations Context Active</span>
                      </div>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        New conversations will use context from all {cacheStats.total} cached conversation summaries
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex justify-between items-center">
            <div>
              Total conversations from Hume: <span className="font-semibold text-blue-600">{chats.length}</span>
              {selectedChat && ` | User messages in current chat: ${chatEvents.length}`}
              {searchQuery && ` | Filtered: ${filteredChats.length} of ${chats.length}`}
              {autoRefresh && (
                <span className="text-green-600 ml-2">
                  | 🔄 Auto-sync every 30s
                </span>
              )}
            </div>
            <div>
              Cached summaries: <span className="font-semibold text-green-600">{cacheStats.total}</span> | 
              Cache hits: <span className="font-semibold text-purple-600">{cacheStats.hit}</span>
              {isUsingAllConversationsContext() && (
                <span className="text-purple-600 ml-2">
                  | ✨ All conversations context active
                </span>
              )}
              {syncingAll && (
                <span className="text-blue-600 ml-2">
                  | 🔄 Syncing in progress...
                </span>
              )}
            </div>
          </div>
          {chats.length >= 50 && (
            <div className="text-xs text-blue-600 mt-1">
              ✅ Fetched all conversations across multiple pages
              {autoRefresh && ` | Next auto-refresh in ${Math.ceil((30000 - (Date.now() - lastRefresh.getTime())) / 1000)}s`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 