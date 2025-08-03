# @backstage-community/plugin-scaffolder-backend-module-github-team

A Backstage scaffolder backend module for creating GitHub teams with comprehensive member management.

## Features

- 🏢 **Organization-level operations** - Works with GitHub Apps without requiring repository access
- 👥 **Comprehensive member management** - Add members with specific roles (member/maintainer)
- 🔐 **Flexible authentication** - Supports both personal access tokens and GitHub Apps
- 📊 **Detailed result tracking** - Reports success/failure status for each member addition
- 🛡️ **Privacy control** - Support for both closed and secret team privacy levels
- ✅ **Robust error handling** - Graceful handling of member addition failures

## Installation

### 1. Install the package

```bash
# From the root of your Backstage app
yarn add --cwd packages/backend @backstage-community/plugin-scaffolder-backend-module-github-team
```

### 2. Register the module

Add the module to your Backstage backend in `packages/backend/src/index.ts`:

```typescript
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other modules

// Add the GitHub team scaffolder module
backend.add(import('@backstage-community/plugin-scaffolder-backend-module-github-team'));

backend.start();
```

### 3. Configure GitHub integration

Ensure you have a GitHub integration configured in your `app-config.yaml`:

```yaml
integrations:
  github:
    - host: github.com
      # For GitHub Apps (recommended)
      apps:
        - appId: ${GITHUB_APP_ID}
          clientId: ${GITHUB_APP_CLIENT_ID}
          clientSecret: ${GITHUB_APP_CLIENT_SECRET}
          webhookUrl: ${GITHUB_APP_WEBHOOK_URL}
          webhookSecret: ${GITHUB_APP_WEBHOOK_SECRET}
          privateKey: |
            ${GITHUB_APP_PRIVATE_KEY}
      
      # OR for personal access tokens
      token: ${GITHUB_TOKEN}
```

## Usage

### Action Definition

The module provides the `github:team:create` action with the following schema:

```yaml
action: github:team:create
input:
  organization: string      # Required: GitHub organization name
  teamName: string         # Required: Name of the team to create  
  description?: string     # Optional: Team description
  privacy?: 'closed' | 'secret'  # Optional: Team privacy (default: 'closed')
  members?: Array<{        # Optional: Team members to add
    username: string       # GitHub username
    role: 'member' | 'maintainer'  # Team role (default: 'member')
  }>
```

### Template Example

Create a scaffolder template that uses the action:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: github-team-creator
  title: GitHub Team Creator
  description: Create a GitHub team with specified members
spec:
  owner: user:guest
  type: service
  
  parameters:
    - title: Team Information
      required:
        - organization
        - teamName
      properties:
        organization:
          title: Organization
          type: string
          description: GitHub organization name
        teamName:
          title: Team Name
          type: string
          description: Name of the team to create
        description:
          title: Description
          type: string
          description: Team description
        privacy:
          title: Privacy
          type: string
          enum: [closed, secret]
          default: closed
    
    - title: Team Members
      properties:
        members:
          title: Members
          type: array
          items:
            type: object
            properties:
              username:
                title: GitHub Username
                type: string
              role:
                title: Role
                type: string
                enum: [member, maintainer]
                default: member

  steps:
    - id: create-team
      name: Create GitHub Team
      action: github:team:create
      input:
        organization: ${{ parameters.organization }}
        teamName: ${{ parameters.teamName }}
        description: ${{ parameters.description }}
        privacy: ${{ parameters.privacy }}
        members: ${{ parameters.members }}

  output:
    links:
      - title: Team URL
        url: ${{ steps['create-team'].output.teamUrl }}
    text:
      - title: Team Created
        content: |
          Team **${{ parameters.teamName }}** created successfully!
          - Team ID: ${{ steps['create-team'].output.teamId }}
          - Members added: ${{ steps['create-team'].output.membersAdded | length }}
          - Failures: ${{ steps['create-team'].output.membersFailed | length }}
```

### Action Outputs

The action returns comprehensive information about the created team and member management results:

```typescript
{
  teamId: number;           // GitHub team ID
  teamSlug: string;         // URL-safe team name
  teamUrl: string;          // Direct URL to the team
  membersAdded: Array<{     // Successfully added members
    username: string;
    role: 'member' | 'maintainer';
  }>;
  membersFailed: Array<{    // Failed member additions
    username: string;
    role: 'member' | 'maintainer';
    error: string;          // Error description
  }>;
}
```

## Authentication

### GitHub Apps (Recommended)

This plugin supports organization-level GitHub App authentication, which doesn't require repository access permissions. This is ideal for team management operations that are organization-scoped.

**Required GitHub App Permissions:**
- Organization permissions:
  - Members: Read
  - Administration: Write (for team management)

### Personal Access Tokens

You can also use personal access tokens with the following scopes:
- `admin:org` - For team creation and management
- `read:org` - For organization access

## Configuration Examples

### Using with Environment Variables

```yaml
# app-config.yaml
integrations:
  github:
    - host: github.com
      apps:
        - appId: ${GITHUB_APP_ID}
          clientId: ${GITHUB_APP_CLIENT_ID}
          clientSecret: ${GITHUB_APP_CLIENT_SECRET}
          privateKey: ${GITHUB_APP_PRIVATE_KEY}
```

### Using with Multiple Organizations

```yaml
integrations:
  github:
    - host: github.com
      apps:
        - appId: ${PUBLIC_GITHUB_APP_ID}
          # ... other config
    - host: github.enterprise.com
      token: ${ENTERPRISE_GITHUB_TOKEN}
```

## Troubleshooting

### Common Issues

**Error: "Bad credentials"**
- Verify your GitHub token or App credentials are correct
- Ensure the token has `admin:org` scope for team operations
- For GitHub Apps, verify the app is installed on the target organization

**Error: "Not Found" when creating team**
- Verify the organization name is correct
- Ensure the authenticated user/app has access to the organization
- Check that the organization exists and is accessible

**Error: "Validation failed" for team members**
- Verify all usernames exist on GitHub
- Ensure users are members of the organization (required for private orgs)
- Check that usernames are spelled correctly

**Members not added but team created successfully**
- This is expected behavior - the action continues even if some members fail
- Check the `membersFailed` output for specific error details
- Common causes: user not in organization, user doesn't exist, insufficient permissions

### Debug Mode

Enable debug logging to troubleshoot issues:

```yaml
# app-config.yaml
backend:
  logging:
    level: debug
```

### Testing the Action

You can test the action directly using the Scaffolder's "Task List" page or by creating a simple template with minimal parameters.

## Contributing

This plugin is part of the Backstage Community Plugins collection. Contributions are welcome!

### Development Setup

1. Clone the repository
2. Install dependencies: `yarn install`
3. Run tests: `yarn test`
4. Run with coverage: `yarn test --coverage`

### Testing

The plugin includes comprehensive test coverage (96%+) with both unit and integration tests.

```bash
# Run tests
yarn test

# Run with coverage
yarn test --coverage

# Run specific test file
yarn test githubTeam.test.ts
```

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions:
- 🐛 [Report bugs](https://github.com/backstage/community-plugins/issues)
- 💡 [Request features](https://github.com/backstage/community-plugins/issues)
- 💬 [Discord community](https://discord.gg/backstage-687207715902193673)
