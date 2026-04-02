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
      href: '/notebooks/workspaces',
      section: 'ai-hub',
      path: '/notebooks/workspaces/*',
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
      href: '/notebooks/workspacekinds',
      section: 'ai-hub',
      path: '/notebooks/workspacekinds/*',
      group: '1_aihub',
    },
  },
  {
    type: 'app.route',
    flags: {
      required: [NOTEBOOKS_V2],
    },
    properties: {
      path: '/notebooks/*',
      component: () => import('./NotebooksWrapper'),
    },
  },
];

export default extensions;
