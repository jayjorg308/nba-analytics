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
# Pulls are LOCAL-ONLY (stats.nba.com blocks cloud IPs) — this task belongs
# on the dev machine and nowhere else. Logs land in data\season-loop\.

$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$logDir = Join-Path $repo "data\season-loop"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("run-" + (Get-Date -Format "yyyy-MM-ddTHHmmss") + ".log")

npm run season:update *>&1 | Tee-Object -FilePath $log
$exitCode = $LASTEXITCODE

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
