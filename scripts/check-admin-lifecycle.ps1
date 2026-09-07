param(
    [Parameter(Mandatory=$true)][string]$AdminPassword,
    [string]$AdminIdentifier = 'superadmin',
    [string]$ApiBase = 'http://localhost:5001'
)
$ErrorActionPreference = 'Stop'
if (([uri]$ApiBase).Host -notin @('localhost', '127.0.0.1', '::1')) { throw 'Run this check only against a local development API.' }
# Creates one named test account, revokes it before finishing, and retains its audit history.
function New-Session { New-Object Microsoft.PowerShell.Commands.WebRequestSession }
function Call-Api($session, $method, $path, $body = $null, $expected = 200, $csrf = $true) {
    $headers = @{}
    if ($method -ne 'GET' -and $csrf) {
        $token = Call-Api $session 'GET' '/api/auth/csrf'
        $headers['X-CSRF-TOKEN'] = $token.token
    }
    for ($attempt = 0; $attempt -lt 5; $attempt++) {
        $args = @{ Uri = "$ApiBase$path"; Method = $method; WebSession = $session; Headers = $headers; UseBasicParsing = $true }
        if ($null -ne $body) { $args.ContentType = 'application/json'; $args.Body = ($body | ConvertTo-Json -Depth 10) }
        try { $response = Invoke-WebRequest @args; $status = [int]$response.StatusCode }
        catch {
            if ($null -eq $_.Exception.Response) { throw }
            $status = [int]$_.Exception.Response.StatusCode
            if ($status -eq 429 -and $attempt -lt 4) { Write-Host 'Waiting for the development rate limiter...'; Start-Sleep -Seconds 30; continue }
            if ($status -ne $expected) { throw }
            return
        }
        if ($status -ne $expected) { throw "$method $path returned $status; expected $expected" }
        if ($response.Content) { return $response.Content | ConvertFrom-Json }
        return
    }
    throw "Rate limit did not recover: $path"
}
$admin = New-Session
$candidate = New-Session
$anonymous = New-Session
$name = 'audit_' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$password = 'Audit-' + [guid]::NewGuid().ToString('N') + '!9'
$signup = @{ username=$name; email="$name@example.test"; password=$password; displayName='Lifecycle verification (revoked after test)' }
$permission = $null
$targetId = $null
$pendingId = $null
try {
    $user = Call-Api $admin 'POST' '/api/auth/login' @{email=$AdminIdentifier;password=$AdminPassword}
    if ('SuperAdmin' -notin $user.roles) { throw 'The test requires a local super admin.' }
    $restored = Call-Api $admin 'GET' '/api/auth/me'
    if ($restored.id -ne $user.id) { throw 'Session restoration failed.' }
    Call-Api $anonymous 'GET' '/api/admin-dashboard/summary' $null 401
    $permission = Call-Api $admin 'GET' '/api/ca-requests-permission'
    Call-Api $admin 'PUT' '/api/ca-requests-permission' @{enabled=$true} | Out-Null
    Call-Api $anonymous 'POST' '/api/auth/register-content-admin-request' $signup 400 $false
    $request = Call-Api $candidate 'POST' '/api/auth/register-content-admin-request' $signup 201
    $targetId = $request.userId; $pendingId = $request.id
    Call-Api $candidate 'POST' '/api/auth/register-content-admin-request' $signup 409
    Call-Api $candidate 'POST' '/api/auth/login' @{email=$name;password=$password} 401
    Call-Api $admin 'POST' "/api/content-admin-requests/$pendingId/deny" @{reviewNote='Lifecycle test denial'} | Out-Null
    $pendingId = $null
    $request = Call-Api $candidate 'POST' '/api/auth/register-content-admin-request' $signup 201
    $pendingId = $request.id
    if ($request.userId -ne $targetId) { throw 'Reapplication created a different account.' }
    Call-Api $admin 'POST' "/api/content-admin-requests/$pendingId/approve" @{reviewNote='Lifecycle test approval'} | Out-Null
    $pendingId = $null
    $signedIn = Call-Api $candidate 'POST' '/api/auth/login' @{email=$signup.email;password=$password}
    if ('ContentAdmin' -notin $signedIn.roles) { throw 'Approved account cannot sign in as content admin.' }
    Call-Api $candidate 'GET' '/api/admin-dashboard/summary' | Out-Null
    Call-Api $candidate 'GET' '/api/content-admins' $null 403
    Call-Api $admin 'DELETE' "/api/content-admins/$targetId" @{password='Intentionally-Wrong-2026!'} 401
    Call-Api $candidate 'GET' '/api/auth/me' | Out-Null
    Call-Api $admin 'DELETE' "/api/content-admins/$targetId" @{password=$AdminPassword} 204
    Call-Api $candidate 'GET' '/api/admin-dashboard/summary' $null 401
    Call-Api $candidate 'GET' '/api/auth/me' $null 401
    $request = Call-Api $candidate 'POST' '/api/auth/register-content-admin-request' $signup 201
    $pendingId = $request.id
    if ($request.userId -ne $targetId) { throw 'Revoked account reapplication changed identity.' }
    Call-Api $admin 'POST' "/api/content-admin-requests/$pendingId/approve" @{reviewNote='Lifecycle test reapproval'} | Out-Null
    $pendingId = $null
    Call-Api $candidate 'POST' '/api/auth/login' @{email=$name;password=$password} | Out-Null
    # Preserve the original authentication cookie to check server-side invalidation after logout.
    $replay = New-Session
    foreach ($cookie in $candidate.Cookies.GetCookies([uri]$ApiBase)) {
        $copy = New-Object System.Net.Cookie($cookie.Name, $cookie.Value, $cookie.Path, $cookie.Domain)
        $replay.Cookies.Add($copy)
    }
    Call-Api $candidate 'POST' '/api/auth/logout' $null 204
    Call-Api $replay 'GET' '/api/auth/me' $null 401
    Write-Host 'PASS: CSRF, signup, duplicate prevention, pending login, denial, reapplication, approval, role restrictions, revocation, reapproval, logout, and old-cookie rejection.'
}
finally {
    if ($pendingId) { Call-Api $admin 'POST' "/api/content-admin-requests/$pendingId/deny" @{reviewNote='Lifecycle test cleanup'} | Out-Null }
    if ($targetId) {
        Call-Api $admin 'DELETE' "/api/content-admins/$targetId" @{password=$AdminPassword} 204
        Write-Host "Test account retained without admin access: $name"
    }
    if ($null -ne $permission) { Call-Api $admin 'PUT' '/api/ca-requests-permission' @{enabled=[bool]$permission.enabled} | Out-Null }
    Call-Api $admin 'POST' '/api/auth/logout' $null 204
}
