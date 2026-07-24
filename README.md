# Home Cash-Flow Calculator

A simplified Canadian home-buying and renting cash-flow calculator built with Next.js.

## Features

- Separate buying and renting worksheets
- Buy-vs.-rent comparison on a shared 25-year timeline
- Canadian mortgage calculations using semi-annual compounding
- Estimated CMHC mortgage-insurance premiums for eligible down payments below 20%
- Principal, interest, mortgage balance, and equity breakdowns
- Five-year mortgage renewal-rate scenarios with payment recalculation
- Optional annual rent-increase projection
- Selling and exit scenarios with equity composition, net sale proceeds, and lifetime ownership result
- Named saved configs for houses or scenarios

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

To make saved configs global for every visitor, add a Vercel KV or Upstash Redis
store and set these environment variables in Vercel:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

The API also accepts Vercel integration-prefixed names:

```bash
DB_KV_REST_API_URL=...
DB_KV_REST_API_TOKEN=...
```

Without those variables, saved configs fall back to browser-only local storage.
