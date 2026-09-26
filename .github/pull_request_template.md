## Ne yapıyor?
<!-- 1-3 cümle. İlgili backlog maddesi: örn. E3-2 -->

## Plan (önemli işlerde — KOD_KURALLARI §5)
```yaml
invariant:
assumption:
risk:
verification:
```

## Tür
- [ ] Yeni özellik
- [ ] Hata düzeltme → **örnek düzeltme** / **sınıf kapatma** (KOD_KURALLARI §12)
- [ ] Refactor / chore / docs

## Test kanıtı
- Toplanan test sayısı (`pytest --co -q | tail -1`): 
- [ ] Yeni kontrolü önce bilerek bozuk girdiyle **kırmızıya** döndürdüm (§9)
- [ ] UI değişikliğinde ekran görüntüsü eklendi (masaüstü + mobil genişlik)

## Kontrol listesi
- [ ] [KOD_KURALLARI.md](../KOD_KURALLARI.md) ile uyumlu (boş except yok, sihirli sayı yok, yorumlar ASCII)
- [ ] Katman sınırları korundu (route/bileşende iş kuralı yok, agent DB'ye erişmiyor)
- [ ] Migration var mı? Varsa `upgrade` + `downgrade` denendi, veri silmiyor
- [ ] Yeni env değişkeni `.env.example`'a eklendi
- [ ] İlgili `docs/*.md` güncellendi
