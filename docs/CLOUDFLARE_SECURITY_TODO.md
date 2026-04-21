# Cloudflare Security TODO

Bu dosya, uygulama kodunda tamamen kapatilmamasi gereken edge/network guvenlik islerini takip etmek icin tutulur.

## Payment callback invalid-signature flood

Durum: `POST /api/payment/callback` backend tarafinda Is Bankasi imza dogrulamasi yapiyor ve hatali imzayi `401` ile reddediyor. Ayrica callback body okuma akisi stream seviyesinde limitlenerek buyuk payload bellek riski azaltildi.

Kalan risk: Cok sayida kucuk ama hatali imzali callback istegi backend'e kadar ulasirsa uygulama CPU/IO tuketebilir ve rejection event/log hacmi artabilir. Bu veri sizdirma degil, abuse/DoS riskidir.

Kalici cozum Cloudflare/WAF katmaninda uygulanmali:

- `/api/payment/callback` icin IP/path bazli rate limit ekle.
- Is Bankasi resmi callback IP/range bilgisi varsa allowlist uygula.
- Sadece `POST` metoduna izin ver.
- Sadece beklenen `Content-Type` degerlerine izin ver: `application/json` ve `application/x-www-form-urlencoded`.
- Edge/body size limitini backend limitiyle uyumlu kucuk bir degerde tut.
- Invalid-signature log/event hacmi icin edge veya log pipeline tarafinda sampling/throttle degerlendir.

Backend notu: Cloudflare trafiği azaltir ama guvenlik kaynagi tek basina Cloudflare olmamali. Imza dogrulamasi ve payment state transition kontrolleri backend ve DB tarafinda kalmaya devam etmeli.
