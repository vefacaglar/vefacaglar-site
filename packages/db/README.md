# @vefacaglar/db - Code-First Veritabanı Rehberi

Bu paket, projenin veritabanı şemalarını (Drizzle ORM) ve migration süreçlerini yönetir.

## Komutlar

Aşağıdaki komutların tamamını projenin **root (ana) dizininde** çalıştırabilirsiniz:

### 1. Şemaları Doğrudan Veritabanına Yansıtma (Local / Hızlı Geliştirme)
Yerel geliştirme ortamında migration dosyası oluşturmadan şemaları doğrudan veritabanına yansıtmak için:
```bash
pnpm --filter @vefacaglar/db db:push
```

### 2. Migration Dosyası Oluşturma
Şemalarda (`src/schema/*.ts`) yaptığınız değişiklikleri SQL migration dosyasına dönüştürmek için:
```bash
pnpm --filter @vefacaglar/db db:generate
```
*Bu komut, `packages/db/drizzle/` klasörü altında SQL dosyaları üretir.*

### 3. Migration'ları Uygulama (Production / Staging)
Üretilen SQL migration dosyalarını hedef veritabanında sırayla çalıştırmak için:
```bash
pnpm --filter @vefacaglar/db db:migrate
```

### 4. Drizzle Studio (Görsel Arayüz)
Veritabanı tablolarını tarayıcı üzerinden görüntülemek, yeni veri eklemek veya düzenlemek için:
```bash
pnpm --filter @vefacaglar/db db:studio
```

### 5. Seeder (Veritabanı Başlangıç Verisi)
`users` tablosuna varsayılan bir admin kullanıcısı (`admin@vefacaglar.com` / `123`) eklemek için:
```bash
pnpm --filter @vefacaglar/db db:seed
```

---

## Klasör Yapısı

* `src/schema/`: Veritabanı tablo şemalarının tanımlandığı yer (`posts.ts`, `pages.ts`, `projects.ts`).
* `drizzle/`: `db:generate` komutuyla üretilen SQL migration dosyaları.
* `drizzle.config.ts`: Drizzle CLI (drizzle-kit) ayarları.
