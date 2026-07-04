# Windows Installer Script for Abaxana Terminal.
# Run via: irm https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host "==> Installing Abaxana Terminal..."

# 1. Set Repo details
$Repo = "AbabilX/ababilx_terminal"
$Url = "https://github.com/$Repo/releases/latest"

Write-Host "==> Fetching latest release information..."
try {
    # Fetch the redirect headers to parse the tag
    $Request = [System.Net.WebRequest]::Create($Url)
    $Request.AllowAutoRedirect = $false
    $Response = $Request.GetResponse()
    $RedirectUrl = $Response.GetResponseHeader("Location")
    $Response.Close()

    if ($RedirectUrl -match "releases/tag/(v?[0-9\.]+)") {
        $VersionTag = $Matches[1]
    } else {
        # Fallback to API if redirect isn't matching
        $ApiUrl = "https://api.github.com/repos/$Repo/releases/latest"
        $ReleaseInfo = Invoke-RestMethod -Uri $ApiUrl -UseBasicParsing
        $VersionTag = $ReleaseInfo.tag_name
    }
} catch {
    Write-Error "Failed to fetch release information. Verify your connection or check if a release exists on GitHub."
    exit 1
}

$Version = $VersionTag.TrimStart('v')
Write-Host "==> Latest version found: v$Version"

# 2. Determine target package name
# In Tauri v2, Windows MSI bundle naming pattern:
# e.g., Abaxana_0.1.0_x64_en-US.msi
$MsiName = "Abaxana_${Version}_x64_en-US.msi"
$DownloadUrl = "https://github.com/$Repo/releases/download/$VersionTag/$MsiName"

# Define local download target
$TempDir = [System.IO.Path]::GetTempPath()
$TempMsi = Join-Path $TempDir $MsiName

Write-Host "==> Downloading $MsiName from: $DownloadUrl"
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempMsi -UseBasicParsing
} catch {
    Write-Error "Failed to download MSI file. Please verify that the release asset exists on GitHub."
    exit 1
}

# 3. Perform silent installation
Write-Host "==> Installing Abaxana Terminal silently..."
try {
    $Arguments = "/i `"$TempMsi`" /qn /norestart"
    $Process = Start-Process -FilePath "msiexec.exe" -ArgumentList $Arguments -Wait -PassThru -NoNewWindow
    if ($Process.ExitCode -eq 0) {
        Write-Host "==> Installation complete! Abaxana Terminal has been installed successfully."
        Write-Host "==> You can find it in your Start Menu or program folder."
    } else {
        Write-Error "Installation failed with exit code: $($Process.ExitCode)"
    }
} catch {
    Write-Error "Failed to start the installation process."
} finally {
    # Cleanup temporary file
    if (Test-Path $TempMsi) {
        Remove-Item $TempMsi -Force
    }
}
