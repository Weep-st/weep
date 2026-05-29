$path = "src/pages/PruebasWalletApp.jsx"
$txt = [System.IO.File]::ReadAllText($path)
$txt = $txt.Replace("â† ", "←")
$txt = $txt.Replace("âš ï¸ ", "⚠️")
$txt = $txt.Replace("ðŸ“ ", "📍")
$txt = $txt.Replace("âš¡", "⚡")
$txt = $txt.Replace("ðŸ †", "🔥")
$txt = $txt.Replace("âœ•", "✕")
[System.IO.File]::WriteAllText($path, $txt)
