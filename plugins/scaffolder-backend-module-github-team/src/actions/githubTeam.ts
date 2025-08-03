import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { ScmIntegrationRegistry, GithubCredentialsProvider, DefaultGithubCredentialsProvider } from '@backstage/integration';
import { InputError } from '@backstage/errors';
import { Octokit } from 'octokit';

/**
 * Custom getOctokitOptions function for organization-level operations.
 * Unlike the built-in getOctokitOptions, this doesn't require a repo name
 * for GitHub App authentication since team operations are organization-level.
 */
async function getOctokitOptionsForOrg(options: {
  integrations: ScmIntegrationRegistry;
  credentialsProvider?: GithubCredentialsProvider;
  token?: string;
  host: string;
  owner: string;
}) {
  const { integrations, credentialsProvider, token, host, owner } = options;
  
  // Get the integration config for this host
  const integrationConfig = integrations.github.byHost(host)?.config;
  if (!integrationConfig) {
    throw new InputError(`No integration for host ${host}`);
  }

  const requestOptions = {
    // Set timeout to 60 seconds (matching Backstage default)
    timeout: 60000
  };

  // If a token is provided, use it directly
  if (token) {
    return {
      auth: token,
      baseUrl: integrationConfig.apiBaseUrl,
      previews: ["nebula-preview"],
      request: requestOptions
    };
  }

  // Ensure we have an owner for organization-level operations
  if (!owner) {
    throw new InputError(
      'No organization/owner provided, which is required for GitHub App authentication'
    );
  }

  // Use the credentials provider with organization-only URL
  const githubCredentialsProvider = credentialsProvider ?? 
    DefaultGithubCredentialsProvider.fromIntegrations(integrations);
  
  const { token: credentialProviderToken } = await githubCredentialsProvider.getCredentials({
    url: `https://${host}/${encodeURIComponent(owner)}`
  });

  if (!credentialProviderToken) {
    throw new InputError(
      `No token available for host: ${host}, with owner ${owner}. Make sure GitHub App is installed on the organization.`
    );
  }

  return {
    auth: credentialProviderToken,
    baseUrl: integrationConfig.apiBaseUrl,
    previews: ["nebula-preview"],
    request: requestOptions
  };
}

export function createGithubTeamCreateAction(options: {
  integrations: ScmIntegrationRegistry;
  githubCredentialsProvider?: GithubCredentialsProvider;
}) {
  const { integrations, githubCredentialsProvider } = options;

  return createTemplateAction({
    id: 'github:team:create',
    description: 'Creates a GitHub team in an organization',
    schema: {
      input: {
        organization: (z) => z.string({
          description: 'GitHub organization name'
        }),
        teamName: (z) => z.string({
          description: 'Name of the team to create'
        }),
        description: (z) => z.string({
          description: 'Team description'
        }).optional(),
        privacy: (z) => z.enum(['closed', 'secret'], {
          description: 'Team privacy level'
        }).default('closed').optional(),
        members: (z) => z.array(z.object({
          username: z.string({
            description: 'GitHub username'
          }),
          role: z.enum(['member', 'maintainer'], {
            description: 'Team role'
          }).default('member').optional()
        }), {
          description: 'Team members to add'
        }).optional(),
        token: (z) => z.string({
          description: 'GitHub token (optional)'
        }).optional()
      },
      output: {
        teamId: (z) => z.number({
          description: 'Created team ID'
        }),
        teamUrl: (z) => z.string({
          description: 'Team URL'
        }),
        teamSlug: (z) => z.string({
          description: 'Team slug'
        }),
        membersAdded: (z) => z.array(z.object({
          username: z.string(),
          role: z.string()
        })).describe('Successfully added team members'),
        membersFailed: (z) => z.array(z.object({
          username: z.string(),
          role: z.string(),
          error: z.string()
        })).describe('Failed team member additions with error details')
      }
    },
    async handler(ctx) {
      const { input, output } = ctx;
      
      ctx.logger.info(`Creating GitHub team: ${input.teamName} in organization: ${input.organization}`);

      // Validate required parameters
      if (!input.organization) {
        throw new Error('Organization name is required but was not provided');
      }

      ctx.logger.info(`Getting GitHub credentials for organization: ${input.organization}`);
      ctx.logger.info(`GitHub credentials provider available: ${!!githubCredentialsProvider}`);
      ctx.logger.info(`User provided token: ${!!input.token}`);

      // Get Octokit options with proper authentication handling
      let octokitOptions;
      
      // Use our custom organization-level authentication (no repo required!)
      ctx.logger.info(`Using organization-level authentication for: ${input.organization}`);
      
      try {
        octokitOptions = await getOctokitOptionsForOrg({
          integrations,
          credentialsProvider: githubCredentialsProvider,
          token: input.token,
          host: 'github.com',
          owner: input.organization,
        });

        ctx.logger.info(`Successfully obtained Octokit options`);
      } catch (error) {
        ctx.logger.error(`Failed to get GitHub credentials for organization: ${error}`);
        throw new Error(`Failed to authenticate with GitHub for organization '${input.organization}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Create Octokit client
      const octokit = new Octokit({
        ...octokitOptions,
        log: ctx.logger,
      });

      try {
        // Create the team
        ctx.logger.info(`Creating team with privacy: ${input.privacy || 'closed'}`);
        const teamResponse = await octokit.rest.teams.create({
          org: input.organization,
          name: input.teamName,
          description: input.description,
          privacy: input.privacy || 'closed',
        });

        const team = teamResponse.data;
        ctx.logger.info(`Team created successfully: ${team.name} (ID: ${team.id})`);

        // Add members to the team if provided
        const memberResults: {
          added: Array<{ username: string; role: string }>;
          failed: Array<{ username: string; role: string; error: string }>;
        } = { added: [], failed: [] };
        if (input.members && input.members.length > 0) {
          ctx.logger.info(`Adding ${input.members.length} members to the team`);
          
          for (const member of input.members) {
            try {
              await octokit.rest.teams.addOrUpdateMembershipForUserInOrg({
                org: input.organization,
                team_slug: team.slug,
                username: member.username,
                role: member.role || 'member',
              });
              memberResults.added.push({
                username: member.username,
                role: member.role || 'member'
              });
              ctx.logger.info(`✅ Added ${member.username} as ${member.role || 'member'}`);
            } catch (error) {
              memberResults.failed.push({
                username: member.username,
                role: member.role || 'member',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              ctx.logger.warn(`❌ Failed to add member ${member.username}: ${error}`);
              // Continue with other members rather than failing completely
            }
          }
          
          // Log summary of member operations
          if (memberResults.added.length > 0) {
            ctx.logger.info(`Successfully added ${memberResults.added.length} members: ${memberResults.added.map(m => m.username).join(', ')}`);
          }
          if (memberResults.failed.length > 0) {
            ctx.logger.warn(`Failed to add ${memberResults.failed.length} members: ${memberResults.failed.map(m => m.username).join(', ')}`);
          }
        }

        // Set outputs
        output('teamId', team.id);
        output('teamUrl', team.html_url);
        output('teamSlug', team.slug);
        output('membersAdded', memberResults.added);
        output('membersFailed', memberResults.failed);

        ctx.logger.info(`GitHub team creation completed successfully`);

      } catch (error) {
        ctx.logger.error(`Failed to create GitHub team: ${error}`);
        throw new Error(`GitHub team creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
}
