# The season loop's Task Scheduler wrapper (ADR-0057): runs the daily
# session and raises a Windows toast when it halts, because a publish that
# silently stops is a freshness bug, not a quiet day. All real logic lives
# in ingestion/season_update.py — this file only schedules and notifies.
#
# REGISTER (run once, from an elevated prompt, adjusting the start time to
# a morning hour after West Coast games have settled):
#
#   schtasks /create /tn "nba-analytics season loop" ^
#     /tr "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\JaysonJorgensen\Sources\repos\nba-analytics\scripts\season-update.ps1" ^
#     /sc daily /st 06:30
#
# UNREGISTER:  schtasks /delete /tn "nba-analytics season loop"
#
# Arguments after the file pass through to the loop: the game-night trigger
# (docs/plans/jazz-first-site.md) is a second task running this file with
# `--team UTA` at 23:45. Every task running this file needs the plan's
# Task Scheduler power and wake settings (its Operations section).
#
# Pulls are LOCAL-ONLY (stats.nba.com blocks cloud IPs) — this task belongs
# on the dev machine and nowhere else. Logs land in data\season-loop\.

$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$loopArgs = $args

$logDir = Join-Path $repo "data\season-loop"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("run-" + (Get-Date -Format "yyyy-MM-ddTHHmmss") + ".log")

# Pull first: on main the session starts from origin's main, or a PR merged
# on GitHub would make the data commit's push fail. Fast-forward only; a pull
# that cannot fast-forward halts like any session. On any other branch
# nothing is pulled, and the loop's branch guard (season_update.py) refuses
# the production store and the data commit there.
$exitCode = 0
$branch = (git rev-parse --abbrev-ref HEAD | Out-String).Trim()
if ($branch -eq "main") {
    git pull --ff-only *>&1 | Tee-Object -FilePath $log
    $exitCode = $LASTEXITCODE
}

if ($exitCode -eq 0) {
    npm run season:update -- @loopArgs *>&1 | Tee-Object -FilePath $log -Append
    $exitCode = $LASTEXITCODE
}

if ($exitCode -ne 0) {
    # Best-effort toast via WinRT — the halt is already durable in the log
    # and the status files; the toast is the "look at me" (ADR-0057).
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = @"
<toast><visual><binding template="ToastText02">
<text id="1">nba-analytics season loop HALTED</text>
<text id="2">Nothing shipped. See $log</text>
</binding></visual></toast>
"@
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("nba-analytics").Show($toast)
    } catch {
        Write-Warning "toast failed ($_); the halt is recorded in $log"
    }
}

exit $exitCode
