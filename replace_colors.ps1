$files = Get-ChildItem -Path "app", "components" -Include *.tsx, *.ts, *.css -Recurse -File

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    $newContent = $content -replace "(?i)#F7F0E6", "#F8FAFC" `
                           -replace "(?i)#A7653A", "#3B82F6" `
                           -replace "(?i)#27324A", "#0F172A" `
                           -replace "(?i)#2E3344", "#1E293B" `
                           -replace "(?i)text-\[#F7F0E6\]", "text-slate-50" `
                           -replace "(?i)bg-\[#F7F0E6\]", "bg-slate-50" `
                           -replace "(?i)text-\[#A7653A\]", "text-blue-500" `
                           -replace "(?i)bg-\[#A7653A\]", "bg-blue-500" `
                           -replace "(?i)text-\[#27324A\]", "text-slate-900" `
                           -replace "(?i)bg-\[#27324A\]", "bg-slate-900"
                           
    if ($content -ne $newContent) {
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Output "Updated $($file.FullName)"
    }
}
