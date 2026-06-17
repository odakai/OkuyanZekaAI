# 📖 ReadMeter

**TEKNOFEST 2026 — İnsanlık Yararına Teknolojiler Yarışması**  
Lise Seviyesi | Eğitim, Kültür ve Dijital Deneyim Teknolojileri

---

## Proje Hakkında

ReadMeter, çocukların kitap okurken gösterdikleri dikkati ve anlama düzeyini ölçen bir web uygulamasıdır.

- Oturum sırasında **rastgele aralıklarla** çocuktan sesli okuması istenir
- Sesli okuma **Web Speech API** ile metne dönüştürülür
- Oturum bitince **AI** bu metinlere dayalı anlama soruları üretir
- Çocuğun cevapları AI tarafından değerlendirilir
- **Ebeveyn panelinde** dikkat haritası, soru-cevap özeti ve genel skor görüntülenir

---

## Özellikler

| Özellik | Detay |
|---|---|
| 🎙️ Sesli okuma tespiti | Web Speech API (tarayıcı tabanlı, ücretsiz) |
| 🤖 Soru üretimi | OpenAI GPT-4o mini veya Google Gemini |
| 📊 Dikkat analizi | Segment bazlı AI değerlendirmesi |
| 💾 Veri saklama | JSONBin (backend gerektirmez) |
| 🌐 Dil | Türkçe / İngilizce |
| 📱 Platform | GitHub Pages (statik, ücretsiz) |

---

## Kurulum

### 1. Repoyu Fork / Clone Et
```bash
git clone https://github.com/KULLANICI_ADI/readmeter.git
cd readmeter
```

### 2. JSONBin Ayarla
- [jsonbin.io](https://jsonbin.io) adresine git
- Yeni bir Bin oluştur, şu JSON'u yapıştır:
```json
{
  "sessions": [],
  "settings": {
    "language": "tr",
    "sessionDuration": 20,
    "aiProvider": "openai",
    "apiKey": ""
  }
}
```
- `app.js` dosyasında `BIN_ID` ve `BIN_KEY` değerlerini güncelle

### 3. GitHub Pages Aktif Et
- Repo → **Settings** → **Pages**
- Source: `main` branch, `/ (root)` klasörü
- **Save** → birkaç dakika sonra site yayında

---

## Kullanım

### Ebeveyn
1. `/parent` sayfasına git
2. Oturum süresini ayarla → **Kaydet**
3. Sol alt köşeye **3 kez** tıkla → AI sağlayıcı ve API key gir → **Kaydet**
4. Çocuk okumayı bitirince **Raporlar** sekmesinden sonuçları gör

### Çocuk
1. `/child` sayfasına git
2. **Okumaya Başla** butonuna bas
3. Kitabını oku — üst bant sinyali verince **sesli oku** (5-9 saniye)
4. Oturum bitince soruları cevapla
5. Analiz otomatik kaydedilir

---

## Dosya Yapısı

```
readmeter/
├── index.html          # Ana giriş sayfası
├── style.css           # Global stiller
├── app.js              # Ortak modüller (DB, AI, Lang, Toast)
├── 404.html            # GitHub Pages yönlendirme
├── parent/
│   └── index.html      # Ebeveyn paneli
└── child/
    └── index.html      # Çocuk okuma ekranı
```

---

## Desteklenen AI Sağlayıcılar

| Sağlayıcı | Model | API Key |
|---|---|---|
| OpenAI | GPT-4o mini | [platform.openai.com](https://platform.openai.com) |
| Google Gemini | Gemini 1.5 Flash | [aistudio.google.com](https://aistudio.google.com) |

> ⚠️ **Not:** Anthropic Claude doğrudan tarayıcıdan çağrılamaz (CORS kısıtı). OpenAI veya Gemini önerilir.

---

## Teknik Notlar

- Tüm işlemler **tarayıcıda** gerçekleşir, backend yoktur
- Sesli okuma için `Chrome` veya `Edge` tarayıcısı önerilir (Web Speech API desteği)
- API key'ler JSONBin'de şifresiz saklanır — paylaşılan cihazlarda dikkatli olunmalıdır

---

## Lisans

MIT © 2026 ReadMeter Team
