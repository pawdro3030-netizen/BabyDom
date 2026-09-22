# BabyDom v14 — Vercel + Przelewy24 SANDBOX

Ustaw w Vercel Root Directory na `/`.

## Environment Variables w Vercel
- P24_MODE = sandbox
- P24_POS_ID = ID konta/POS Sandbox
- P24_MERCHANT_ID = Merchant ID (jeśli taki sam jak POS, wpisz tę samą wartość)
- P24_API_KEY = klucz API / klucz do raportów Sandbox
- P24_CRC = klucz CRC Sandbox
- SITE_URL = adres projektu, np. https://baby-dom.vercel.app

Nie dodawaj P24_API_KEY ani P24_CRC do GitHuba.

Ta wersja jest celowo zablokowana na SANDBOX. Dostawa ma 0 zł tylko na potrzeby testu płatności. Przed produkcją trzeba dodać prawdziwe metody/ceny dostawy oraz trwałe zapisywanie zamówień.
