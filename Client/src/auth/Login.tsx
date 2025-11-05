import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonInput, IonButton, IonItem, IonLabel, IonLoading, IonText } from '@ionic/react';

const Login: React.FC<{ onLogin: (token: string) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      setError('Un utilizator este deja logat. Fă logout din alt tab sau refresh pagina.');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    

    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      setError('Un utilizator este deja logat. Fă logout din alt tab sau refresh pagina.');
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Eroare autentificare!');
      const data = await res.json();
      if (!data || !data.token) throw new Error('Răspuns invalid de la server!');
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message || 'Eroare la login');
    }
    setLoading(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Login</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={handleLogin}>
          <IonItem>
            <IonLabel position="stacked">Username</IonLabel>
            <IonInput value={username} onIonChange={e => setUsername(e.detail.value!)} required autoCapitalize="off" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Password</IonLabel>
            <IonInput value={password} onIonChange={e => setPassword(e.detail.value!)} type="password" required />
          </IonItem>
          {error && <IonText color="danger"><p>{error}</p></IonText>}
          <IonButton expand="block" type="submit" disabled={loading} style={{ marginTop: 16 }}>Login</IonButton>
          
          {error && error.includes('deja logat') && (
            <IonButton 
              expand="block" 
              color="warning" 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{ marginTop: 8 }}
            >
              Forțează Logout din toate tab-urile
            </IonButton>
          )}
        </form>
        <IonLoading isOpen={loading} message={"Authenticating..."} />
      </IonContent>
    </IonPage>
  );
};

export default Login;
