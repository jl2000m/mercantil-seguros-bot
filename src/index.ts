import { chromium, Browser, Page } from 'playwright';
import { QuoteConfig, QuoteResult, CatalogData, CatalogOption } from './types';
import { defaultConfig, QUOTE_URL, SELECTORS } from './config';
import * as path from 'path';
import * as fs from 'fs';

class MercantilSegurosBot {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    console.log('🚀 Initializing browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-images', // Disable images to speed up loading
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    this.page = await this.browser.newPage();
    
    // Block unnecessary resources to speed up page load
    await this.page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      // Block images, fonts, and media to speed up loading
      if (['image', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Set smaller viewport (enough for the form)
    await this.page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('✅ Browser initialized');
  }

  async generateQuote(config: QuoteConfig = defaultConfig): Promise<QuoteResult> {
    if (!this.page) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    try {
      console.log('📋 Starting quote generation with config:', config);
      
      // Navigate to the quote page
      console.log(`🌐 Navigating to ${QUOTE_URL}...`);
      // Use 'load' instead of 'networkidle' to avoid timeout issues with continuous network activity
      await this.page.goto(QUOTE_URL, { 
        waitUntil: 'load',
        timeout: 60000 // Increase timeout to 60 seconds
      });
      
      // Wait for the form to be visible
      await this.page.waitForSelector(SELECTORS.tripType, { timeout: 15000 });
      console.log('✅ Page loaded successfully');

      // Fill in Trip Type
      console.log(`📝 Selecting trip type: ${config.tripType}`);
      await this.page.selectOption(SELECTORS.tripType, config.tripType);
      // Reduced wait time - only wait if needed
      await this.page.waitForTimeout(300);

      // Get available destinations for this trip type
      const availableDestinations = await this.getAvailableDestinations(config.tripType);
      console.log(`📋 Available destinations for "${config.tripType}": ${availableDestinations.map(d => d.text).join(', ')}`);

      // Fill in Origin
      console.log(`📝 Selecting origin: ${config.origin}`);
      
      // Get all origin options and find the one that matches
      const originOptions = await this.page.locator(`${SELECTORS.origin} option`).all();
      let originValue: string | null = null;
      
      for (const option of originOptions) {
        const text = await option.textContent();
        if (text && text.trim().includes(config.origin)) {
          originValue = await option.getAttribute('value');
          break;
        }
      }
      
      if (originValue && originValue !== '') {
        await this.page.selectOption(SELECTORS.origin, originValue);
        console.log(`✅ Selected origin "${config.origin}" with value: ${originValue}`);
      } else {
        throw new Error(`Origin "${config.origin}" not found in dropdown`);
      }
      await this.page.waitForTimeout(500);

      // Fill in Destination - use the already fetched available destinations
      console.log(`📝 Selecting destination: ${config.destination}`);
      
      // Find the destination in available options
      const destinationOption = availableDestinations.find(
        d => d.text.toLowerCase().includes(config.destination.toLowerCase()) ||
             config.destination.toLowerCase().includes(d.text.toLowerCase())
      );
      
      if (destinationOption) {
        await this.page.selectOption(SELECTORS.destination, destinationOption.value);
        console.log(`✅ Selected destination "${destinationOption.text}" with value: ${destinationOption.value}`);
      } else {
        const availableNames = availableDestinations.map(d => d.text).join(', ');
        throw new Error(
          `Destination "${config.destination}" not available for trip type "${config.tripType}". ` +
          `Available destinations: ${availableNames}`
        );
      }
      await this.page.waitForTimeout(500);

      // Agent/Agency is already pre-filled, but we can verify or set it
      if (config.agent) {
        console.log(`📝 Setting agent: ${config.agent}`);
        await this.page.selectOption(SELECTORS.agent, config.agent);
        await this.page.waitForTimeout(300);
      }

      // Fill in Date Range
      console.log(`📝 Setting date range: ${config.departureDate} - ${config.returnDate}`);
      const dateRangeInput = this.page.locator(SELECTORS.dateRange);
      await dateRangeInput.click();
      await this.page.waitForTimeout(300);
      
      // Clear and set the date range
      await dateRangeInput.fill(`${config.departureDate} - ${config.returnDate}`);
      await this.page.waitForTimeout(500);
      
      // Close calendar if it's open by clicking outside or pressing Escape
      try {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(200);
      } catch (error) {
        // Calendar might not be open, continue
      }

      // Set Passenger Count
      console.log(`📝 Setting passenger count: ${config.passengers}`);
      await this.page.selectOption(SELECTORS.passengerCount, config.passengers.toString());
      await this.page.waitForTimeout(500); // Wait for age inputs to appear

      // Fill in Ages
      console.log(`📝 Setting passenger ages: ${config.ages.join(', ')}`);
      for (let i = 0; i < config.ages.length; i++) {
        const ageInput = this.page.locator(SELECTORS.ageInput(i));
        await ageInput.waitFor({ state: 'visible', timeout: 5000 });
        await ageInput.fill(config.ages[i].toString());
        await this.page.waitForTimeout(200);
      }

      // Take a screenshot before submission
      const screenshotDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const screenshotPath = path.join(screenshotDir, `quote-before-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Submit the form
      console.log('🚀 Submitting form...');
      
      // Ensure calendar is closed before looking for the button
      try {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(200);
      } catch (error) {
        // Calendar might not be open, continue
      }
      
      // Use getByRole to specifically target the "COTIZAR SEGURO" button
      const submitButton = this.page.getByRole('button', { name: 'COTIZAR SEGURO' });
      
      // Scroll to the button to ensure it's visible
      await submitButton.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(300);
      
      // Wait for the button to be visible and enabled
      await submitButton.waitFor({ state: 'visible', timeout: 5000 });
      
      await submitButton.click();

      console.log('⏳ Waiting for quotes to load...');
      
      // Wait for the loading indicator to appear (if it does)
      try {
        await this.page.waitForSelector('#loading', { state: 'visible', timeout: 2000 });
        console.log('📊 Loading indicator appeared, waiting for it to disappear...');
      } catch (error) {
        // Loading indicator might not appear, continue
      }

      // Wait for the loading indicator to disappear
      try {
        await this.page.waitForSelector('#loading', { state: 'hidden', timeout: 30000 });
        console.log('✅ Loading indicator disappeared');
      } catch (error) {
        console.log('⚠️ Loading indicator check timed out, continuing...');
      }

      // Wait for quote cards to appear
      console.log('📋 Waiting for quote cards to appear...');
      try {
        await this.page.waitForSelector('.item-block', { state: 'visible', timeout: 30000 });
        console.log('✅ Quote cards appeared');
      } catch (error) {
        console.warn('⚠️ Quote cards not found, but continuing...');
      }

      // Additional wait to ensure all content is loaded
      await this.page.waitForTimeout(1000);

      // Check if we're redirected or if there's a result
      const currentUrl = this.page.url();
      console.log(`📍 Current URL after submission: ${currentUrl}`);

      // Take a screenshot after submission
      const screenshotAfterPath = path.join(screenshotDir, `quote-after-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotAfterPath, fullPage: true });
      console.log(`📸 Post-submission screenshot saved: ${screenshotAfterPath}`);

      // Try to extract quote data if available
      let quoteData = null;
      try {
        // Extract quote plans from the page
        const quotePlans = await this.page.locator('.item-block').all();
        const plans: Array<{ name: string; price: string; planId: string }> = [];

        for (const planCard of quotePlans) {
          try {
            const planName = await planCard.locator('h3').first().textContent();
            const planPrice = await planCard.locator('p.text-color-light.opacity-7').first().textContent();
            const planId = await planCard.locator('form').first().getAttribute('id');
            
            if (planName && planPrice) {
              plans.push({
                name: planName.trim(),
                price: planPrice.trim(),
                planId: planId || '',
              });
            }
          } catch (error) {
            // Skip this plan if extraction fails
          }
        }

        const quoteContent = await this.page.content();
        quoteData = {
          url: currentUrl,
          contentLength: quoteContent.length,
          plans: plans,
          planCount: plans.length,
        };
        
        console.log(`📊 Found ${plans.length} quote plans:`);
        plans.forEach((plan, index) => {
          console.log(`  ${index + 1}. ${plan.name} - ${plan.price}`);
        });
      } catch (error) {
        console.warn('⚠️ Could not extract quote data:', error);
        const quoteContent = await this.page.content();
        quoteData = {
          url: currentUrl,
          contentLength: quoteContent.length,
        };
      }

      return {
        success: true,
        quoteData,
        screenshotPath: screenshotAfterPath,
      };
    } catch (error) {
      console.error('❌ Error generating quote:', error);
      
      // Take error screenshot
      const screenshotDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const errorScreenshotPath = path.join(screenshotDir, `error-${Date.now()}.png`);
      if (this.page) {
        await this.page.screenshot({ path: errorScreenshotPath, fullPage: true });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        screenshotPath: errorScreenshotPath,
      };
    }
  }

  async scrapeCatalog(): Promise<CatalogData> {
    if (!this.page) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    console.log('📚 Scraping catalog data...');

    // Navigate to the quote page if not already there
    const currentUrl = this.page.url();
    if (!currentUrl.includes('mercantilseguros.com')) {
      await this.page.goto(QUOTE_URL, { waitUntil: 'load', timeout: 60000 });
      await this.page.waitForSelector(SELECTORS.tripType, { timeout: 15000 });
    }

    // Scrape Trip Types
    const tripTypeOptions = await this.page.locator(`${SELECTORS.tripType} option`).all();
    const tripTypes: CatalogOption[] = [];
    for (const option of tripTypeOptions) {
      const value = await option.getAttribute('value');
      const text = await option.textContent();
      if (value && value !== '' && text) {
        tripTypes.push({
          value: value.trim(),
          text: text.trim(),
        });
      }
    }
    console.log(`✅ Found ${tripTypes.length} trip types`);

    // Scrape Origins
    const originOptions = await this.page.locator(`${SELECTORS.origin} option`).all();
    const origins: CatalogOption[] = [];
    for (const option of originOptions) {
      const value = await option.getAttribute('value');
      const text = await option.textContent();
      if (value && value !== '' && text && text.trim() !== 'Seleccione') {
        origins.push({
          value: value.trim(),
          text: text.trim(),
        });
      }
    }
    console.log(`✅ Found ${origins.length} origins`);

    // Scrape Destinations for each Trip Type
    const destinations: { [tripType: string]: CatalogOption[] } = {};

    for (const tripType of tripTypes) {
      if (tripType.value === '') continue;

      console.log(`📝 Checking destinations for trip type: ${tripType.text}`);
      
      // Select the trip type
      await this.page.selectOption(SELECTORS.tripType, tripType.value);
      await this.page.waitForTimeout(500); // Wait for destination options to update

      // Get all destination options
      const destinationOptions = await this.page.locator(`${SELECTORS.destination} option`).all();
      const availableDestinations: CatalogOption[] = [];

      for (const option of destinationOptions) {
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        const disabled = await option.getAttribute('disabled');
        const dataFilter = await option.getAttribute('data-filter');
        const style = await option.getAttribute('style');

        // Skip if disabled or hidden
        if (disabled || (style && style.includes('display: none'))) {
          continue;
        }

        if (value && value !== '' && text && text.trim() !== 'Seleccione') {
          availableDestinations.push({
            value: value.trim(),
            text: text.trim(),
            disabled: !!disabled,
            dataFilter: dataFilter || undefined,
          });
        }
      }

      destinations[tripType.value] = availableDestinations;
      console.log(`  ✅ Found ${availableDestinations.length} destinations: ${availableDestinations.map(d => d.text).join(', ')}`);
    }

    // Scrape Agents
    const agentOptions = await this.page.locator(`${SELECTORS.agent} option`).all();
    const agents: CatalogOption[] = [];
    for (const option of agentOptions) {
      const value = await option.getAttribute('value');
      const text = await option.textContent();
      if (value && value !== '' && text && text.trim() !== 'Seleccione') {
        agents.push({
          value: value.trim(),
          text: text.trim(),
        });
      }
    }
    console.log(`✅ Found ${agents.length} agents`);

    const catalog: CatalogData = {
      tripTypes,
      origins,
      destinations,
      agents,
    };

    console.log('✅ Catalog scraping complete!');
    return catalog;
  }

  async getAvailableDestinations(tripType: string): Promise<CatalogOption[]> {
    if (!this.page) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    // Select the trip type
    await this.page.selectOption(SELECTORS.tripType, tripType);
    await this.page.waitForTimeout(500);

    // Get all destination options
    const destinationOptions = await this.page.locator(`${SELECTORS.destination} option`).all();
    const availableDestinations: CatalogOption[] = [];

    for (const option of destinationOptions) {
      const value = await option.getAttribute('value');
      const text = await option.textContent();
      const disabled = await option.getAttribute('disabled');
      const style = await option.getAttribute('style');

      // Skip if disabled or hidden
      if (disabled || (style && style.includes('display: none'))) {
        continue;
      }

      if (value && value !== '' && text && text.trim() !== 'Seleccione') {
        availableDestinations.push({
          value: value.trim(),
          text: text.trim(),
          disabled: !!disabled,
        });
      }
    }

    return availableDestinations;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Scrape catalog function
async function scrapeCatalog() {
  const bot = new MercantilSegurosBot();
  
  try {
    await bot.initialize();
    const catalog = await bot.scrapeCatalog();
    
    // Save catalog to JSON file
    const catalogDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(catalogDir)) {
      fs.mkdirSync(catalogDir, { recursive: true });
    }
    const catalogPath = path.join(catalogDir, `catalog-${Date.now()}.json`);
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
    
    console.log(`\n📁 Catalog saved to: ${catalogPath}`);
    console.log('\n📊 Catalog Summary:');
    console.log(`  Trip Types: ${catalog.tripTypes.length}`);
    console.log(`  Origins: ${catalog.origins.length}`);
    console.log(`  Agents: ${catalog.agents.length}`);
    console.log('\n  Destinations by Trip Type:');
    for (const [tripType, destinations] of Object.entries(catalog.destinations)) {
      const tripTypeName = catalog.tripTypes.find(t => t.value === tripType)?.text || tripType;
      console.log(`    ${tripTypeName}: ${destinations.map(d => d.text).join(', ')}`);
    }
    
    return catalog;
  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  } finally {
    await bot.close();
  }
}

// Main execution
async function main() {
  const bot = new MercantilSegurosBot();
  
  try {
    await bot.initialize();
    
    // Use default config or customize
    const customConfig: QuoteConfig = {
      ...defaultConfig,
      // Override defaults here if needed
      // tripType: 'Anual Multiviaje',
      // origin: 'Venezuela',
      // destination: 'Europa', // For "Viajes Por Día": 'Europa' or 'Resto del Mundo'
      // destination: 'Mundial', // For "Anual Multiviaje": 'Mundial'
      // departureDate: '01/02/2026',
      // returnDate: '10/02/2026',
      passengers: 6,
      ages: [35, 32, 28, 25, 22, 20], // 6 ages for 6 passengers
    };

    const result = await bot.generateQuote(customConfig);
    
    if (result.success) {
      console.log('✅ Quote generated successfully!');
      console.log('📊 Quote data:', result.quoteData);
      if (result.screenshotPath) {
        console.log(`📸 Screenshot: ${result.screenshotPath}`);
      }
    } else {
      console.error('❌ Failed to generate quote:', result.error);
      if (result.screenshotPath) {
        console.log(`📸 Error screenshot: ${result.screenshotPath}`);
      }
    }
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await bot.close();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--scrape') || args.includes('-s')) {
    scrapeCatalog().catch(console.error);
  } else {
    main().catch(console.error);
  }
}

export { MercantilSegurosBot, scrapeCatalog };

