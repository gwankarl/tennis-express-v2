# Tennis-Xpress V2 — Agent Instructions

## Source of Truth

- Treat the current repository as authoritative for implementation details.
- Inspect relevant files directly before proposing code changes.
- Never assume existing code, APIs, dependencies, types, or file paths.
- Check existing project instructions before making changes.
- Do not ask the user to paste files that you can access in the workspace.

## Development Workflow

1. Discuss the requested feature, its behavior, and important design decisions with the user.
2. Inspect the existing implementation and dependencies relevant to that feature.
3. Explain the implementation approach briefly and identify unresolved decisions.
4. Provide complete, compatible code with exact file paths.
5. By default, provide code and commands for the user to implement manually.
6. Edit files directly only when the user requests it.
7. Verify changes using available project checks and manual verification.
8. Resolve reported errors using actual command output and repository context.
9. Finish and confirm the current feature before proceeding.

## Architecture

- Preserve the established frontend/backend separation.
- Follow the existing module structure, naming conventions, validation, authentication, error handling, and data-access patterns.
- Reuse existing implementations where appropriate.
- Avoid introducing a routes folder or changing the established module-routing design without explicit approval.
- Avoid unrelated refactoring.

## Testing and Verification

- Prefer existing project verification commands and manual verification.
- Do not independently introduce test-writing tasks unless the user changes this preference.
- Never claim verification succeeded unless the relevant command or check actually succeeded.

## Git and User Control

- The user chooses every next feature.
- Work on one feature at a time.
- Never commit, push, reset, rebase, or discard changes without explicit authorization.
- Check Git status and inspect diffs before proposing Git operations.
- Never overwrite unrelated user changes.
- Keep feature commits focused and use descriptive commit messages.
- Never commit secrets, credentials, or environment files containing them.

## Communication

- Keep responses concise and practical.
- Give exact paths, complete code, and Git Bash commands.
- Ask questions only when an unresolved decision materially affects the implementation.
- Clearly distinguish proposed changes from changes actually completed.
