import { createGithubTeamCreateAction } from './githubTeam';
import { getVoidLogger } from '@backstage/backend-common';
import { ConfigReader } from '@backstage/config';
import { ScmIntegrations, DefaultGithubCredentialsProvider } from '@backstage/integration';
import { PassThrough } from 'stream';

// Mock Octokit
const mockOctokit = {
  rest: {
    teams: {
      create: jest.fn(),
      addOrUpdateMembershipForUserInOrg: jest.fn(),
    },
  },
};

jest.mock('octokit', () => ({
  Octokit: jest.fn(() => mockOctokit),
}));

// Mock the credentials provider to avoid authentication complexity in tests
const mockCredentialsProvider = {
  getCredentials: jest.fn().mockResolvedValue({
    token: 'mock-github-token',
    headers: { Authorization: 'Bearer mock-github-token' },
    type: 'app',
  }),
};

// Mock the ScmIntegrations to return a simple config
const mockIntegrations = {
  github: {
    byHost: jest.fn().mockReturnValue({
      config: {
        host: 'github.com',
        apiBaseUrl: 'https://api.github.com',
        token: undefined,
      },
    }),
  },
};

describe('createGithubTeamCreateAction', () => {
  const mockContext = {
    logger: getVoidLogger(),
    logStream: new PassThrough(),
    output: jest.fn(),
    createTemporaryDirectory: jest.fn(),
    checkpoint: jest.fn(),
    getInitiatorCredentials: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.output.mockClear();
  });

  describe('Action Creation', () => {
    it('should create GitHub team action with correct properties', () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });
      
      expect(action).toBeDefined();
      expect(action.id).toBe('github:team:create');
      expect(action.description).toBe('Creates a GitHub team in an organization');
      expect(action.schema).toBeDefined();
      expect(action.schema.input).toBeDefined();
      expect(action.schema.output).toBeDefined();
    });

    it('should have correct input schema properties', () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });
      
      const inputSchema = action.schema.input;
      expect(inputSchema.properties).toHaveProperty('organization');
      expect(inputSchema.properties).toHaveProperty('teamName');
      expect(inputSchema.properties).toHaveProperty('description');
      expect(inputSchema.properties).toHaveProperty('privacy');
      expect(inputSchema.properties).toHaveProperty('members');
      expect(inputSchema.properties).toHaveProperty('token');
    });

    it('should have correct output schema properties', () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });
      
      const outputSchema = action.schema.output;
      expect(outputSchema.properties).toHaveProperty('teamId');
      expect(outputSchema.properties).toHaveProperty('teamUrl');
      expect(outputSchema.properties).toHaveProperty('teamSlug');
      expect(outputSchema.properties).toHaveProperty('membersAdded');
      expect(outputSchema.properties).toHaveProperty('membersFailed');
    });
  });

  describe('Team Creation - Happy Path', () => {
    beforeEach(() => {
      // Mock successful team creation
      mockOctokit.rest.teams.create.mockResolvedValue({
        data: {
          id: 12345,
          name: 'test-team',
          slug: 'test-team',
          html_url: 'https://github.com/orgs/test-org/teams/test-team',
        },
      });
    });

    it('should create basic team without members', async () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'test-team',
        description: 'Test team',
        privacy: 'closed' as const,
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockOctokit.rest.teams.create).toHaveBeenCalledWith({
        org: 'test-org',
        name: 'test-team',
        description: 'Test team',
        privacy: 'closed',
      });

      expect(mockContext.output).toHaveBeenCalledWith('teamId', 12345);
      expect(mockContext.output).toHaveBeenCalledWith('teamUrl', 'https://github.com/orgs/test-org/teams/test-team');
      expect(mockContext.output).toHaveBeenCalledWith('teamSlug', 'test-team');
      expect(mockContext.output).toHaveBeenCalledWith('membersAdded', []);
      expect(mockContext.output).toHaveBeenCalledWith('membersFailed', []);
    });

    it('should create secret team', async () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'secret-team',
        description: 'Secret team',
        privacy: 'secret' as const,
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockOctokit.rest.teams.create).toHaveBeenCalledWith({
        org: 'test-org',
        name: 'secret-team',
        description: 'Secret team',
        privacy: 'secret',
      });
    });

    it('should create team with default privacy when not specified', async () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'default-team',
        description: 'Default team',
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockOctokit.rest.teams.create).toHaveBeenCalledWith({
        org: 'test-org',
        name: 'default-team',
        description: 'Default team',
        privacy: 'closed',
      });
    });
  });

  describe('Team Creation with Members', () => {
    beforeEach(() => {
      mockOctokit.rest.teams.create.mockResolvedValue({
        data: {
          id: 12345,
          name: 'test-team',
          slug: 'test-team',
          html_url: 'https://github.com/orgs/test-org/teams/test-team',
        },
      });
    });

    it('should create team and add members successfully', async () => {
      mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg.mockResolvedValue({
        data: { state: 'active' },
      });

      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'team-with-members',
        description: 'Team with members',
        privacy: 'closed' as const,
        members: [
          { username: 'user1', role: 'member' as const },
          { username: 'user2', role: 'maintainer' as const },
        ],
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg).toHaveBeenCalledTimes(2);
      expect(mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg).toHaveBeenCalledWith({
        org: 'test-org',
        team_slug: 'test-team',
        username: 'user1',
        role: 'member',
      });
      expect(mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg).toHaveBeenCalledWith({
        org: 'test-org',
        team_slug: 'test-team',
        username: 'user2',
        role: 'maintainer',
      });

      expect(mockContext.output).toHaveBeenCalledWith('membersAdded', [
        { username: 'user1', role: 'member' },
        { username: 'user2', role: 'maintainer' },
      ]);
      expect(mockContext.output).toHaveBeenCalledWith('membersFailed', []);
    });

    it('should handle mixed success/failure when adding members', async () => {
      mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg
        .mockResolvedValueOnce({ data: { state: 'active' } })
        .mockRejectedValueOnce(new Error('User not found'));

      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'team-mixed-results',
        description: 'Team with mixed member results',
        privacy: 'closed' as const,
        members: [
          { username: 'validuser', role: 'member' as const },
          { username: 'invaliduser', role: 'maintainer' as const },
        ],
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockContext.output).toHaveBeenCalledWith('membersAdded', [
        { username: 'validuser', role: 'member' },
      ]);
      expect(mockContext.output).toHaveBeenCalledWith('membersFailed', [
        { username: 'invaliduser', role: 'maintainer', error: 'User not found' },
      ]);
    });

    it('should default member role to "member" when not specified', async () => {
      mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg.mockResolvedValue({
        data: { state: 'active' },
      });

      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'team-default-role',
        members: [
          { username: 'user1' }, // No role specified
        ],
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg).toHaveBeenCalledWith({
        org: 'test-org',
        team_slug: 'test-team',
        username: 'user1',
        role: 'member',
      });

      expect(mockContext.output).toHaveBeenCalledWith('membersAdded', [
        { username: 'user1', role: 'member' },
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when organization is not provided', async () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        teamName: 'test-team',
        description: 'Test team',
      };

      await expect(action.handler({
        ...mockContext,
        input: input as any,
      })).rejects.toThrow('Organization name is required but was not provided');
    });

    it('should throw error when team creation fails', async () => {
      mockOctokit.rest.teams.create.mockRejectedValue(
        new Error('Validation Failed: Name must be unique for this org')
      );

      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'duplicate-team',
        description: 'Duplicate team',
      };

      await expect(action.handler({
        ...mockContext,
        input,
      })).rejects.toThrow('GitHub team creation failed: Validation Failed: Name must be unique for this org');
    });

    it('should handle authentication errors gracefully', async () => {
      // Mock authentication failure
      const failingCredentialsProvider = {
        getCredentials: jest.fn().mockRejectedValue(new Error('GitHub App not installed on organization')),
      };

      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: failingCredentialsProvider as any
      });

      const input = {
        organization: 'unauthorized-org',
        teamName: 'test-team',
      };

      await expect(action.handler({
        ...mockContext,
        input,
      })).rejects.toThrow('Failed to authenticate with GitHub for organization \'unauthorized-org\': GitHub App not installed on organization');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      mockOctokit.rest.teams.create.mockResolvedValue({
        data: {
          id: 12345,
          name: 'test-team',
          slug: 'test-team',
          html_url: 'https://github.com/orgs/test-org/teams/test-team',
        },
      });
    });

    it('should handle empty members array', async () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'team-no-members',
        members: [],
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg).not.toHaveBeenCalled();
      expect(mockContext.output).toHaveBeenCalledWith('membersAdded', []);
      expect(mockContext.output).toHaveBeenCalledWith('membersFailed', []);
    });

    it('should handle undefined members', async () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'team-undefined-members',
        members: undefined,
      };

      await action.handler({
        ...mockContext,
        input,
      });

      expect(mockOctokit.rest.teams.addOrUpdateMembershipForUserInOrg).not.toHaveBeenCalled();
      expect(mockContext.output).toHaveBeenCalledWith('membersAdded', []);
      expect(mockContext.output).toHaveBeenCalledWith('membersFailed', []);
    });
  });

  describe('Integration Configuration', () => {
    it('should work with different integration configurations', () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any 
      });
      
      expect(action).toBeDefined();
      expect(action.id).toBe('github:team:create');
    });

    it('should work without credentials provider', () => {
      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any 
      });
      
      expect(action).toBeDefined();
      expect(action.id).toBe('github:team:create');
    });
  });

  describe('User-provided Token', () => {
    it('should use user-provided token when available', async () => {
      mockOctokit.rest.teams.create.mockResolvedValue({
        data: {
          id: 12345,
          name: 'test-team',
          slug: 'test-team',
          html_url: 'https://github.com/orgs/test-org/teams/test-team',
        },
      });

      const action = createGithubTeamCreateAction({ 
        integrations: mockIntegrations as any, 
        githubCredentialsProvider: mockCredentialsProvider as any
      });

      const input = {
        organization: 'test-org',
        teamName: 'test-team',
        description: 'Test team',
        token: 'user-provided-token',
      };

      await action.handler({
        ...mockContext,
        input,
      });

      // Should not call the credentials provider when token is provided
      expect(mockCredentialsProvider.getCredentials).not.toHaveBeenCalled();
      expect(mockOctokit.rest.teams.create).toHaveBeenCalled();
    });
  });
});