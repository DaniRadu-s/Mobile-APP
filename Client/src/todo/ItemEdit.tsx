import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonLoading,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCheckbox
} from '@ionic/react';
import { getLogger } from '../core';
import { ItemContext } from './ItemProvider';
import { RouteComponentProps } from 'react-router';
import { ItemProps } from './ItemProps'; // sau MovieProps dacă ai redenumit

const log = getLogger('ItemEdit');

interface ItemEditProps extends RouteComponentProps<{
  id?: string;
}> {}

const ItemEdit: React.FC<ItemEditProps> = ({ history, match }) => {
  const { items, saving, savingError, saveItem } = useContext(ItemContext);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [cinema, setCinema] = useState(false);
  const [price, setPrice] = useState(0);
  const [item, setItem] = useState<ItemProps>();
  const [dirty, setDirty] = useState(false);
  // Adaugă acest state
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    log('useEffect: update form values la schimbare id');
    const routeId = match.params.id || '';
    const foundItem = items?.find(it =>
        it.id?.toString() === routeId || it._localId?.toString() === routeId
    );

    // Doar încarcă datele inițiale, nu actualiza dacă utilizatorul a modificat deja
    if (foundItem && !initialLoadDone) {
      setItem(foundItem);
      setName(foundItem.name);
      setDescription(foundItem.description);
      setDate(new Date(foundItem.date));
      setCinema(foundItem.cinema);
      setPrice(foundItem.price);
      setDirty(false);
      setInitialLoadDone(true);
    }
    // eslint-disable-next-line
  }, [match.params.id, items]); // Scoate "items" din dependencies!

  // Setează dirty=true la orice modificare locală de input
  const setField = (fn: Function) => (v: any) => { setDirty(true); fn(v); };

  const handleSave = useCallback(() => {
    const editedItem = item
        ? { ...item, name, description, date, cinema, price }
        : { name, description, date, cinema, price };
    saveItem && saveItem(editedItem).then(() => history.goBack());
  }, [item, saveItem, name, description, date, cinema, price, history]);

  const handleCancel = useCallback(() => {
    history.goBack();
  }, [history]);

  log('render');
  return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ textAlign: 'center' }}>Edit Movie</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <IonInput
              placeholder="Name"
              value={name}
              onIonChange={e => setField(setName)(e.detail.value || '')}
          />
          <IonInput
              placeholder="Description"
              value={description}
              onIonChange={e => setField(setDescription)(e.detail.value || '')}
          />
          <IonInput
              type="number"
              placeholder="Price"
              value={price}
              onIonChange={e => setField(setPrice)(parseFloat(e.detail.value || '0'))}
          />
          <IonCheckbox
              checked={cinema}
              onIonChange={e => setField(setCinema)(e.detail.checked)}
          >
            Currently in cinema
          </IonCheckbox>

          <IonLoading isOpen={saving} />

          {savingError && (
              <div>{savingError.message || 'Failed to save movie'}</div>
          )}
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={handleCancel}>Cancel</IonButton>
            </IonButtons>
            <IonButtons slot="end">
              <IonButton onClick={handleSave}>Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonContent>
      </IonPage>
  );
};

export default ItemEdit;
