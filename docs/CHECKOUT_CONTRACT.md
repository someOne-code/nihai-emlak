# Faz 3 Checkout Backend Contract

Bu doküman mevcut Phase 3 implementasyonundaki iki adımlı checkout akışını özetler. Source of truth route/helper kodu ile SQL testleridir.

## Akış Özeti

1. `POST /api/checkout`
   Yeni `reservation`, `order`, `order_items` ve `pending payment` üretir.
2. `POST /api/checkout/init`
   Var olan `pending order/payment` için Is Bankası hosted checkout payload üretir.

Kural:
- `POST /api/checkout` banka payload'ı döndürmez.
- `POST /api/checkout/init` yeni checkout kaydı üretmez.
- `POST /api/checkout/init`, `POST /api/checkout` başarılı olmadan çağrılmamalıdır.

## Ortak Gereksinimler

İki endpoint de state-changing JSON POST boundary'sidir.

- Auth: Geçerli Supabase oturumu zorunlu, aksi halde `401`.
- Origin: `Origin` header zorunlu ve trusted olmalı, aksi halde `403`.
- Content-Type: `application/json` zorunlu, aksi halde `415`.
- Geçersiz JSON veya geçersiz body: `400`.
- Büyük payload: `413`.

Trusted origin kaynağı:
- Production'da kanonik origin `SITE_URL` ve/veya `NEXT_PUBLIC_SITE_URL`.
- `development` / `test` ortamında bunlar yoksa `http://localhost:3000` fallback'i kullanılır.
- `VERCEL_URL` yalnızca `development` / `test` modunda trusted origin listesine girebilir.

Hata formatı:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

## `POST /api/checkout`

Amaç: Authenticated kullanıcı için checkout create RPC'sine normalize edilmiş intent göndermek.

Örnek request:

```json
{
  "listing_id": "11111111-1111-4111-8111-111111111111",
  "move_in_date": "2026-05-15",
  "stay_months": 3,
  "guest_count": 2,
  "main_items": ["deposit"],
  "service_items": ["cleaning"],
  "note": "Opsiyonel not"
}
```

Kurallar:
- `listing_id` UUID olmalı.
- `move_in_date` `YYYY-MM-DD` ISO tarih olmalı.
- `stay_months` `1..12` aralığında integer olmalı.
- `guest_count` pozitif integer olmalı.
- `main_items` zorunlu array; en az bir öğe içermeli; duplicate olamaz.
- `service_items` opsiyonel array; verilmezse boş listeye normalize edilir; duplicate olamaz.
- Item code'lar trim + lowercase normalize edilir ve parser uyumlu formatta olmalıdır: `^[a-z0-9][a-z0-9_-]*$`
- `note` string ise trim edilir; boşsa `null` olur.

Frontend'in göndermemesi gereken alanlar:
- `amount`
- `currency`
- `price`
- `total`
- `total_amount`

Bu alanlar gelirse request `400` ile reddedilir.

Örnek başarılı response (`201`):

```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "22222222-2222-4222-8222-222222222222"
    },
    "order": {
      "id": "33333333-3333-4333-8333-333333333333",
      "totalAmount": 1250,
      "currency": "TRY"
    },
    "payment": {
      "id": "44444444-4444-4444-8444-444444444444",
      "status": "pending"
    },
    "listing": {
      "id": "11111111-1111-4111-8111-111111111111"
    }
  }
}
```

Beklenen hata kodları:
- `400`: validation hatası, duplicate item, forbidden total field, geçersiz item seçimi
- `401`: auth yok/geçersiz
- `403`: origin yok/güvenilmiyor
- `409`: listing checkout'a uygun değil veya listing için enabled main item yok
- `413`: body çok büyük
- `415`: JSON değil
- `500`: RPC cevabı veya server tarafı hata

## `POST /api/checkout/init`

Amaç: Mevcut pending ödeme için Is Bankası hosted checkout payload üretmek.

Örnek request:

```json
{
  "orderId": "33333333-3333-4333-8333-333333333333"
}
```

Not:
- Alan adı `orderId` olarak camelCase'tir.
- Endpoint sadece authenticated kullanıcının kendi order'ında çalışır.
- Order `pending` değilse init reddedilir.
- Endpoint mevcut `pending isbank payment` satırını reuse eder.
- Eksik `pending payment` için yeni payment yaratmaz.

Örnek başarılı response (`200`):

```json
{
  "success": true,
  "data": {
    "isbank": {
      "HASH": "BANK_HASH",
      "amount": "1250.00",
      "clientid": "ISBANK_CLIENT_ID",
      "currency": "TRY",
      "failurl": "https://example.com/checkout/fail",
      "instalment": "0",
      "oid": "44444444-4444-4444-8444-444444444444",
      "okurl": "https://example.com/checkout/success",
      "rnd": "RANDOM_VALUE",
      "txnType": "Auth"
    },
    "payment": {
      "amount": 1250,
      "currency": "TRY",
      "id": "44444444-4444-4444-8444-444444444444",
      "orderId": "33333333-3333-4333-8333-333333333333",
      "providerRef": "44444444-4444-4444-8444-444444444444",
      "status": "pending"
    }
  }
}
```

Init contract sabitleri:
- `isbank.oid = payment.id = payment.providerRef`
- Terminal veya drift etmiş payment tekrar yazılmaz.
- Pending payment order toplamı ile eşleşmiyorsa `409`.

Beklenen hata kodları:
- `400`: body veya `orderId` geçersiz
- `401`: auth yok/geçersiz
- `403`: origin yok/güvenilmiyor
- `404`: order bulunamadı veya kullanıcıya ait değil
- `409`: order pending değil, pending payment yok, payment artık pending değil, amount/currency drift var
- `413`: body çok büyük
- `415`: JSON değil
- `500`: Is Bankası config veya server tarafı hata

## `main_items` / `service_items` ve Pricing

`main_items` kullanıcı seçimini taşır ama source of truth değildir. Backend şu sırayı izler:

1. Route request'i normalize eder.
2. DB/RPC listing uygunluğunu kontrol eder.
3. DB/RPC `main_items` ve `service_items` seçimlerini listing/admin config'e karşı doğrular.
4. DB/RPC authoritative toplamı ve line item'ları üretir.

Authoritative pricing kuralları:
- Frontend toplam fiyat göndermez.
- `orders.total_amount` DB/RPC tarafından hesaplanır.
- `order_items.amount` DB/RPC tarafından üretilir.
- `payments.amount` order toplamı ile uyumlu olur.
- Para birimi route'ta DB/RPC sonucundan alınır; mevcut Phase 3 SQL fixture'ları `TRY` kullanır.
- Listing price, main item config, service catalog ve listing-level override'lar DB/admin tarafında okunur.

Mevcut SQL testleri şu davranışları sabitler:
- En az bir `main_items` seçimi zorunlu.
- Duplicate `service_items` reddedilir.
- Listing override fiyatı varsa kullanılır; yoksa service base price fallback olur.
- Sale listing checkout quote/create akışına giremez.
- Aynı listing için ikinci pending checkout açılamaz.
