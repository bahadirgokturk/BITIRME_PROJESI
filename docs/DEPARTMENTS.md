# DEPARTMENTS — Birim–Görev Matrisi (İzmir Bakırçay Üniversitesi)

Bu doküman, bildirimlerin **hangi birime** gideceğini (Routing Agent) ve hangi bildirim tiplerinin
(case type) var olduğunu belirler. Kurallar tahmin değil, üniversitenin **resmi görev tanımlarından**
çıkarılmıştır (Kamu İç Kontrol Standartları gereği birimlerin yayınladığı belgeler). Kaynaklar bölüm 5'te.

> Seed: `backend/seeds/templates/campus/` bu tablodan üretilir. Tablo değişirse seed ve sentetik veri
> şablonları (`ai/generators/templates/campus.yaml`) aynı PR'da güncellenir. Uyum CI'da test edilir
> (`scripts/tests/test_departments_sync.py`): tablo ile seed ayrışırsa build kırmızı olur.

## 1. Kapsam

CampusFlow **fiziksel ve operasyonel sorunları** (sabun bitti, priz kıvılcım çıkarıyor, Wi-Fi yok) ele alır.
Öğrenci İşleri, Personel, Strateji Geliştirme gibi birimlerin **idari hizmet talepleri** (kayıt, transkript,
bordro) kapsam dışıdır: sistem bunları reddetmez, `OUT_OF_SCOPE` olarak tanıyıp kullanıcıyı doğru birime
**yönlendirir**.

Üniversitede Genel Sekreterlik altında 8 daire başkanlığı vardır: Bilgi İşlem, İdari ve Mali İşler, Kütüphane
ve Dokümantasyon, Öğrenci İşleri, Personel, Sağlık Kültür ve Spor (SKS), Strateji Geliştirme, Yapı İşleri ve
Teknik. İş fiilen **şube müdürlüğü** düzeyinde yapıldığı için sistemdeki departmanlar şube düzeyindedir.

## 2. Departmanlar (sistemdeki `departments`)

| Kod | Resmi birim | Görev tanımından (özet) | Rolü |
|---|---|---|---|
| `SUPPORT_SERVICES` | İdari ve Mali İşler D.B. → **Destek Hizmetleri Şube Müdürlüğü** | Temizlik görevlileri: bina ve bahçe temizliği, tuvaletlerin günlük sabunlu/dezenfektanla yıkanması, katı atık ve geri dönüşüm toplama. Koruma ve güvenlik görevlileri: giriş kaydı, kamera takibi, hırsızlık/yaralanma vb. olaylara müdahale ve tutanak, **bulunan eşyanın emanete alınması**, izinsiz afiş/pankartın toplatılması. Araçların sevk ve bakımı. | Görev alır |
| `MAINTENANCE` | Yapı İşleri ve Teknik D.B. → **Bakım Onarım ve Peyzaj Şube Müdürlüğü** | Binaların küçük ve büyük onarımları; **ısıtma, soğutma, havalandırma, temiz ve pis su, elektrik**, haberleşme altyapısı tesisatlarının arıza giderme ve bakımı; **asansör**, jeneratör, trafo; kampüs **yeşil alanlarının** bakımı ve sulaması. | Görev alır |
| `IT_SUPPORT` | Bilgi İşlem D.B. → **Donanım ve Teknik Destek Şube Müdürlüğü** | Kampüse kesintisiz internet erişimi, kampüs ağının kurulumu ve bakımı, bilgisayar ve donanım kurulumu, **birimlerden gelen arızalı donanımların kaydı ve takibi**; turnike ve kartlı geçiş sistemleri. (Bilgi sistemleri işleri, ör. not düzeltme, fiziksel arıza değildir → `OUT_OF_SCOPE`.) | Görev alır |
| `NUTRITION` | SKS D.B. → **Beslenme Hizmetleri** | Yemekhaneler, kantin ve kafeteryalar, gıda muayene ve analizleri. | Görev alır |
| `CIVIL_DEFENSE` | İdari ve Mali İşler D.B. → **Sivil Savunma Birimi** | Yangın, afet ve acil durumlara hazırlık. | **Yalnız bilgilendirilir** (güvenlik açısından kritik bildirimlerde) |

## 3. Bildirim tipleri (case types)

**Birincil** departman görevi (task) alır; **ikincil** departman yalnız bilgilendirilir (ör. su taşkını hem
tesisat hem temizlik işidir). `OUT_OF_SCOPE` görev oluşturmaz, yönlendirme mesajı üretir.

