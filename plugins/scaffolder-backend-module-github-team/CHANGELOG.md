# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-08-03

### Added

- Initial release of GitHub Team scaffolder action
- `github:team:create` action for creating GitHub teams with comprehensive member management
- Organization-level GitHub App authentication support (bypasses repository requirement)
- Support for both personal access tokens and GitHub Apps
- Team privacy control (closed/secret)
- Member role assignment (member/maintainer)
- Detailed success/failure tracking for member additions
- Comprehensive error handling and user feedback
- Enhanced template output with member management results
- Custom `getOctokitOptionsForOrg` function for organization-level operations

### Technical Features

- 96% test coverage with comprehensive unit and integration tests
- Robust error handling for various GitHub API failure scenarios
- Support for partial success scenarios (team created, some members failed)
- Detailed logging for debugging and troubleshooting
- Input validation using Zod schemas
- TypeScript support with full type safety

### Supported Operations

- Create GitHub teams in any organization
- Add multiple team members during creation
- Set team privacy (closed or secret)
- Assign member roles (member or maintainer)
- Handle member addition failures gracefully
- Return detailed operation results

### Requirements

- Backstage v1.4.0+
- GitHub integration configured
- GitHub App with organization permissions OR personal access token with `admin:org` scope

### Breaking Changes

- None (initial release)

### Documentation

- Comprehensive README with installation and usage instructions
- Example templates and configuration
- Troubleshooting guide
- API documentation