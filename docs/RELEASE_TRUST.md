# Release trust

Every tagged preview is built natively for Linux and Windows from the tagged commit. The pipeline runs dependency and license checks, verification, desktop E2E, executable MCP smoke, package-content inspection, and application smoke before publication.

Published assets include SHA-256 checksums and a CycloneDX SBOM. GitHub artifact attestations link eligible workflow-built files to the repository, commit, and workflow identity. Users should verify the checksum from the GitHub release before installation.

Windows Authenticode signing is conditional on maintainers provisioning a protected certificate and timestamp service. Until signature verification is active, BRACE releases remain clearly marked **preview** and Windows may show an unknown-publisher warning. Linux checksum metadata may be additionally signed when a protected signing identity is provisioned.

No release is called stable merely because CI passed. Stable additionally requires verified signing, candidate-native package evidence, upgrade-path testing, and an approved update model.
