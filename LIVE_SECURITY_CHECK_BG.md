# Проверка на публикувания Paralyze сайт

Дата: 27.10.2026 г., около 12:52–12:55 ч. Europe/Sofia.
Адрес: https://paralyze-site.onrender.com

Изпълнени са ограничени публични HTTP заявки за четене. Не са извършвани промени,
вход в акаунти, натоварващи тестове или експлоатация на уязвимости.
Подробните резултати са в `LIVE_SECURITY_CHECK.json`; повторение:
`node --use-system-ca scripts/check-deployed-static.cjs`.

## Потвърдено

- HTTP пренасочва към HTTPS с 301; HTTPS началната страница връща 200.
- Всичките 12 проверени public routes връщат 200.
- На public страниците са налични CSP, HSTS, nosniff, X-Frame-Options DENY,
  Referrer-Policy и Permissions-Policy. CSP включва `connect-src 'none'`,
  `script-src 'self'`, забрана за frames/objects и няма unsafe-inline/unsafe-eval.
- В HTML на тези страници няма inline script bodies.
- Проверени са 63 директно открити JS/CSS/icon ресурса; всички връщат 200.
  В проверените текстови ресурси не са открити избраните admin code маркери,
  private-key/database-URI шаблони или localhost:5001 API адреси.
- Проверени са 61 съответстващи `.js.map` адреса: не е открит достъпен source map.
- Един конкретен admin bundle URL от локалния build връща 404. Това не е
  изчерпателна проверка на всички исторически hashed URL адреси.
- `/.env`, `/.env.local`, `/.git/config`, `/package.json`, `/package-lock.json`,
  `/appsettings.json`, `/next.config.mjs`,
  `/Back%20End/MyApi/appsettings.Development.json` и
  `/SECURITY_DEPLOYMENT_REVIEW.md` връщат 404 без проверените sensitive patterns.
- `/api/auth/me` и `/api/content/news` връщат 404 на този origin.

## Забележка за /admin/

`/admin/` и `/admin/index.html` връщат HTTP 200, но HTML title е
`Paralyze | Page Not Found`, без намерени admin-login маркери. Не е установен
достъпен админ интерфейс. Това е поведение на страница за грешка с успешен HTTP
статус (soft 404), а не доказателство за работещ backend/admin.

Произволен несъществуващ route връща истински 404. Прегледай Render rewrite/redirect
правилата и CDN кеша за admin адресите; целта е и те да връщат 404 след премахване
на статичния admin output. Не е променяна хостинг конфигурация и не е установена
точната причина за разликата.

## Граници на резултата

Няма данни от тези проверки за публично изложени проверени служебни файлове,
админ интерфейс или secrets, съвпадащи с използваните шаблони. Това не доказва
липса на други уязвимости/тайни и не е пълен penetration test.

HTML на live страниците не е byte-for-byte идентичен с локалния output. Отделните
build идентификатори могат да се различават; без hosting deployment log не се
удостоверява commit идентичност само по HTML. Провери deployed commit в Render.

Не са проверени акаунтите/MFA, registrar/DNS достъпите, всички исторически assets,
други домейни, интерактивно browser изпълнение, mobile жестове или медия, зареждана
след JavaScript. HTTP 200 на страница не удостоверява работата на интеракциите.

REA продължава да може да прочете публичните HTML/CSS/JavaScript. Тази проверка
оценява публична експозиция и headers, не предоставя „невидим код“ или гаранция
срещу копиране. Не изпращай реални пароли или recovery codes за последващи проверки.
