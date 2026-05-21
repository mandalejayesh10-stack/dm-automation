Start-Transcript -Path "$PSScriptRoot\web-server.log" -Append | Out-Null
Set-Location "C:\Users\JAYESH\Documents\DM automation chatgpt"
npm --workspace @aisma/web run dev
Stop-Transcript | Out-Null
