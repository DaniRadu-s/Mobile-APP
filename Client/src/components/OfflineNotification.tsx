import React, { useEffect, useState } from 'react';
import { IonToast, IonAlert, IonButton, IonIcon } from '@ionic/react';
import { warningOutline, refreshOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { getPendingCount } from '../todo/offline';

const OfflineNotification: React.FC = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncAlert, setShowSyncAlert] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };

    updatePendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      updatePendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleStorageChange = () => {
      updatePendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleSyncNow = () => {
    setShowSyncAlert(true);
  };

  const handleSyncConfirm = () => {
    window.dispatchEvent(new CustomEvent('manual-sync'));
    setLastSyncTime(new Date());
    setShowSyncAlert(false);
  };

  const getToastMessage = (): string | null => {
    if (!isOnline && pendingCount > 0) {
      return `Offline: ${pendingCount} item(s) will sync when connection is restored`;
    } else if (isOnline && pendingCount > 0) {
      return `${pendingCount} item(s) pending sync`;
    }
    return null;
  };

  const getToastColor = (): 'warning' | 'danger' | 'success' => {
    if (!isOnline && pendingCount > 0) {
      return 'warning';
    } else if (isOnline && pendingCount > 0) {
      return 'danger';
    }
    return 'success';
  };

  const message = getToastMessage();
  const color = getToastColor();

  return (
    <>
      {message && (
        <IonToast
          isOpen={!!message}
          message={message}
          duration={3000}
          color={color}
          position="top"
          buttons={[
            {
              text: 'Sync Now',
              handler: handleSyncNow,
              icon: refreshOutline
            },
            {
              text: 'Dismiss',
              role: 'cancel'
            }
          ]}
        />
      )}

      <IonAlert
        isOpen={showSyncAlert}
        onDidDismiss={() => setShowSyncAlert(false)}
        header="Sync Pending Items"
        message={`Do you want to sync ${pendingCount} pending item(s) now?`}
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Sync',
            handler: handleSyncConfirm
          }
        ]}
      />

      {pendingCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          background: !isOnline ? '#ffc409' : '#f04141',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          cursor: 'pointer'
        }}
        onClick={handleSyncNow}
        title={!isOnline ? 'Offline - items will sync when online' : 'Click to sync pending items'}
        >
          <IonIcon 
            icon={!isOnline ? warningOutline : refreshOutline} 
            style={{ fontSize: '16px' }}
          />
          <span>{pendingCount} pending</span>
          <IonButton
            fill="clear"
            size="small"
            style={{ 
              '--color': 'white',
              fontSize: '12px',
              height: '24px',
              margin: '0'
            }}
          >
            Sync
          </IonButton>
        </div>
      )}

      {/* Last sync indicator */}
      {lastSyncTime && pendingCount === 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          background: '#28a745',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <IonIcon 
            icon={checkmarkCircleOutline} 
            style={{ fontSize: '16px' }}
          />
          <span>Synced {lastSyncTime.toLocaleTimeString()}</span>
        </div>
      )}
    </>
  );
};

export default OfflineNotification;
