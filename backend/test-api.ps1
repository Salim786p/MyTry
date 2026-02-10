# test-api.ps1
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/upload/text" `
    -Method Post `
    -Body (@{
        content = "My first secret text"
        expiry = "10m"
    } | ConvertTo-Json) `
    -ContentType "application/json"

$response | ConvertTo-Json -Depth 10