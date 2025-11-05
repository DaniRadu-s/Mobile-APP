import React, { memo } from 'react';
import { IonItem, IonLabel, IonCheckbox , IonDatetime} from '@ionic/react';
import { ItemProps } from './ItemProps';

interface ItemPropsExt extends ItemProps {
    onEdit: (id?: string) => void;
}

const Item: React.FC<ItemPropsExt> = ({ id, name, description, date, cinema, price, onEdit }) => {
    return (
        <IonItem onClick={() => onEdit(id)}>
            <IonLabel>{name}</IonLabel>
            <IonLabel>{description}</IonLabel>
            <IonLabel>{price.toFixed(2)} $</IonLabel>
            <IonCheckbox checked={cinema}>In cinema</IonCheckbox>
        </IonItem>
    );
};

export default memo(Item);
