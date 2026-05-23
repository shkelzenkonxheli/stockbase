# End-to-End Testing Checklist

Ky dokument perdoret para deploy-it dhe para se tenant-et ta testojne app-in.

## 1. Platform Owner Flow

- Hape `/login`
- Hyr me `PLATFORM_ADMIN_EMAILS`
- Verifiko qe redirect shkon te `/platform/tenants`
- Verifiko qe owner nuk sheh tenant shell normal
- Hape `/platform/tenants/new`
- Krijo tenant te ri
- Verifiko qe tenant-i krijohet me:
  - `14 dite trial`
  - kategori baze sipas `catalogType`
  - owner user

## 2. Tenant Login Flow

- Dil nga owner console
- Hyr me emailin e owner-it te tenant-it te ri
- Verifiko qe redirect shkon te `/`
- Verifiko qe navbar-i tregon tenant-in korrekt
- Verifiko qe owner console nuk shfaqet ne navigimin e tenant-it

## 3. Trial / Access Control

- Te `/platform/tenants`, testo:
  - `Zgjat trial 14 dite`
  - `Aktivizo 30 dite`
  - `Pezullo tenant-in`
- Pas `Pezullo tenant-in`:
  - hyr me tenant user
  - verifiko qe redirect shkon te `/subscription`
- Pas `Aktivizo 30 dite`:
  - hyr prape
  - verifiko qe tenant app hapet normalisht

## 4. Settings Flow

- Hape `/settings`
- Ndrysho:
  - `Emri i biznesit`
  - `Lloji i katalogut`
  - `Ngjyra primare`
- Ruaj
- Verifiko qe:
  - header / branding rifreskohet
  - template label ndryshon

### Kategori

- Shto kategori te re
- Ri-emerto kategori ekzistuese
- Aktivizo / çaktivizo kategori
- Nese kategoria ka produkte:
  - verifiko qe `Fshi` e arkivon, jo e fshin

### Variabla

- Te nje kategori, ndrysho:
  - `Etiketa e emrit`
  - `Brandi`
  - `Nje foto per ngjyre`
- Shto `Materiali` ose `Fuqia`
- Shto nje `Custom variable`
- Ruaj
- Hape prape `/settings`
- Verifiko qe konfigurimi eshte persisted

## 5. Product Flow

- Hape `/products/new`
- Verifiko qe:
  - kategorite vijne nga tenant-i
  - `brand` shfaqet vetem kur eshte aktiv
  - etiketa e emrit vjen nga config i kategorise
- Krijo produkt te ri
- Verifiko qe del ne `/products`

## 6. Variant Flow

### Footwear

- Krijo produkt ne kategori `Patika` ose `Kepuce`
- Hape `Shto variante`
- Verifiko:
  - `nje foto per ngjyre`
  - `numrat poshte ngjyres`
  - `stok` dhe `cmim`
  - custom fields
- Ruaj
- Hape `Edit variant`
- Verifiko qe custom fields shfaqen dhe ruhen

### Other Catalogs

- Krijo produkt ne `Pajisje elektrike` ose `Lini shtepie`
- Verifiko qe forma e variantit ndryshon sipas kategorise
- Testo `Materiali`, `Fuqia` dhe custom fields

## 7. Product Details / Inventory View

- Hape nje produkt me variante
- Verifiko:
  - filtrat
  - shfaqjen e custom attributes
  - stock totals
  - edit/delete variant

## 8. Users / Access

- Hape `/users`
- Krijo:
  - `SELLER`
  - `WAREHOUSE`
- Verifiko login per secilin rol
- Verifiko kufizimet:
  - `SELLER` nuk duhet te menaxhoje usera
  - `WAREHOUSE` nuk duhet te krijoje produkte
- Testo `reset password`
- Verifiko qe password reset funksionon vetem brenda tenant-it aktiv

## 9. Orders

- Hape `/orders/new`
- Krijo porosi normale
- Hape `/orders/quick`
- Krijo porosi te shpejte
- Verifiko:
  - uljen e stokut
  - shfaqjen ne listat e porosive
  - ndryshimin e statusit

## 10. Stock Incoming

- Hape `/stock/incoming`
- Shto hyrje stoku
- Verifiko:
  - krijimin e `stockMovement`
  - rritjen e stokut te variantit

## 11. Reports

- Hape `/reports`
- Verifiko qe raporti ngarkohet vetem per tenant-in aktiv
- Testo PDF report

## 12. Tenant Isolation

- Krijo ose perdor tenant te dyte
- Hyr me tenant 1
- verifiko qe:
  - nuk sheh produktet e tenant 2
  - nuk sheh porosite e tenant 2
  - nuk sheh userat e tenant 2
- hyr me tenant 2 dhe verifiko te njejten gje ne anen tjeter

## 13. Regression Checks

- `owner login` -> owner console
- `tenant login` -> tenant app
- `platform routes` nuk duhen hapur nga user normal
- `tenant routes` nuk duhen perdorur si owner pa tenant membership

## Ready for Client Trial

App-i konsiderohet gati per trial nga klienti vetem nese kalohen:

- owner flow
- tenant onboarding
- access control
- product + variant creation
- custom attributes
- orders
- stock incoming
- tenant isolation
