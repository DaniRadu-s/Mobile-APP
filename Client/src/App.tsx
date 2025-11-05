import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useState } from 'react';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';

import { ItemEdit, ItemList } from './todo';
import { ItemProvider } from './todo/ItemProvider';
import Login from './auth/Login';
import OfflineNotification from './components/OfflineNotification';

setupIonicReact();


const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const handleLogin = (token: string) => {
    localStorage.setItem('token', token);
    setToken(token);
    window.location.pathname = '/items';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    window.location.pathname = '/login';
  }
  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <IonApp>
      <ItemProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route path="/items" render={props => <ItemList {...props} handleLogout={handleLogout} />} exact />
            <Route path="/item" component={ItemEdit} exact={true}/>
            <Route path="/item/:id" component={ItemEdit} exact={true}/>
            <Route exact path="/" render={() => <Redirect to="/items"/>}/>
          </IonRouterOutlet>
        </IonReactRouter>
        <OfflineNotification />
      </ItemProvider>
    </IonApp>
  );
};

export default App;
