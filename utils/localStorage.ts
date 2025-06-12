"use client";

export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  emotions?: {
    [key: string]: number;
  };
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: ConversationMessage[];
  startTime: string;
  endTime?: string;
  duration?: number;
  chatGroupId?: string;
  humeConfigId?: string;
  // Hume sync fields
  humeChatId?: string;
  humeChatGroupId?: string;
  syncedToHume?: boolean;
}

const STORAGE_KEY = 'hume_conversations';
const MAX_CONVERSATIONS = 100; // Limit to prevent localStorage overflow

export class ConversationStorage {
  static saveConversation(conversation: Conversation): void {
    try {
      const existing = this.getConversations();
      
      // Validate the conversation object
      if (!conversation || !conversation.id || !conversation.userId) {
        console.error('Invalid conversation object:', conversation);
        return;
      }
      
      const index = existing.findIndex(c => c.id === conversation.id);
      
      if (index >= 0) {
        existing[index] = conversation;
      } else {
        existing.push(conversation);
        
        // Keep only the most recent conversations
        if (existing.length > MAX_CONVERSATIONS) {
          existing.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          existing.splice(MAX_CONVERSATIONS);
        }
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      console.log('Conversation saved successfully:', conversation.id);
    } catch (error) {
      console.error('Error saving conversation to localStorage:', error);
      // If there's an error, try to clear and start fresh
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([conversation]));
        console.log('Reset localStorage and saved conversation:', conversation.id);
      } catch (resetError) {
        console.error('Failed to reset localStorage:', resetError);
      }
    }
  }

  static getConversations(userId?: string): Conversation[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      
      // Ensure we have an array
      if (!Array.isArray(parsed)) {
        console.warn('Invalid conversations data in localStorage, resetting to empty array');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        return [];
      }
      
      const conversations: Conversation[] = parsed;
      
      if (userId) {
        return conversations.filter(c => c.userId === userId);
      }
      
      return conversations;
    } catch (error) {
      console.error('Error retrieving conversations from localStorage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (clearError) {
        console.error('Error clearing corrupted localStorage:', clearError);
      }
      return [];
    }
  }

  static getConversation(id: string): Conversation | null {
    try {
      const conversations = this.getConversations();
      return conversations.find(c => c.id === id) || null;
    } catch (error) {
      console.error('Error getting conversation from localStorage:', error);
      return null;
    }
  }

  static deleteConversation(id: string): void {
    try {
      const conversations = this.getConversations();
      const filtered = conversations.filter(c => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting conversation from localStorage:', error);
    }
  }

  static clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing conversations from localStorage:', error);
    }
  }

  static resetStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      console.log('LocalStorage reset to empty array');
    } catch (error) {
      console.error('Error resetting localStorage:', error);
    }
  }

  static initializeStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        this.resetStorage();
        return;
      }
      
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        console.warn('Invalid data format in localStorage, resetting...');
        this.resetStorage();
      }
    } catch (error) {
      console.error('Error initializing localStorage:', error);
      this.resetStorage();
    }
  }

  static searchConversations(query: string, userId?: string): Conversation[] {
    try {
      const conversations = this.getConversations(userId);
      const lowercaseQuery = query.toLowerCase();
      
      return conversations.filter(conversation => {
        // Search in title
        if (conversation.title.toLowerCase().includes(lowercaseQuery)) {
          return true;
        }
        
        // Search in messages
        return conversation.messages.some(message => 
          message.content.toLowerCase().includes(lowercaseQuery)
        );
      });
    } catch (error) {
      console.error('Error searching conversations:', error);
      return [];
    }
  }

  static getStorageSize(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Blob([stored]).size : 0;
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return 0;
    }
  }

  static exportConversations(): string {
    try {
      const conversations = this.getConversations();
      return JSON.stringify(conversations, null, 2);
    } catch (error) {
      console.error('Error exporting conversations:', error);
      return '[]';
    }
  }

  static importConversations(jsonData: string): boolean {
    try {
      const imported: Conversation[] = JSON.parse(jsonData);
      
      // Validate the structure
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array');
      }
      
      // Merge with existing conversations
      const existing = this.getConversations();
      const merged = [...existing];
      
      imported.forEach(conversation => {
        const existingIndex = merged.findIndex(c => c.id === conversation.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = conversation;
        } else {
          merged.push(conversation);
        }
      });
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return true;
    } catch (error) {
      console.error('Error importing conversations:', error);
      return false;
    }
  }
} 