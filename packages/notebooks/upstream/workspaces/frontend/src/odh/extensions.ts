import type {
  AreaExtension,
  NavExtension,
  RouteExtension,
} from '@odh-dashboard/plugin-core/extension-points';

// This must match SupportedArea.NOTEBOOKS_V2 in frontend/src/concepts/areas/types.ts
const NOTEBOOKS_V2 = 'notebooks-v2';

const extensions: (NavExtension | RouteExtension | AreaExtension)[] = [
  {
    type: 'app.area',
    properties: {
      id: NOTEBOOKS_V2,
      featureFlags: ['notebooksV2'],
    },
  },
  {
    type: 'app.navigation/href',
    flags: {
      required: [NOTEBOOKS_V2],
    },
    properties: {
      id: 'notebooks-kf-workspaces',
      title: 'Workspaces',
      href: '/workspaces',
      section: 'ai-hub',
      path: '/workspaces/*',
      group: '1_aihub',
    },
  },
  {
    type: 'app.navigation/href',
    flags: {
      required: [NOTEBOOKS_V2],
    },
    properties: {
      id: 'notebooks-kf-workspacekinds',
      title: 'Workspace Kinds',
      href: '/workspacekinds',
      section: 'ai-hub',
      path: '/workspacekinds/*',
      group: '1_aihub',
    },
  },
  {
    type: 'app.route',
    flags: {
      required: [NOTEBOOKS_V2],
    },
    properties: {
      path: '/workspaces/*',
      component: () => import('./NotebooksWrapper'),
    },
  },
  {
    type: 'app.route',
    flags: {
      required: [NOTEBOOKS_V2],
    },
    properties: {
      path: '/workspacekinds/*',
      component: () => import('./NotebooksWrapper'),
    },
  },
];

export default extensions;