| Kod | Ad | Kategori | Birincil | İkincil | Otonomi | Kaynak / not |
|---|---|---|---|---|---|---|
| `SOAP_EMPTY` | Sabun bitti | CONSUMABLE | SUPPORT_SERVICES | — | L1 | Temizlik görevlisi; dolumu temizlik ekibi yapar (ekip teyidi) |
| `TOILET_PAPER_EMPTY` | Tuvalet kağıdı bitti | CONSUMABLE | SUPPORT_SERVICES | — | L1 | Aynı |
| `TRASH_FULL` | Çöp dolu | CLEANING | SUPPORT_SERVICES | — | L1 | "Katı atıkları düzenli toplamak" |
| `AREA_DIRTY` | Alan kirli | CLEANING | SUPPORT_SERVICES | — | L1 | Temizlik görevlisi görev tanımı |
| `SECURITY_INCIDENT` | Güvenlik olayı | SECURITY | SUPPORT_SERVICES | CIVIL_DEFENSE | L3 | Güvenlik görevlisi: olay, şüpheli durum, izinsiz afiş |
| `LOST_ITEM` | Kayıp / bulunan eşya | SECURITY | SUPPORT_SERVICES | — | L1 | "Bulunan eşyayı tutanakla emanete almak" |
| `ELECTRICAL_FAILURE` | Elektrik arızası | TECHNICAL | MAINTENANCE | CIVIL_DEFENSE | L3 | Bakım Onarım: elektrik tesisatı |
| `WATER_LEAK` | Su sızıntısı / taşkın | INFRASTRUCTURE | MAINTENANCE | SUPPORT_SERVICES | L3 | Temiz ve pis su tesisatı; su temizliği Destek Hizmetleri |
| `AIR_CONDITIONER_FAILURE` | Isıtma / soğutma arızası | TECHNICAL | MAINTENANCE | — | L2 | Isıtma, soğutma, havalandırma |
| `ELEVATOR_FAILURE` | Asansör arızası | TECHNICAL | MAINTENANCE | — | L2 | Asansörlerin kesintisiz işletilmesi |
| `FURNITURE_DAMAGE` | Mobilya / kapı / pencere hasarı | INFRASTRUCTURE | MAINTENANCE | — | L2 | "Küçük onarımları yapmak" |
| `GREEN_AREA` | Bahçe / yeşil alan | INFRASTRUCTURE | MAINTENANCE | — | L1 | Yeşil alanların bakımı ve sulaması |
| `WIFI_FAILURE` | İnternet / Wi-Fi sorunu | IT | IT_SUPPORT | — | L2 | Kesintisiz internet erişimi, ağ bakımı |
| `COMPUTER_FAILURE` | Bilgisayar / donanım arızası | IT | IT_SUPPORT | — | L2 | Arızalı donanım kaydı ve takibi |
| `PROJECTOR_FAILURE` | Projeksiyon arızası | TECHNICAL | MAINTENANCE | IT_SUPPORT | L2 | Ekip kararı: dersliklerdeki projeksiyon Bakım Onarım'da; bağlantı/bilgisayar tarafı için BT bilgilendirilir |
| `ACCESS_CONTROL_FAILURE` | Turnike / kart okuyucu arızası | IT | IT_SUPPORT | SUPPORT_SERVICES | L2 | Ekip bilgisi: sistem Bilgi İşlem'de; güvenlik yalnız girişte görevli |
| `CAFETERIA_ISSUE` | Yemekhane / kantin sorunu | FOOD_SERVICE | NUTRITION | — | L2 | SKS Beslenme Hizmetleri |
| `OTHER` | Diğer | OTHER | — (insan inceler) | — | L2 | Sınıflandırılamayan fiziksel sorunlar → manager inceleme kuyruğu |
| `OUT_OF_SCOPE` | Kapsam dışı talep | OTHER | — (görev yok) | — | L1 | Öğrenci İşleri, Personel vb.; kullanıcıya doğru birim gösterilir |

Otonomi seviyeleri: [AGENTS.md](AGENTS.md) bölüm 5. Kategori listesine `FOOD_SERVICE` eklenmiştir
([DATABASE.md](DATABASE.md) bölüm 2).

## 4. Açık sorular (teyit edilecek)

| Soru | Şu anki karar | Nasıl teyit edilir |
|---|---|---|
| SLA süreleri | **Varsayım** (gerekçeli): `backend/seeds/templates/campus/sla_rules.yaml` | Her birimin **"Hizmet Envanteri ve Standartları"** sayfasındaki resmi tamamlanma süreleri (FAZ 4, SLA) |
| Spor salonu, konferans salonu gibi SKS tesislerindeki arızalar | Fiziksel arıza → Bakım Onarım | SKS'ye teyit |

## 5. Kaynaklar (erişim: 27.09.2026)

- İdari birimler listesi: https://bakircay.edu.tr/detay-menu.aspx?id=11
- İdari ve Mali İşler — Görev, Yetki ve Sorumluluklar (Destek Hizmetleri Şube Müdürü, Temizlik Görevlisi,
  Koruma ve Güvenlik Görevlisi, Hizmetli, Sivil Savunma Birim Amiri görev tanımları):
  https://imid.bakircay.edu.tr/?department=11&page=1114&menu=1145
- Yapı İşleri ve Teknik — Bakım Onarım ve Peyzaj Şube Müdürlüğü Görev Tanımı:
  https://yapiisleri.bakircay.edu.tr/?department=1079&page=2442&menu=2863
- Bilgi İşlem — Donanım ve Teknik Destek Şube Müdürlüğü Görev Tanımı: https://bidb.bakircay.edu.tr/?page=16&menu=14
- SKS — Beslenme Hizmetleri: https://sks.bakircay.edu.tr/?page=1168&menu=1206
- Ekip teyitleri (27.09.2026): sabun/tuvalet kağıdı dolumu temizlik görevlilerinde; turnike ve kart okuyucu
  Bilgi İşlem'de; projeksiyon Bakım Onarım'da (Bilgi İşlem'in günlük işi ağ, bilgisayar, turnike ve
  bilgi sistemleridir).
