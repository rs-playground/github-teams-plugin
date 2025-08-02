import { createBackendPlugin } from '@backstage/backend-plugin-api';

export const examplePlugin = createBackendPlugin({
  pluginId: 'example',
  register(env) {
    env.registerInit({
      deps: {},
      async init() {
        // Plugin initialization logic here
        console.log('Example plugin initialized');
      },
    });
  },
});

export default examplePlugin;