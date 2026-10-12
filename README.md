# BabyDom — wdrożenie obsługi zamówień

Root Directory Vercel: `/`. Płatności pozostają w sandbox.

## Przed połączeniem gałęzi z main
1. W konsoli SQL bazy wykonaj `migrations/001-order-operations.sql`. Tabela `orders` musi już istnieć z unikalnym `session_id`.
2. W Vercel → Environment Variables → Production ustaw:
   - `ADMIN_TOKEN`: losowe hasło minimum 32 znaki, nie zapisuj w repozytorium.
   - `RESEND_API_KEY`: istniejący klucz Resend.
   - `ORDER_NOTIFICATION_EMAIL`: `babydomcontaact@outlook.com`.
   - `EMAIL_FROM`: nadawca z domeny zweryfikowanej w Resend, np. `BabyDom <zamowienia@twoja-domena.pl>`.
3. Pozostaw `P24_MODE=sandbox`, dotychczasowe klucze P24, `DATABASE_URL` i `SITE_URL`.
4. Po wdrożeniu wejdź na `/admin.html` i użyj ADMIN_TOKEN jako hasła.

Bez EMAIL_FROM używany jest testowy nadawca Resend. Nie umożliwia on wysyłki do dowolnych klientów — wymagana jest weryfikacja własnej domeny. Nie wysyłaj tokenu administratora klientom.

## Zachowanie
Po weryfikacji P24 zamówienie otrzymuje status paid, a klient i właściciel otrzymują potwierdzenie. Błąd wysyłki nie cofa płatności. Panel pokazuje przyjęcie wiadomości przez Resend (nie gwarantuje doręczenia) i pozwala ponowić brakujące wysyłki. Zapisane treści i klucze idempotencji ograniczają duplikaty. Klucze Resend są ważne 24 godziny; przy niepewnym wyniku wysyłki starszym niż doba sprawdź logi Resend przed ponowieniem.

Panel przechowuje hasło tylko w pamięci strony; wylogowanie lub odświeżenie je usuwa. Publiczny test e-mail został zabezpieczony tym samym tokenem i wymaga POST.

## Sprawdzenie po wdrożeniu
- Test sandbox z paczkomatem i kurierem: poniżej 149 zł odpowiednio 12,99 / 15,99 zł; od 149 zł gratis.
- Sprawdź status paid, listę produktów, kod paczkomatu, oba e-maile i brak duplikatów przy ponownym callbacku.
- Wymuś błąd wysyłki i sprawdź ponowienie w panelu.

Przejście P24 na produkcję wymaga osobnej zmiany endpointów i kluczy oraz rzeczywistego testu. Ta gałąź nie uruchamia płatności produkcyjnych.

## Lokalne testy
`node --test tests/order-operations.test.js`

## Panel produktów i cen

Adres: `/admin-products.html` (również link z `/admin.html`). Logowanie za pomocą istniejącego `ADMIN_TOKEN` z Vercel Environment Variables, minimum 32 znaki. Hasło nie jest zapisywane w pamięci trwałej przeglądarki.

Po pierwszym logowaniu panel automatycznie tworzy tabelę `product_overrides` w bazie Neon (alternatywnie można uruchomić `002-product-overrides.sql`). W panelu zmienisz cenę brutto oraz przełączysz produkt między dostępnym a niedostępnym. Ustawienia pozostają w Neon i **nie wymagają commitów GitHub**.

Sklep pobiera aktualne ustawienia z `/api/products` przy otwarciu strony, a przy pozostawieniu otwartej karty odświeża je co 30 sekund. Dodanie do koszyka niedostępnego produktu jest blokowane. `/api/p24-register` bezwzględnie sprawdza aktualną cenę i dostępność w Neon oraz odmawia przyjęcia zamówienia, którego cena zmieniła się od wyświetlenia klientowi. Awaria odczytu katalogu blokuje zakup zamiast potajemnie używać starej ceny.

**Ważne:** dostępność jest ustawiana ręcznie, bez automatycznej synchronizacji z hurtownią. Po wdrożeniu trzeba sprawdzić logowanie, zmianę ceny/dostępności i działanie koszyka na wersji produkcyjnej. Płatności P24 pozostają w sandbox i wymagają osobnego uruchomienia.


## Etap 1 UX sklepu (październik 2026)

- Katalog domyślnie pokazuje oferty dostępne, ma filtr marki, przełącznik dostępności i wyszukiwanie po EAN.
- Koszyk poleca maksymalnie trzy uzupełniające produkty, z pominięciem ofert niedostępnych, już zakupionych oraz mleka modyfikowanego.
- Geowidget InPost przekazuje kod i fizyczny adres wybranego punktu. Adres z mapy wypełnia dotychczasowe pola zamówienia bez ponownego pytania o adres domowy. Dla kuriera oraz niepełnych danych punktu pola adresowe pozostają wymagane.
- Nie zmieniono cen, dostępności, progów dostaw ani integracji Przelewy24; płatności pozostają w sandbox.
- Uruchom `node --test tests/product-admin.test.js`, by sprawdzić również filtry, rekomendacje oraz zachowanie formularza.
