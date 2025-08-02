import { createBackendPlugin } from '@backstage/backend-plugin-api';

export { createGithubTeamCreateAction } from './actions/githubTeamCreate';

export const githubTeamsPlugin = createBackendPlugin({
  pluginId: 'github-teams',
  register(env) {
    env.registerInit({
      deps: {},
      async init() {
        console.log('GitHub Teams plugin initialized');
        // Action registration will be handled separately in backend setup
      },
    });
  },
});

export default githubTeamsPlugin;