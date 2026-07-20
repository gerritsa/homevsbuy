# Home vs. Buy

A Canadian home-buying and renting calculator built with Next.js.

## Features

- Separate buying and renting worksheets
- Buy-vs.-rent comparison on a shared 25-year timeline
- Canadian mortgage calculations using semi-annual compounding
- Principal, interest, mortgage balance, and equity breakdowns
- Flat-rent projection with no annual rent increase

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run build
npm test
npm run lint
```

## Deployment

The production build uses standard Next.js and is ready for Vercel. Import the
GitHub repository into Vercel, deploy it, then add
`homevsbuy.sustainabel.com` under the project’s Domains settings.
