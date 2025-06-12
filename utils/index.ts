import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Export localStorage utilities
export * from './localStorage';

// Export Hume API client
export * from './humeApiClient';

// Export localStorage conversation hook
export * from './useLocalStorageConversation';
