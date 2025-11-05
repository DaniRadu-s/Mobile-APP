import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import { addPendingItem, getPendingItems, removePendingItemsByIds, OfflineItem } from './offline';
import { getLogger } from '../core';
import { ItemProps } from './ItemProps';
import { createItem, getItems, newWebSocket, updateItem, deleteItem } from './itemApi';

const log = getLogger('ItemProvider');

type SaveItemFn = (item: ItemProps) => Promise<any>;

export interface ItemsState {
  items: ItemProps[];
  fetching: boolean;
  fetchingError?: Error | null;
  saving: boolean;
  savingError?: Error | null;
  saveItem?: SaveItemFn;
  deleteItem?: (id: string) => void;
}

interface ActionProps {
  type: string;
  payload?: any;
}

const initialState: ItemsState = {
  items: [],
  fetching: false,
  saving: false,
};

const FETCH_ITEMS_STARTED = 'FETCH_ITEMS_STARTED';
const FETCH_ITEMS_SUCCEEDED = 'FETCH_ITEMS_SUCCEEDED';
const FETCH_ITEMS_FAILED = 'FETCH_ITEMS_FAILED';
const SAVE_ITEM_STARTED = 'SAVE_ITEM_STARTED';
const SAVE_ITEM_SUCCEEDED = 'SAVE_ITEM_SUCCEEDED';
const SAVE_ITEM_FAILED = 'SAVE_ITEM_FAILED';
const DELETE_ITEM_SUCCEEDED = 'DELETE_ITEM_SUCCEEDED';

const reducer = (state: ItemsState, { type, payload }: ActionProps): ItemsState => {
  switch (type) {
    case FETCH_ITEMS_STARTED:
      return { ...state, fetching: true, fetchingError: null };

    case FETCH_ITEMS_SUCCEEDED: {
      const newItems: ItemProps[] = payload?.items || [];
      console.log('FETCH_ITEMS_SUCCEEDED with items:', newItems);
      console.log('Current state items:', state.items);

      // Replace items completely with fresh data from server
      console.log('Setting items from server');
      return { ...state, items: newItems, fetching: false };
    }

    case FETCH_ITEMS_FAILED:
      return { ...state, fetchingError: payload?.error, fetching: false };

    case SAVE_ITEM_STARTED:
      return { ...state, saving: true, savingError: null };

    case SAVE_ITEM_SUCCEEDED: {
      const item: ItemProps = payload?.item;
      if (!item) {
        return { ...state, saving: false };
      }

      console.log('SAVE_ITEM_SUCCEEDED with item:', item);
      const items = [...state.items];
      console.log('Current items before save:', items);

      const index = items.findIndex(
          it => (it.id && item.id && it.id === item.id) || (it._localId && it._localId === item._localId)
      );

      console.log(`Found existing item at index: ${index}`);

      if (index === -1) {
        items.push(item);
        console.log('Added new item');
      } else {
        items[index] = {
          ...items[index],
          name: item.name ?? items[index].name,
          description: item.description ?? items[index].description,
          price: item.price !== undefined ? item.price : items[index].price,
          cinema: item.cinema ?? items[index].cinema,
          date: item.date ?? items[index].date,
        };

        console.log('Updated existing item');
      }

      console.log('Items after save:', items);
      return { ...state, items, saving: false };
    }

    case DELETE_ITEM_SUCCEEDED:
      return {
        ...state,
        items: state.items.filter(
            it => it.id !== payload?.id && it._localId !== payload?._localId
        ),
      };


    case SAVE_ITEM_FAILED:
      return { ...state, savingError: payload?.error, saving: false };

    default:
      return state;
  }
};

export const ItemContext = React.createContext<ItemsState>(initialState);

interface ItemProviderProps {
  children: React.ReactNode;
}

