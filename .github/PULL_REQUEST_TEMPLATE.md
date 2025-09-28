<!--
Thank you for your pull request! Please provide a clear description above and complete the checklist below.

Bug fixes and new features should include tests and documentation.

Contributors guide: https://github.com/magarcia/keyring/blob/main/CONTRIBUTING.md
-->

## Description

<!--
Please include a summary of the change and which issue is fixed. Include relevant motivation and context.
List any dependencies that are required for this change.
-->

Fixes # (issue)

## Type of change

Please delete options that are not relevant.

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Dependency update

## Testing

<!--
Describe the tests you ran to verify your changes. Provide instructions so reviewers can reproduce.
Include relevant details for your test configuration.
-->

**Test Configuration**:

- OS: [e.g., macOS Sonoma, Windows 11, Ubuntu 22.04]
- Node.js version: [e.g., 20.x]
- NPM version: [e.g., 10.x]

**Tests performed**:

- [ ] Manual testing (describe scenarios tested)
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Edge cases considered and tested

## Pre-submission Checklist

### Code Quality

- [ ] I have followed the project's style guidelines
- [ ] I have performed a thorough self-review of my code
- [ ] I have added necessary comments explaining the "why" behind complex logic
- [ ] I have removed any debugging code, console logs, or commented-out code
- [ ] My code is readable and maintainable

### Documentation

- [ ] I have updated relevant documentation (README, API docs, etc.)
- [ ] I have added/updated JSDoc comments for new functions and classes
- [ ] Breaking changes are clearly documented

### Testing

- [ ] I have written or updated tests to cover my changes
- [ ] My tests follow the project's testing patterns and conventions
- [ ] I have tested edge cases and error conditions
- [ ] All new and existing tests pass

### Local Verification

**All of the following commands must pass locally before submitting:**

- [ ] `npm run lint` - passes without errors
- [ ] `npm run typecheck` - passes without TypeScript errors
- [ ] `npm run test` - all tests pass
- [ ] `npm run build` - builds successfully without errors

### Additional Checks

- [ ] My changes generate no new warnings or errors
- [ ] I have considered the performance impact of my changes
- [ ] I have considered the security implications of my changes
- [ ] Any dependent changes have been merged and published in downstream modules
- [ ] I have updated the version number if this is a breaking change
