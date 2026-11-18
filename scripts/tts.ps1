param([string]$text, [string]$outWav)
$v = New-Object -ComObject SAPI.SpVoice
if ($outWav) {
    $fullPath = [System.IO.Path]::GetFullPath($outWav)
    $dir = [System.IO.Path]::GetDirectoryName($fullPath)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $fs = New-Object -ComObject SAPI.SpFileStream
    # SpeechAudioFormatType 39 = SAFT22kHz16BitMono
    $format = New-Object -ComObject SAPI.SpAudioFormat
    $format.Type = 39
    $fs.Format = $format
    $fs.Open($fullPath, 3, $false)
    $v.AudioOutputStream = $fs
    $v.Speak($text)
    $fs.Close()
    Write-Host "SAVED:" $fullPath
} else {
    $v.Speak($text)
}
