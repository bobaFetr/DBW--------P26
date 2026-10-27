# План за защита и поддръжка на бъдещия бекенд

Начална дата: 27.10.2026 г. Приложимо към ASP.NET Core / EF Core / PostgreSQL в този
проект. Бекендът не е част от текущия Render static deployment. Този файл е план,
а не потвърждение за готов production backend или активирано наблюдение.

## Цел спрямо REA

REA може да научи URL адреси, формати на заявки и видимо поведение от frontend.
Това не трябва да дава достъп до C# source, assemblies, база, credentials, drafts,
акаунти или промени в сайта. Endpoint имената не са тайни. Всеки privileged request
трябва да се проверява на сървъра, дори изпратен от собствен инструмент без frontend.

Не публикувай backend binaries: .NET assemblies могат да бъдат декомпилирани при
получен достъп до тях. Server-side изпълнението пази implementation от обикновения
посетител, но не гарантира защита при компрометиран хост, image registry или repository.
Не предоставяй proprietary логика като JavaScript/WASM, ако трябва да остане непублична.

## Условия преди първото публикуване

Всички точки по-долу изискват изпълнение и доказателство в staging:

- [ ] Отдели public read API от privileged маршрути. Защити admin UI и всички privileged
  API маршрути с MFA (identity gateway или пълен приложен MFA flow). Блокирай origin
  bypass през provider домейн. Identity schema с `TwoFactorEnabled` не е готов MFA flow.
- [ ] Създай уникални production secrets в secret storage. Не използвай публикуваните
  development пароли, локална база с известни акаунти или чувствителни `NEXT_PUBLIC_*`.
  Контролирай bootstrap: текущият seeder може да създаде два администратора на празна база.
- [ ] Провери `.dockerignore`, build context и крайния image/publish directory: без local/
  development settings, keys, `.env`, `.git`, backups и ненужен source. Не качвай image
  с private assemblies в публичен registry. Използвай непривилегирован runtime user.
- [ ] Базата е достъпна само за необходимите услуги, с отделен runtime потребител.
  Миграциите се изпълняват от отделна deployment identity, а не с постоянни DDL права.
- [ ] Изисквай `SSL Mode=VerifyFull` за production TCP PostgreSQL и подходяща CA/hostname
  проверка. Текущият guard позволява `Allow`, а URI default е `Require`; поправи това.
- [ ] Настрой `Production`, точни `AllowedHosts`/HTTPS CORS origins и доверени proxy
  addresses/networks. Не приемай произволни forwarded headers. Провери реален client IP,
  HTTPS scheme и rate limits зад действителния хостинг proxy.
- [ ] Осигури защитено persistent Data Protection key storage; споделено при replicas,
  със стабилна application identity. Провери cookies през restart и deployment.
- [ ] Запази HttpOnly/Secure cookies, CSRF за unsafe methods, lockout и session revocation.
  Избери SameSite според реалните домейни; не разчитай на CORS за авторизация.
- [ ] Сложи `no-store` на чувствителни auth/admin отговори и изключи споделено CDN кеширане.
- [ ] Промени production CSP само за нужните HTTPS API/media origins. Текущото
  `connect-src 'none'` умишлено не позволява backend връзки. `ENABLE_LOCAL_ADMIN` е
  локален механизъм; планирай отделно production admin hosting, не просто включване.
- [ ] Реши жизнения цикъл на media: текущият anonymous video GET не изисква approval.
  За drafts въведи проверка на достъпа и отделно публикуване; UUID не е авторизация.
- [ ] Добави decode/format validation, pixel/size limits, quotas и cleanup за uploads.
  Ограничѝ RAM/concurrency: текущият video upload буферира файлове до 100 MB.
- [ ] Поправи unchecked pagination offsets; прегледай error responses за излишни подробности.
- [ ] Активирай alerts за login failures, privilege промени, uploads, отказани заявки,
  неочаквани deployments и database/storage натоварване. Не логвай пароли/cookies/tokens.
- [ ] Направи backup и докажи restore в изолирана среда. Запиши rollback процедура за
  приложение и schema: връщане на стар image не отменя автоматично database migration.

## Матрица за проверки при промени по достъпа

