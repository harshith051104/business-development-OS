param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath
)

$inFull = (Resolve-Path $InputPath).Path
$outFull = [System.IO.Path]::GetFullPath($OutputPath)

$ppt = $null
$pres = $null
try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $ppt.WindowState = 2 # Minimized
    # Open(FileName, ReadOnly, Untitled, WithWindow)
    $pres = $ppt.Presentations.Open($inFull, -1, 0, -1)
    # 32 is ppSaveAsPDF
    $pres.SaveAs($outFull, 32)
    Write-Output "CONVERT_OK"
} catch {
    Write-Error $_.Exception.Message
} finally {
    if ($pres) {
        $pres.Close()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null
    }
    if ($ppt) {
        $ppt.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
