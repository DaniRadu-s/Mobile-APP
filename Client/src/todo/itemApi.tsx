import axios from 'axios';
import { getLogger } from '../core';
import { ItemProps } from './ItemProps';

const log = getLogger('itemApi');

const baseUrl = 'localhost:3000';
const itemUrl = `http://${baseUrl}/item`;

interface ResponseProps<T> {
  data: T;
}

function withLogs<T>(promise: Promise<ResponseProps<T>>, fnName: string): Promise<T> {
  log(`${fnName} - started`);
  return promise
      .then(res => {
        log(`${fnName} - succeeded`);
        return Promise.resolve(res.data);
      })
      .catch(err => {
        log(`${fnName} - failed`);
        return Promise.reject(err);
      });
}

const getConfig = () => {
  const token = localStorage.getItem('token');
  console.log('Token from localStorage:', token);
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  console.log('Request config:', config);
  return config;
};

export const getItems: (page?: number, limit?: number, search?: string) => Promise<ItemProps[]> = (page = 0, limit = 10, search = '') => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (search) params.append('search', search);

  const url = `${itemUrl}?${params.toString()}`;
  return withLogs(axios.get(url, getConfig()), 'getItems');
}

export const createItem: (item: ItemProps) => Promise<ItemProps[]> = item => {
  return withLogs(axios.post(itemUrl, item, getConfig()), 'createItem');
}

export const updateItem: (item: ItemProps) => Promise<ItemProps[]> = item => {
  return withLogs(axios.put(`${itemUrl}/${item.id}`, item, getConfig()), 'updateItem');
}

export const deleteItem = (id: string) => {
  return withLogs(axios.delete(`${itemUrl}/${id}`, getConfig()), 'deleteItem');
};


interface MessageData {
  event: string;
  payload: {
    item: ItemProps;
  };
}

export const newWebSocket = (onMessage: (data: MessageData) => void) => {
  let ws: WebSocket | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let intentionallyClosed = false;

  const connect = () => {
    if (intentionallyClosed) {
      log('WebSocket intentionally closed, not reconnecting');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const wsUrl = token ? `ws://${baseUrl}?token=${token}` : `ws://${baseUrl}`;

      log('WebSocket connecting to:', wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        log('WebSocket connected successfully');
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      };

      ws.onclose = (event) => {
        log('WebSocket closed:', event.code, event.reason);
        ws = null;

        if (!intentionallyClosed) {
          log('WebSocket reconnecting in 3 seconds...');
          reconnectTimeout = setTimeout(() => {
            log('WebSocket attempting reconnect');
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        log('WebSocket error:', error);
      };

      ws.onmessage = (messageEvent) => {
        try {
          log('WebSocket message received');
          const data = JSON.parse(messageEvent.data);
          onMessage(data);
        } catch (error) {
          log('WebSocket message parse error:', error);
        }
      };
    } catch (error) {
      log('WebSocket connection error:', error);
      if (!intentionallyClosed) {
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      }
    }
  };

  connect();

  return () => {
    log('WebSocket cleanup called');
    intentionallyClosed = true;

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }
  };
}
