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
