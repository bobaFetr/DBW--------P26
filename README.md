# Paralyze Website

This is a frontend-only static Next.js website. Public content is stored in
`data/temporaryContent.js`; edit that file to update albums, singles, concerts,
gallery items, news, members, and timeline entries.

## Local development

```bash
npm install
npm run dev
```

## Build and test

```bash
npm test
npm run lint
npm run build
```

The production build is exported as static files in `out/` and can be hosted on
any static web host.
