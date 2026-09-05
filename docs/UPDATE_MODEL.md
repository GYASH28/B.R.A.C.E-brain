# Update model

BRACE has no automatic updater in the current preview. This is intentional while artifacts are unsigned.

A future updater must be opt-in, support stable and preview channels, fetch signed metadata over HTTPS, show release notes before installation, verify artifact identity and signature, allow update checks to be disabled, and never accept an unsigned downgrade. Application data must remain outside the install directory and be backed up before a migration.

The required qualification path is: install the previous signed release, seed a synthetic profile, upgrade in place, verify database, settings, MCP configuration, automations and shortcuts, then uninstall without removing user data unless separately confirmed.
