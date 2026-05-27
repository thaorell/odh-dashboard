/* eslint-disable @cspell/spellchecker */
import React, { useMemo } from 'react';
import {
  ModularArchContextProvider,
  BrowserStorageContextProvider,
  NotificationContextProvider,
  DeploymentMode,
  useSettings,
} from 'mod-arch-core';
import { ThemeProvider, Theme } from 'mod-arch-kubeflow';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import { createMemoryRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { AppContext } from '~/app/context/AppContext';
import { NamespaceContextProvider } from '~/app/context/NamespaceContextProvider';
import { NotebookContextProvider } from '~/app/context/NotebookContext';
import { WorkspacesWrapper } from '~/app/pages/Workspaces/WorkspacesWrapper';
import { WorkspaceForm } from '~/app/pages/Workspaces/Form/WorkspaceForm';
import { AppRoutePaths } from '~/app/routes';
import { BFF_API_VERSION, URL_PREFIX, ROUTES_PREFIX } from '~/shared/utilities/const';
import ToastNotifications from '~/app/standalone/ToastNotifications';

type WorkspacesProjectDetailsTabProps = {
  namespace?: string;
};

const ContextLayout: React.FC<{ contextValue: { config: unknown; user: unknown } }> = ({
  contextValue,
}) => (
  <AppContext.Provider value={contextValue}>
    <ThemeProvider theme={Theme.Patternfly}>
      <BrowserStorageContextProvider>
        <NotificationContextProvider>
          <NotebookContextProvider>
            <NamespaceContextProvider>
              <Outlet />
              <ToastNotifications />
            </NamespaceContextProvider>
          </NotebookContextProvider>
        </NotificationContextProvider>
      </BrowserStorageContextProvider>
    </ThemeProvider>
  </AppContext.Provider>
);

const WorkspacesProjectDetailsTabContent: React.FC = () => {
  const { configSettings, userSettings, loaded, loadError } = useSettings();

  const contextValue = useMemo(
    () => ({
      config: configSettings,
      user: userSettings,
    }),
    [configSettings, userSettings],
  );

  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            element: <ContextLayout contextValue={contextValue} />,
            children: [
              { path: AppRoutePaths.workspaceCreate, element: <WorkspaceForm /> },
              { path: AppRoutePaths.workspaceEdit, element: <WorkspaceForm /> },
              { path: AppRoutePaths.workspaces, element: <WorkspacesWrapper /> },
              {
                path: AppRoutePaths.root,
                element: <Navigate to={AppRoutePaths.workspaces} replace />,
              },
              { path: '*', element: <WorkspacesWrapper /> },
            ],
          },
        ],
        {
          initialEntries: [`${ROUTES_PREFIX}${AppRoutePaths.workspaces}`],
          basename: ROUTES_PREFIX,
        },
      ),
    [contextValue],
  );

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

  return configSettings && userSettings ? <RouterProvider router={router} /> : null;
};

const WorkspacesProjectDetailsTab: React.FC<WorkspacesProjectDetailsTabProps> = ({ namespace }) => {
  const config = useMemo(
    () => ({
      deploymentMode: DeploymentMode.Federated,
      URL_PREFIX,
      BFF_API_VERSION,
      mandatoryNamespace: namespace,
    }),
    [namespace],
  );

  return (
    <ModularArchContextProvider config={config}>
      <WorkspacesProjectDetailsTabContent />
    </ModularArchContextProvider>
  );
};

export default WorkspacesProjectDetailsTab;
