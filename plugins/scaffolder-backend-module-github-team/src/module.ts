import { createBackendModule, coreServices } from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint  } from '@backstage/plugin-scaffolder-node/alpha';
import { createGithubTeamCreateAction } from "./actions/githubTeam";
import { ScmIntegrations, DefaultGithubCredentialsProvider } from '@backstage/integration';
/**
 * A backend module that registers the action into the scaffolder
 */
export const scaffolderModule = createBackendModule({
  moduleId: 'github-team',
  pluginId: 'scaffolder',
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolderActions: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig
      },
      async init({ scaffolderActions, config }) {
        const integrations = ScmIntegrations.fromConfig(config);
        const githubCredentialsProvider = DefaultGithubCredentialsProvider.fromIntegrations(integrations);
        scaffolderActions.addActions(
          createGithubTeamCreateAction({ 
            integrations, 
            githubCredentialsProvider 
          })
        );
      }
    });
  },
})
