$path = "src/pages/PruebasWalletApp.jsx"
$c = Get-Content -Encoding utf8 $path
$c[1773] = '                           {/* 5.5 LO MÁS PEDIDO (Igual a Promos, sin Corazón) */}'
$c[1777] = '                    <h2>Lo más pedido 🔥</h2>'
$c[2099] = '                <button className="back-btn-premium" onClick={() => setShowMenus(false)}>← Volver</button>'
$c[2363] = '                            <span>⚠️</span> {checkoutTotals.walletValidation.reason}'
$c[2449] = '                        placeholder="📍 Seleccioná tu dirección en el mapa..."'
$c[2455] = '                        📍'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($path, $c, $utf8NoBom)