export const ItemProvider: React.FC<ItemProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { items, fetching, fetchingError, saving, savingError } = state;
  const wasOfflineRef = useRef(false);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  const refetchItems = useCallback(async (silent = false) => {
    try {
      console.log('RefetchItems called, silent:', silent);
      if (!silent) dispatch({ type: FETCH_ITEMS_STARTED });

      const serverItems = await getItems();
      const offlineItems = await getPendingItems();
      const offlineItemsForUI = offlineItems.filter(item => item._op !== 'delete');

      const mergedItems = [...(Array.isArray(serverItems) ? serverItems : [])];
      offlineItemsForUI.forEach(offline => {
        const exists = mergedItems.some(it => it._localId === offline._localId);
        if (!exists) mergedItems.push(offline);
      });

      console.log('RefetchItems result:', mergedItems);
      dispatch({ type: FETCH_ITEMS_SUCCEEDED, payload: { items: mergedItems } });
    } catch (e) {
      console.warn('Eroare la refetch după revenirea online sau sync:', e);
      if (!silent) {
        dispatch({ type: FETCH_ITEMS_FAILED, payload: { error: e } });
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    let canceled = false;
    console.log('Initial fetch items effect triggered');

    const fetchItems = async () => {
      try {
        dispatch({ type: FETCH_ITEMS_STARTED });
        const serverItems = await getItems();
        console.log('Server items loaded:', serverItems);

        if (!canceled) {
          const offlineItems = await getPendingItems();
          console.log('Offline items loaded:', offlineItems);
          const offlineItemsForUI = offlineItems.filter(item => item._op !== 'delete');
          console.log('Offline items for UI:', offlineItemsForUI);

          const mergedItems = [...(Array.isArray(serverItems) ? serverItems : [])];
          console.log('Initial merged items (server only):', mergedItems);

          offlineItemsForUI.forEach(offline => {
            const exists = mergedItems.some(it => it._localId === offline._localId);
            console.log(`Checking offline item ${offline._localId}, exists: ${exists}`);
            if (!exists) {
              mergedItems.push(offline);
              console.log(`Added offline item ${offline._localId}`);
            }
          });

          console.log('Final merged items:', mergedItems);
          dispatch({ type: FETCH_ITEMS_SUCCEEDED, payload: { items: mergedItems } });
        }
      } catch (error) {
        console.log('Server fetch failed, loading offline items only:', error);
        if (!canceled) {
          const offlineItems = await getPendingItems();
          const offlineItemsForUI = offlineItems.filter(item => item._op !== 'delete');
          console.log('Loading offline items only:', offlineItemsForUI);
          dispatch({ type: FETCH_ITEMS_SUCCEEDED, payload: { items: offlineItemsForUI } });
        }
      }
    };

    const timeoutId = setTimeout(fetchItems, 0);

    return () => {
      console.log('Fetch items effect cleanup');
      canceled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    let closeWebSocket: (() => void) | null = null;

    console.log('WebSocket effect triggered, online:', navigator.onLine);

    if (isOnline) {
      closeWebSocket = newWebSocket(message => {
        if (canceled) return;
        const { event, payload: { item } } = message;
        console.log('WebSocket message received:', event, item);

        if (event === 'created' || event === 'updated') {
          dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item } });
        } else if (event === 'deleted') {
          dispatch({ type: DELETE_ITEM_SUCCEEDED, payload: { id: item.id } });
        }
      });
    }

    return () => {
      console.log('WebSocket effect cleanup');
      canceled = true;
      if (closeWebSocket) {
        closeWebSocket();
      }
    };
  }, [isOnline]); // Se reconectează automat prin logica din itemApi.tsx

  // Storage event handler
  useEffect(() => {
    const handleStorage = () => {
      console.log('Storage event received – refetching items');
      refetchItems(true);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refetchItems]);

  useEffect(() => {
    const syncPending = async () => {
      const isOnline = navigator.onLine;
      console.log('SYNC: Check online status:', isOnline);

      if (!isOnline) {
        console.log('SYNC: Offline, nu sincronizez.');
        wasOfflineRef.current = true;
        return;
      }

      if (wasOfflineRef.current) {
        console.log('SYNC: Just came back online, refreshing all data');
        wasOfflineRef.current = false;
      }

      const pending = await getPendingItems();
      console.log('SYNC: Pending local', pending);

      if (!pending.length) {
        console.log('SYNC: Nu am nimic de sincronizat, doar refresh');
        await refetchItems(true);
        return;
      }

      const failCountKey = 'offline_sync_fail_counts';
      let failCounts: Record<string, number> = {};
      try {
        const fcRaw = localStorage.getItem(failCountKey);
        if (fcRaw) failCounts = JSON.parse(fcRaw);
      } catch {}

      const sentIds: string[] = [];
      const failedIds: string[] = [];

      for (const offlineItem of pending) {
        try {
          let savedItem: ItemProps;
          console.log('SYNC: Procesez offlineItem', offlineItem);

          if (offlineItem._op === 'create') {
            const result = await createItem(offlineItem);
            console.log('SYNC: Rezultat createItem', result);
            savedItem = result[0];
          } else if (offlineItem._op === 'update' && offlineItem.id) {
            const result = await updateItem(offlineItem);
            console.log('SYNC: Rezultat updateItem', result);
            savedItem = result[0];
          } else if (offlineItem._op === 'delete' && offlineItem.id) {
            await deleteItem(offlineItem.id);
            console.log('SYNC: deleteItem chemat pt', offlineItem.id);
            dispatch({ type: DELETE_ITEM_SUCCEEDED, payload: { id: offlineItem.id } });
            sentIds.push(offlineItem._localId!);
            continue;
          } else {
            console.warn('SYNC: Invalid offline item operation:', offlineItem);
            failedIds.push(offlineItem._localId!);
            continue;
          }

          const mergedItem: ItemProps = { ...offlineItem, ...savedItem };
          dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: mergedItem } });
          sentIds.push(offlineItem._localId!);

          if (failCounts[offlineItem._localId!]) failCounts[offlineItem._localId!] = 0;
        } catch (err) {
          console.warn('SYNC: Sync failed pentru', offlineItem, err);
          const id = offlineItem._localId!;
          failCounts[id] = (failCounts[id] || 0) + 1;

          if (failCounts[id] >= 3) {
            failedIds.push(id);
            console.warn('SYNC: Șters automat item din pending după 3 încercări:', id);
          }
        }
      }

      localStorage.setItem(failCountKey, JSON.stringify(failCounts));

      const idsToRemove = [...sentIds, ...failedIds];
      if (idsToRemove.length) {
        await removePendingItemsByIds(idsToRemove);
        console.log('SYNC: Items removed from pending:', idsToRemove);
      }

      console.log('SYNC: Sync complete, refreshing all items from server');
      await refetchItems(true);
      window.dispatchEvent(new Event('storage'));
    };

    const handleOnline = () => {
      console.log('ONLINE event detected');
      wasOfflineRef.current = false;
      syncPending();
    };

    const handleOffline = () => {
      console.log('OFFLINE event detected');
      wasOfflineRef.current = true;
    };

    const handleManualSync = () => {
      console.log('MANUAL SYNC triggered');
      syncPending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('manual-sync', handleManualSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('manual-sync', handleManualSync);
    };
  }, [refetchItems]);

  // Save item
  const saveItem = useCallback<SaveItemFn>(async (item) => {
    dispatch({ type: SAVE_ITEM_STARTED });

    // Construim obiect complet
    const fullItem: OfflineItem = {
      ...item,
      name: item.name,
      description: item.description,
      price: item.price !== undefined ? Number(item.price) : 0,
      cinema: item.cinema || false,
      date: item.date || new Date().toISOString(),
      id: item.id, // poate fi undefined
      _localId: item._localId || item.id || `local-${Date.now()}-${Math.random()}`,
      _op: item.id ? 'update' : 'create',
      _timestamp: Date.now(),
    };



    try {
      const result = item.id ? await updateItem(fullItem) : await createItem(fullItem);
      const savedItem = result[0];
      dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: savedItem } });
    } catch (error) {
      console.warn('Save failed, storing offline:', error);
      await addPendingItem(fullItem);
      dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: fullItem } });
    }
  }, []);


  const deleteItemCallback = useCallback(async (id: string) => {
    try {
      await deleteItem(id);
      dispatch({ type: DELETE_ITEM_SUCCEEDED, payload: { id } });
    } catch (error) {
      console.warn('Delete failed, storing offline:', error);
      const itemToDelete = items.find(item => item.id === id);
      if (itemToDelete) {
        const localItem: OfflineItem = {
          ...itemToDelete,
          _localId: `local-${Date.now()}-${Math.random()}`,
          _op: 'delete',
          _timestamp: Date.now(),
        };
        await addPendingItem(localItem);
        dispatch({ type: DELETE_ITEM_SUCCEEDED, payload: { id } });
        window.dispatchEvent(new Event('storage'));
      }
    }
  }, [items]);

  return (
      <ItemContext.Provider value={{ items, fetching, fetchingError, saving, savingError, saveItem, deleteItem: deleteItemCallback }}>
        {children}
      </ItemContext.Provider>
  );
};
