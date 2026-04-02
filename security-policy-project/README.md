# Security Policy Project for Team Securitas

This project is automatically generated to manage security policies for the project.

The Security Policies Project is a repository used to store policies. All security policies are stored as a YAML file named `.gitlab/security-policies/policy.yml`, with this format:

```yaml
---
scan_execution_policy:
- name: Enforce DAST in every pipeline
  description: This policy enforces pipeline configuration to have a job with DAST scan
  enabled: true
  rules:
  - type: pipeline
    branches:
    - master
  actions:
  - scan: dast
    scanner_profile: Scanner Profile A
    site_profile: Site Profile B
- name: Enforce DAST in every pipeline in the main branch
  description: This policy enforces pipeline configuration to have a job with DAST scan for the main branch
  enabled: true
  rules:
  - type: pipeline
    branches:
    - main
  actions:
  - scan: dast
    scanner_profile: Scanner Profile C
    site_profile: Site Profile D
```

You can read more about the format and policies schema in the [documentation](https://gitlab.com/help/user/application_security/policies/scan_execution_policies.md#scan-execution-policy-schema).

## Default branch protection settings

This project is preconfigured with the default branch set as a protected branch, and only maintainers/owners of
[Team Securitas](https://gitlab.com/groups/gitlab-learn-labs/events/session-z7b3t2z8j/group-y6d4z9g/team-securitas) have permission to merge into that branch. This overrides any default branch protection both [for the group](https://gitlab.com/help/user/group/manage.md#change-the-default-branch-protection-of-a-group) and [for the instance](https://gitlab.com/help/user/project/repository/branches/default.md#for-all-projects-in-an-instance).
