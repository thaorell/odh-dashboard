import React from 'react';
import {
  BrowserStorageContextProvider,
  NotificationContextProvider,
  ModularArchContextProvider,
  ModularArchConfig,
  DeploymentMode,
  useSettings,
} from 'mod-arch-core';
import { ThemeProvider, Theme } from 'mod-arch-kubeflow';
import { Bullseye, Spinner } from '@patternfly/react-core';
import AppRoutes from '~/app/AppRoutes';
import { NotebookContextProvider } from '~/app/context/NotebookContext';
import { BFF_API_VERSION, MANDATORY_NAMESPACE, URL_PREFIX } from '~/shared/utilities/const';
import { AppContext } from '~/app/context/AppContext';
import ToastNotifications from '~/app/standalone/ToastNotifications';

const NotebooksWrapperContent: React.FC = () => {
  const { configSettings, userSettings, loaded, loadError } = useSettings();

  if (loadError) {
    return (
      <Bullseye>
        <div>Error loading settings: {loadError.message}</div>
      </Bullseye>
    );
  }

  if (!loaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  return configSettings && userSettings ? (
    <AppContext.Provider
      value={{
        config: configSettings,
        user: userSettings,
      }}
    >
      <ThemeProvider theme={Theme.Patternfly}>
        <BrowserStorageContextProvider>
          <NotificationContextProvider>
            <NotebookContextProvider>
              <AppRoutes />
              <ToastNotifications />
            </NotebookContextProvider>
          </NotificationContextProvider>
        </BrowserStorageContextProvider>
      </ThemeProvider>
    </AppContext.Provider>
  ) : null;
};

const NotebooksWrapper: React.FC = () => {
  const modularArchConfig: ModularArchConfig = {
    deploymentMode: DeploymentMode.Federated,
    URL_PREFIX,
    BFF_API_VERSION,
    mandatoryNamespace: MANDATORY_NAMESPACE,
  };

  return (
    <ModularArchContextProvider config={modularArchConfig}>
      <NotebooksWrapperContent />
    </ModularArchContextProvider>
  );
};

export default NotebooksWrapper;
