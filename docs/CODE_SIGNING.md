# Windows code signing

Gridgrid uses Authenticode signing through electron-builder.

## What is required

A trusted Windows code-signing identity is required to remove the "Unknown publisher" identity shown by Windows. A self-signed certificate is useful for internal testing only and is not trusted by normal Windows installations.

For individual developers outside the regions supported by Azure Artifact Signing individual validation, an OV code-signing certificate from a public CA is the most broadly compatible option.

Common providers include DigiCert, Sectigo and SSL.com.

## GitHub Actions secrets

The Windows build and release workflows automatically sign Gridgrid when these repository secrets exist:

- `WINDOWS_CERTIFICATE_PFX_BASE64`
- `WINDOWS_CERTIFICATE_PASSWORD`

Do not commit the PFX file, its password, or the base64 value to the repository.

### Convert a PFX to base64 on Windows

PowerShell:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("C:\path\to\certificate.pfx")
) | Set-Content certificate-base64.txt -NoNewline
```

Copy the complete contents of `certificate-base64.txt` into the `WINDOWS_CERTIFICATE_PFX_BASE64` GitHub Actions secret.

Put the PFX password in `WINDOWS_CERTIFICATE_PASSWORD`.

The workflow decodes the certificate only inside the temporary GitHub Actions Windows runner and passes the temporary PFX path to electron-builder through `WIN_CSC_LINK`.

## Verification

Every Windows CI build runs `Get-AuthenticodeSignature` against the generated installer.

If a signing certificate was supplied and the final installer does not report a valid signature, the workflow fails.

electron-builder also derives the publisher name from the signing certificate. This publisher is embedded into the update configuration so electron-updater can reject future installers whose Authenticode signer does not match.

## SmartScreen

A valid code-signing certificate establishes the publisher identity and protects the installer against tampering. New OV publisher identities can still see SmartScreen reputation warnings until reputation is established. Keep using the same publisher identity across releases so reputation can accumulate.

## Local signed build

When a PFX is available locally:

```powershell
$env:WIN_CSC_LINK = "C:\path\to\certificate.pfx"
$env:WIN_CSC_KEY_PASSWORD = "your-password"
npm run dist:win
```

The generated installer is written to `release/`.
