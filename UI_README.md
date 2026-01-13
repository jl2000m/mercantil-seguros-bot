# Mercantil Seguros Bot - UI

A Next.js web interface for testing the Mercantil Seguros travel insurance quote bot.

## Features

- 📋 **Complete Form**: All possible combinations from the catalog
- 🎯 **Dynamic Destinations**: Destinations update based on selected trip type
- 👥 **Multiple Passengers**: Support for 1-8 passengers with individual age inputs
- ⏳ **Loading Screen**: Beautiful loading/calculating indicator
- 📊 **Quote Display**: Grid layout showing all available insurance plans
- 🎨 **Modern UI**: Gradient design with responsive layout

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the UI

```bash
npm run ui
```

The UI will be available at `http://localhost:3000`

### 3. Build for Production

```bash
npm run ui:build
npm run ui:start
```

## Usage

1. **Select Trip Type**: Choose between "Viajes Por Día" or "Anual Multiviaje"
2. **Select Origin**: Choose the origin country from the dropdown
3. **Select Destination**: Destinations are filtered based on trip type
4. **Select Agent** (Optional): Choose a specific agent/agency
5. **Set Dates**: Pick departure and return dates
6. **Set Passengers**: Select number of passengers (1-8)
7. **Enter Ages**: Enter age for each passenger
8. **Generate Quote**: Click the button to generate quotes

## API Routes

### `/api/catalog`
- **Method**: GET
- **Returns**: Catalog data with all trip types, origins, destinations, and agents

### `/api/quote`
- **Method**: POST
- **Body**: Quote configuration (tripType, origin, destination, dates, passengers, ages, agent)
- **Returns**: Quote result with available plans and prices

## Project Structure

```
app/
  ├── layout.tsx          # Root layout
  ├── page.tsx            # Main UI page
  ├── globals.css         # Global styles
  └── api/
      ├── catalog/
      │   └── route.ts    # Catalog API endpoint
      └── quote/
          └── route.ts    # Quote generation API endpoint
```

## Notes

- The UI loads the most recent catalog file from the `data/` directory
- Quote generation may take 30-60 seconds
- Screenshots are saved to the `screenshots/` directory
- The bot runs in headless mode for the UI (can be configured)

