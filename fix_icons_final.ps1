$path = "c:\Users\axelm\OneDrive\Desktop\Weep\src\pages\PruebasWalletApp.jsx"
$c = [System.IO.File]::ReadAllLines($path)
$c[2099] = '                <button className="back-btn-premium" onClick={() => setShowMenus(false)}>← Volver</button>'
$c[2363] = '                            <span>⚠️</span> {checkoutTotals.walletValidation.reason}'
$c[2449] = '                        placeholder="📍 Seleccioná tu dirección en el mapa..."'
$c[2455] = '                        📍'
[System.IO.File]::WriteAllLines($path, $c)
