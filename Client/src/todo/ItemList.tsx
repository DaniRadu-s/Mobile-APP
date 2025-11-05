import React, { useContext, useState, useEffect, useMemo } from 'react';
import { RouteComponentProps } from 'react-router';
import {
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonList,
  IonLoading,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonButton,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { getLogger } from '../core';
import { ItemContext } from './ItemProvider';

const log = getLogger('ItemList');

const ItemList: React.FC<RouteComponentProps & { handleLogout: () => void }> = ({ history, handleLogout }) => {
  const { items, fetching, fetchingError, deleteItem } = useContext(ItemContext);

  const [serverOnline, setServerOnline] = useState(true);
  const [internetOnline, setInternetOnline] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const [displayedCount, setDisplayedCount] = useState(12);
  const ITEMS_INCREMENT = 12;

  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase());

      const matchesFilter = filter === "all" ||
          (filter === "cinema" && item.cinema) ||
          (filter === "streaming" && !item.cinema);

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  // Elemente vizibile bazate pe displayedCount
  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, displayedCount);
  }, [filteredItems, displayedCount]);

  const hasMore = displayedCount < filteredItems.length;

  useEffect(() => {
    let cancelled = false;
    const pingServer = async () => {
      try {
        const res = await fetch('http://localhost:3000/ping', { cache: 'no-store' });
        if (!cancelled && res.ok) {
          setServerOnline(true);
        } else if (!cancelled) {
          setServerOnline(false);
        }
      } catch {
        if (!cancelled) setServerOnline(false);
      }
    };
    pingServer();
    const interval = setInterval(pingServer, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pingInternet = async () => {
      try {
        await fetch('https://1.1.1.1', { mode: 'no-cors' });
        if (!cancelled) setInternetOnline(true);
      } catch {
        if (!cancelled) setInternetOnline(false);
      }
    };
    pingInternet();
    const interval = setInterval(pingInternet, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    setDisplayedCount(12);
  }, [search, filter]);

  const reallyOffline = !serverOnline || !internetOnline;

  log('render');

  return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ textAlign: 'center' }}> Movies </IonTitle>
            <IonButton color='medium' size='small' slot="end" onClick={handleLogout}>Logout</IonButton>
          </IonToolbar>
        </IonHeader>

        {/* Search și Filter - după IonToolbar, înainte de IonContent */}
        <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
          <input
              type="text"
              placeholder="Search movies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #ccc'
              }}
          />

          <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #ccc'
              }}
          >
            <option value="all">All Movies</option>
            <option value="cinema">In cinema</option>
            <option value="streaming">Not in cinema</option>
          </select>
        </div>

        <IonContent
            fullscreen
            scrollEvents={true}
            style={{
              overflowY: 'auto',
              height: '80vh', // sau 100% - 100px dacă vrei să compensezi headerul
            }}>
          {reallyOffline && (
              <IonItem color="warning">
                <IonLabel>
                  Offline mode — changes will sync later
                  {!internetOnline && ' (no Internet connection)'}
                  {!serverOnline && ' (server not reachable)'}
                </IonLabel>
              </IonItem>
          )}

          <IonLoading isOpen={fetching} message="Fetching items" />

          {visibleItems && (
              <IonList inset={true}>
                <IonItem>
                  <IonLabel>Name</IonLabel>
                  <IonLabel>Description</IonLabel>
                  <IonLabel>Price</IonLabel>
                  <IonLabel>Cinema</IonLabel>
                  <IonLabel>Actions</IonLabel>
                </IonItem>

                {visibleItems.map(({ id, name, description, cinema, price }) => (
                    <IonItem key={id}>
                      <IonLabel>{name}</IonLabel>
                      <IonLabel>{description}</IonLabel>
                      <IonLabel>{price}</IonLabel>
                      <IonLabel>{cinema ? 'Yes' : 'No'}</IonLabel>

                      <IonButton color="primary" onClick={() => history.push(`/item/${id}`)}>
                        Edit
                      </IonButton>
                      <IonButton color="danger" onClick={() => deleteItem && deleteItem(id || '')}>
                        Delete
                      </IonButton>
                    </IonItem>
                ))}
              </IonList>
          )}

          {fetchingError && (
              <div>{fetchingError.message || 'Failed to fetch items'}</div>
          )}

          <div style={{ textAlign: 'center', padding: '8px', fontSize: '14px', color: '#666' }}>
            Showing {visibleItems.length} of {filteredItems.length} movies
          </div>

          <IonInfiniteScroll
              key={`${search}-${filter}`}
              threshold="100px"
              disabled={!hasMore}
              onIonInfinite={(e) => {
                setDisplayedCount(prev => prev + ITEMS_INCREMENT);

                setTimeout(() => {
                  e.target.complete();
                }, 500);
              }}
          >
            <IonInfiniteScrollContent
                loadingText="Loading more movies..."
            />
          </IonInfiniteScroll>

          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton onClick={() => history.push('/item')}>
              <IonIcon icon={add} />
            </IonFabButton>
          </IonFab>

          {/* Indicator status rețea ca cerc lângă butonul + */}
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '100px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: !reallyOffline ? '#2dd36f' : '#eb445a',
            border: '2px solid white',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }} title={!reallyOffline ? 'Online' : 'Offline'}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: 'white'
            }} />
          </div>
        </IonContent>
      </IonPage>
  );
};

export default ItemList;