| Сценарий | Очакване |
| --- | --- |
| Анонимен клиент и privileged endpoint | Отказ, без промяна в базата |
| ContentAdmin извиква super-admin операция | Отказ, без промяна |
| Потребител сменя ID към чужда заявка/draft | Отказ според ownership политика |
| Изтрит/disabled/kicked администратор използва стара cookie | Отказ и прекратена сесия |
| POST/PUT/DELETE без валиден CSRF | Отказ |
| Повторно approval/cancel или неправилен workflow ред | Конфликт/отказ без дублиране |
| Директна заявка извън разрешен frontend origin | Същите server permissions; CORS не е достатъчен |
| Подправени proxy headers | Не сменят trusted client identity извън разрешената proxy верига |
| Непубликуван upload | Недостъпен анонимно, ако политиката изисква private draft |
| Прекалени login/upload заявки | Контролиран отказ/429 без неограничен ресурсен разход |

Пускай destructive/abuse проверки само в staging с тестови данни и известни лимити.
Използвай реална PostgreSQL интеграция за transaction/concurrency поведение; in-memory
unit tests не доказват тези свойства на production база.

## График след deployment

| Честота | Действие |
| --- | --- |
| Постоянно чрез избрано наблюдение | Availability, error rate, откази за вход, privilege промени, storage/CPU/RAM |
| Всеки работен ден | Преглед на alerts и backup status; разследване на отклонения |
| Всяка седмица | NuGet/npm advisories, .NET runtime/container updates, authentication събития |
| Преди всеки release | Тестове, authorization матрица при засегнати функции, image/secret scan, staging и rollback план |
| Всеки месец | Поддържани .NET/EF/Npgsql/PostgreSQL версии, базов image rebuild, достъпи и quotas |
| На 3 месеца | Restore drill, отнемане на тестов admin достъп, проверка на keys/recovery и origin bypass |

Синхронизирай месечния преглед с датите от `SECURITY_MAINTENANCE_STATIC_BG.md`.
Ако бекендът още не е публикуван, изпълнявай dependency/source прегледа; production
monitoring/backup процедурите започват при реалното му пускане.
Приложим активно експлоатиран критичен проблем: оценка и ограничаване в същия ден;
high: цел до 72 часа; moderate: до 14 дни. Документирай приложимостта и нерешените рискове.

## Команди за редовна проверка

От корена в PowerShell:

```powershell
dotnet --info
dotnet list "Back End/MyApi/MyApi.csproj" package --outdated
dotnet list "Back End/MyApi/MyApi.csproj" package --vulnerable --include-transitive
dotnet test "Back End/MyApi.Tests/MyApi.Tests.csproj" /m:1
npm.cmd run test:frontend
npm.cmd run lint
npm.cmd run build
```

Актуализирай целево, след прочетени официални advisories/release notes и compatibility
между .NET, EF Core, Npgsql и PostgreSQL. Преизгради container с поправен runtime image;
само NuGet обновление не обновява вече работещ image. Провери и OS/container advisories.
При неуспешна advisory връзка резултатът е „непроверено“, а не „няма уязвимости“.

За интеграционни проверки с истинска база следвай изискванията на
`scripts/AdminTransactionChecks`; те създават/премахват scratch база. Не ги насочвай
към production credentials или production данни.

## При съмнение за пробив

Ограничи административния достъп/засегнат endpoint, запази logs и доказателства,
отмени компрометирани tokens/сесии и смени засегнатите secrets. Провери неизвестни
потребители, роли, jobs и deployments. При компрометирани cookie-protection keys
планирай и принудително прекратяване на съответните сесии. Възстановявай само проверени
images/данни и провери достъпа отново. Запиши причина, обхват, действия и превенция.

## Доказателства и граници

Последният локален NuGet scan не намери известни уязвимости в използваните sources;
предишните 133 backend tests преминаха. Това не доказва production сигурност и не
замества повторна проверка при release. Не записвай реални credentials в този файл.

За всеки release запиши: дата, commit/image digest, advisories и приложимост, резултати
от тестове/сканиране, staging проверка, backup/restore evidence и отговорник. Не оставяй
неизпълнените launch условия като подразбиращо се „готово“.

## Официални източници

- [OWASP API security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Npgsql TLS](https://www.npgsql.org/doc/security.html)
- [ASP.NET proxy configuration](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0)
- [ASP.NET Data Protection](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0)
- [REA browser observation](https://github.com/morluto/rea/blob/main/docs/browser-observation.md)
