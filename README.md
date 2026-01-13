# Mercantil Seguros Travel Insurance Bot

Automated bot to generate travel insurance quotes from Mercantil Seguros website.

## Features

- 🤖 Automated form filling
- 📸 Screenshot capture before and after submission
- 🔧 Configurable quote parameters
- 📋 TypeScript support with full type safety
- 🎯 Playwright-based automation (reliable and modern)

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run install-browsers
```

## Usage

### Scrape Catalog (Discover All Combinations)

First, scrape all available options from the website:

```bash
npm run scrape
```

This will:
- Discover all trip types
- Discover all origin countries
- Discover all destinations (and which ones are available for each trip type)
- Discover all agents
- Save the catalog to `data/catalog-[timestamp].json`

### Basic Usage

Run the bot with default configuration:

```bash
npm run dev
```

Or build and run:

```bash
npm run build
npm start
```

### Customizing Quote Parameters

Edit `src/index.ts` to customize the quote configuration:

```typescript
const customConfig: QuoteConfig = {
  tripType: 'Viajes Por Día', // or 'Anual Multiviaje'
  origin: 'Venezuela',
  destination: 'Europa', // or 'Resto del Mundo' or 'Mundial'
  departureDate: '01/02/2026', // Format: DD/MM/YYYY
  returnDate: '10/02/2026',
  passengers: 2,
  ages: [35, 32], // Array length must match passengers count
  agent: '2851', // Optional: Risk Management Seguros default
};
```

### Programmatic Usage

```typescript
import { MercantilSegurosBot } from './src/index';
import { QuoteConfig } from './src/types';

const bot = new MercantilSegurosBot();
await bot.initialize();

const config: QuoteConfig = {
  tripType: 'Viajes Por Día',
  origin: 'Panamá',
  destination: 'Mundial',
  departureDate: '13/01/2026',
  returnDate: '15/01/2026',
  passengers: 1,
  ages: [30],
};

const result = await bot.generateQuote(config);
console.log(result);

await bot.close();
```

## Configuration Options

### Trip Types
- `'Viajes Por Día'` - Daily trips
- `'Anual Multiviaje'` - Annual multi-trip

### Destinations
**Important:** Available destinations depend on the trip type selected:
- For `'Viajes Por Día'`: `'Europa'` or `'Resto del Mundo'`
- For `'Anual Multiviaje'`: `'Mundial'`

The bot automatically detects available destinations based on the selected trip type.

### Origins
Any country name as it appears in the dropdown (e.g., 'Panamá', 'Venezuela', 'United States of America')

## Output

The bot will:
1. Generate screenshots in the `screenshots/` directory
2. Return a `QuoteResult` object with:
   - `success`: boolean indicating if the quote was generated
   - `quoteData`: extracted data from the quote page
   - `error`: error message if failed
   - `screenshotPath`: path to the screenshot

## Development

### Project Structure

```
.
├── src/
│   ├── index.ts       # Main bot logic and catalog scraper
│   ├── types.ts       # TypeScript type definitions
│   └── config.ts      # Configuration and constants
├── dist/              # Compiled JavaScript (generated)
├── screenshots/       # Screenshots (generated)
├── data/              # Catalog JSON files (generated)
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

### Running in Headless Mode

Edit `src/index.ts` and change:

```typescript
this.browser = await chromium.launch({
  headless: true, // Change to true
  slowMo: 100,
});
```

## Troubleshooting

### Browser not found
Run `npm run install-browsers` to install Playwright browsers.

### Form elements not found
- The website might have changed its structure
- Check the selectors in `src/config.ts`
- Increase timeout values if the page loads slowly

### Date format issues
Ensure dates are in `DD/MM/YYYY` format (e.g., `13/01/2026`)

## License

MIT

