import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { Octokit } from 'octokit';

export function createGithubTeamCreateAction(options: {
  integrations: ScmIntegrationRegistry;
}) {
  const { integrations } = options;

  return createTemplateAction({
    id: 'github:team:create',
    description: 'Creates a GitHub team in an organization',
    schema: {
      input: {
        organization: (z: any) => z.string({
          description: 'GitHub organization name'
        }),
        teamName: (z: any) => z.string({
          description: 'Name of the team to create'
        }),
        description: (z: any) => z.string({
          description: 'Team description'
        }).optional(),
        privacy: (z: any) => z.enum(['closed', 'secret'], {
          description: 'Team privacy level'
        }).default('closed').optional(),
        members: (z: any) => z.array(z.object({
          username: z.string({
            description: 'GitHub username'
          }),
          role: z.enum(['member', 'maintainer'], {
            description: 'Team role'
          }).default('member').optional()
        }), {
          description: 'Team members to add'
        }).optional(),
        token: (z: any) => z.string({
          description: 'GitHub token (optional)'
        }).optional()
      },
      output: {
        teamId: (z: any) => z.number({
          description: 'Created team ID'
        }),
        teamUrl: (z: any) => z.string({
          description: 'Team URL'
        }),
        teamSlug: (z: any) => z.string({
          description: 'Team slug'
        })
      }
    },
    async handler(ctx) {
      const { input, output } = ctx;
      
      ctx.logger.info(`Creating GitHub team: ${input.teamName} in organization: ${input.organization}`);

      // Get GitHub integration config
      const githubIntegration = integrations.github.byHost('github.com');
      if (!githubIntegration) {
        throw new Error('GitHub integration not configured');
      }

      // Use provided token or fall back to integration config
      const token = input.token || githubIntegration.config.token;
      if (!token) {
        throw new Error('GitHub token not provided and not configured in integration');
      }

      // Create Octokit client
      const octokit = new Octokit({
        auth: token,
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
              ctx.logger.info(`Added ${member.username} as ${member.role || 'member'}`);
            } catch (error) {
              ctx.logger.warn(`Failed to add member ${member.username}: ${error}`);
              // Continue with other members rather than failing completely
            }
          }
        }

        // Set outputs
        output('teamId', team.id);
        output('teamUrl', team.html_url);
        output('teamSlug', team.slug);

        ctx.logger.info(`GitHub team creation completed successfully`);

      } catch (error) {
        ctx.logger.error(`Failed to create GitHub team: ${error}`);
        throw new Error(`GitHub team creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
}