"use client";

export interface HumeChat {
  id: string;
  chat_group_id: string;
  tag?: string | null;
  status: string;
  start_timestamp: number;
  end_timestamp?: number | null;
  event_count: number;
  metadata?: Record<string, any> | null;
  config?: Record<string, any>;
  // Legacy fields for backward compatibility
  created_on?: string;
  updated_on?: string;
  name?: string;
}

export interface HumeChatEvent {
  id: string;
  timestamp: string;
  type: string;
  role: 'user' | 'assistant';
  message_text?: string;
  emotion_features?: Record<string, number>;
}

export interface HumeChatGroup {
  id: string;
  created_on: string;
  updated_on: string;
  name?: string;
}

export interface PaginatedChatResponse {
  chats_page: HumeChat[];
  pagination_direction: string;
  page_number: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedEventResponse {
  events_page: HumeChatEvent[];
  pagination_direction: string;
  page_number: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedChatGroupResponse {
  chat_groups_page: HumeChatGroup[];
  pagination_direction: string;
  page_number: number;
  page_size: number;
  total_pages: number;
}

export class HumeApiClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  // Chat endpoints
  async getChats(pageNumber = 0, pageSize = 10, ascendingOrder = false): Promise<PaginatedChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/hume-chats?page_number=${pageNumber}&page_size=${pageSize}&ascending_order=${ascendingOrder}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch chats: ${response.statusText} - ${errorText}`);
    }
    return response.json();
  }

  async getChatEvents(chatId: string, pageNumber = 0, pageSize = 10, ascendingOrder = false): Promise<PaginatedEventResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/hume-chats/${chatId}/events?page_number=${pageNumber}&page_size=${pageSize}&ascending_order=${ascendingOrder}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch chat events: ${response.statusText} - ${errorText}`);
    }
    return response.json();
  }

  // Chat group endpoints
  async getChatGroups(pageNumber = 0, pageSize = 10, ascendingOrder = false): Promise<PaginatedChatGroupResponse> {
    const response = await fetch(`${this.baseUrl}/api/hume-chat-groups?page_number=${pageNumber}&page_size=${pageSize}&ascending_order=${ascendingOrder}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch chat groups: ${response.statusText} - ${errorText}`);
    }
    return response.json();
  }

  async getChatGroupEvents(groupId: string, pageNumber = 0, pageSize = 10, ascendingOrder = false): Promise<PaginatedEventResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/hume-chat-groups/${groupId}/events?page_number=${pageNumber}&page_size=${pageSize}&ascending_order=${ascendingOrder}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch chat group events: ${response.statusText} - ${errorText}`);
    }
    return response.json();
  }

  // Utility methods
  async getAllChats(): Promise<HumeChat[]> {
    const allChats: HumeChat[] = [];
    let pageNumber = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.getChats(pageNumber, 50);
        allChats.push(...response.chats_page);
        
        hasMore = pageNumber < response.total_pages - 1;
        pageNumber++;
      } catch (error) {
        console.error('Error fetching all chats:', error);
        break;
      }
    }

    return allChats;
  }

  async getAllChatEvents(chatId: string): Promise<HumeChatEvent[]> {
    const allEvents: HumeChatEvent[] = [];
    let pageNumber = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.getChatEvents(chatId, pageNumber, 50);
        allEvents.push(...response.events_page);
        
        hasMore = pageNumber < response.total_pages - 1;
        pageNumber++;
      } catch (error) {
        console.error('Error fetching all chat events:', error);
        break;
      }
    }

    return allEvents;
  }

  async syncChatToLocalStorage(chatId: string, userId: string): Promise<void> {
    try {
      const events = await this.getAllChatEvents(chatId);
      
      if (events.length === 0) return;

      // Convert Hume events to local storage format
      const messages = events.map((event, index) => ({
        id: event.id || `msg_${index}_${Date.now()}`,
        type: event.role,
        content: event.message_text || '',
        timestamp: event.timestamp,
        emotions: event.emotion_features
      }));

      const conversation = {
        id: `hume_${chatId}`,
        userId,
        title: messages.find(m => m.type === 'user')?.content?.substring(0, 50) || 'Hume Conversation',
        messages,
        startTime: events[0]?.timestamp || new Date().toISOString(),
        endTime: events[events.length - 1]?.timestamp || new Date().toISOString(),
        chatGroupId: chatId
      };

      // Import ConversationStorage dynamically to avoid SSR issues
      const { ConversationStorage } = await import('./localStorage');
      ConversationStorage.saveConversation(conversation);
      
      console.log(`Synced Hume chat ${chatId} to localStorage`);
    } catch (error) {
      console.error('Error syncing chat to localStorage:', error);
    }
  }

  async syncAllChatsToLocalStorage(userId: string): Promise<void> {
    try {
      const chats = await this.getAllChats();
      
      for (const chat of chats) {
        await this.syncChatToLocalStorage(chat.id, userId);
      }
      
      console.log(`Synced ${chats.length} Hume chats to localStorage`);
    } catch (error) {
      console.error('Error syncing all chats to localStorage:', error);
    }
  }
}

// Export a default instance
export const humeApiClient = new HumeApiClient(); 