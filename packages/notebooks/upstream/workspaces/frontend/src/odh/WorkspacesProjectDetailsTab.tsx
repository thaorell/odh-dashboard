/* eslint-disable @cspell/spellchecker */
import React, { useMemo } from 'react';
import {
  ModularArchContextProvider,
  BrowserStorageContextProvider,
  NotificationContextProvider,
  DeploymentMode,
} from 'mod-arch-core';
import { ThemeProvider, Theme } from 'mod-arch-kubeflow';
import { AppContextProvider } from '~/app/context/AppContext';
import { NotebookContextProvider } from '~/app/context/NotebookContext';
import { WorkspacesWrapper } from '~/app/pages/Workspaces/WorkspacesWrapper';
import { BFF_API_VERSION, URL_PREFIX } from '~/shared/utilities/const';
import ToastNotifications from '~/app/standalone/ToastNotifications';

type WorkspacesProjectDetailsTabProps = {
  namespace?: string;
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
      <ThemeProvider theme={Theme.Patternfly}>
        <BrowserStorageContextProvider>
          <NotificationContextProvider>
            <AppContextProvider>
              <NotebookContextProvider>
                <WorkspacesWrapper />
                <ToastNotifications />
              </NotebookContextProvider>
            </AppContextProvider>
          </NotificationContextProvider>
        </BrowserStorageContextProvider>
      </ThemeProvider>
    </ModularArchContextProvider>
  );
};

export default WorkspacesProjectDetailsTab;
