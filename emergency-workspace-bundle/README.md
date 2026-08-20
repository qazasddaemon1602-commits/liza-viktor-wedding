# Emergency workspace Git bundle

This branch is a safety transport for the complete local commit cde5126e24051f10a8e1e34643e6acc729d1f007.
It preserves 531 changed/added project files, including Task8 Bunker assets, subagent records, ImageGen sources, references, and diagnostics.

The verified complete Git bundle was uploaded in 700 KiB chunks through the authenticated GitHub connection.

Recovery:

find emergency-workspace-bundle/parts -type f -name 'part-*' -print0 | sort -z | xargs -0 cat > backup-emergency-workspace.bundle
git bundle verify backup-emergency-workspace.bundle
git clone backup-emergency-workspace.bundle recovered-project
git -C recovered-project switch backup/emergency-workspace

Expected recovered commit: cde5126e24051f10a8e1e34643e6acc729d1f007.
See manifest.tsv for total size, SHA-256, and every part checksum.
