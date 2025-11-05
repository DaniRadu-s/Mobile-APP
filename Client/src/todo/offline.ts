import { ItemProps } from './ItemProps';

export interface OfflineItem extends ItemProps {
  _localId: string;
  _op: 'create' | 'update' | 'delete';
  _timestamp: number;
}

const STORAGE_KEY = 'offlineItems';

export const addPendingItem = async (item: OfflineItem): Promise<void> => {
  try {
    const existing = await getPendingItems();
    const updated = [...existing, item];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save offline item:', error);
  }
};

export const getPendingItems = async (): Promise<OfflineItem[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load offline items:', error);
    return [];
  }
};

export const removePendingItemsByIds = async (localIds: string[]): Promise<void> => {
  try {
    const existing = await getPendingItems();
    const updated = existing.filter(item => !localIds.includes(item._localId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to remove offline items:', error);
  }
};

export const clearAllPendingItems = async (): Promise<void> => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear offline items:', error);
  }
};

export const getPendingCount = async (): Promise<number> => {
  const items = await getPendingItems();
  return items.length;
};