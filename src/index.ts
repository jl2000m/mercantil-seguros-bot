import { chromium, Browser, Page } from 'playwright';
import { QuoteConfig, QuoteResult, CatalogData, CatalogOption, PurchaseFormData, PurchaseFormResult } from './types';
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
      
      // Click to focus the input
      await dateRangeInput.click();
      await this.page.waitForTimeout(100);
      
      // Clear any existing value by selecting all and deleting
      // Use triple-click which works consistently across platforms
      await dateRangeInput.click({ clickCount: 3 });
      await this.page.waitForTimeout(50);
      await this.page.keyboard.press('Backspace');
      await this.page.waitForTimeout(100);
      
      // Type the date range character by character to simulate real user input
      // This is more reliable than setting the value directly, as the date picker
      // library needs to parse the input as it's being typed
      const dateRangeValue = `${config.departureDate} - ${config.returnDate}`;
      await dateRangeInput.type(dateRangeValue, { delay: 30 });
      await this.page.waitForTimeout(300);
      
      // Blur the input to trigger any validation
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(200);
      
      // Close calendar if it's open
      try {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(100);
      } catch (error) {
        // Calendar might not be open, continue
      }
      
      // Verify the date was set correctly
      const actualValue = await dateRangeInput.inputValue();
      if (actualValue !== dateRangeValue) {
        console.warn(`⚠️ Warning: Date range mismatch. Expected "${dateRangeValue}" but got "${actualValue}"`);
      } else {
        console.log(`✅ Date range set correctly: "${actualValue}"`);
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

  async clickComprarAndScrapeForm(planIndex: number = 0): Promise<PurchaseFormResult> {
    if (!this.page) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    try {
      console.log(`🛒 Buscando botón COMPRAR para el plan ${planIndex + 1}...`);

      // Wait for quote cards to be visible
      await this.page.waitForSelector('.item-block', { state: 'visible', timeout: 10000 });

      // Find all COMPRAR buttons
      const comprarButtons = await this.page.locator('button, a, input[type="submit"]')
        .filter({ hasText: /COMPRAR/i })
        .all();

      console.log(`📋 Encontrados ${comprarButtons.length} botones COMPRAR`);

      if (comprarButtons.length === 0) {
        throw new Error('No se encontraron botones COMPRAR');
      }

      if (planIndex >= comprarButtons.length) {
        throw new Error(`El índice ${planIndex} está fuera de rango. Solo hay ${comprarButtons.length} botones.`);
      }

      const targetButton = comprarButtons[planIndex];
      const buttonText = await targetButton.textContent();
      console.log(`✅ Botón encontrado: ${buttonText?.trim()}`);

      // Capture before state
      const beforeURL = this.page.url();
      console.log(`📍 URL actual: ${beforeURL}`);

      // Take screenshot before clicking
      const screenshotDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const screenshotBeforePath = path.join(screenshotDir, `purchase-before-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotBeforePath, fullPage: true });

      // Click the button
      console.log(`🖱️ Haciendo clic en COMPRAR...`);
      
      // Wait for navigation or form to appear
      const [response] = await Promise.all([
        this.page.waitForResponse(
          (response) => response.status() === 200 || response.status() === 302,
          { timeout: 30000 }
        ).catch(() => null),
        targetButton.click(),
      ]);

      // Wait for page to load or form to appear
      console.log(`⏳ Esperando a que se cargue el formulario de compra...`);
      
      try {
        // Wait for either URL change or form to appear
        await Promise.race([
          this.page.waitForURL((url) => url.toString() !== beforeURL, { timeout: 10000 }),
          this.page.waitForSelector('form', { timeout: 10000 }),
        ]);
      } catch (error) {
        console.warn('⚠️ Timeout esperando el formulario, continuando...');
      }

      // Additional wait for content to load
      await this.page.waitForTimeout(2000);

      // Capture after state
      const afterURL = this.page.url();
      const html = await this.page.content();
      console.log(`📍 Nueva URL: ${afterURL}`);
      console.log(`📄 HTML capturado: ${html.length} bytes`);

      // Take screenshot after clicking
      const screenshotAfterPath = path.join(screenshotDir, `purchase-after-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotAfterPath, fullPage: true });
      console.log(`📸 Screenshot guardado: ${screenshotAfterPath}`);

      // Extract forms
      const forms = await this.page.locator('form').all();
      console.log(`📋 Formularios encontrados: ${forms.length}`);

      const purchaseForms = [];
      const fieldsWithAnalysis: Array<Array<any>> = []; // Store analysis data separately
      
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const formId = await form.getAttribute('id');
        const formAction = await form.getAttribute('action');
        const formMethod = await form.getAttribute('method') || 'GET';

        console.log(`\n📝 Formulario ${i + 1}:`);
        console.log(`   ID: ${formId || 'sin ID'}`);
        console.log(`   Action: ${formAction || 'sin action'}`);
        console.log(`   Method: ${formMethod}`);

        // Extract all input fields
        const inputs = await form.locator('input, select, textarea').all();
        const fields = [];
        fieldsWithAnalysis[i] = []; // Initialize analysis array for this form

        for (const input of inputs) {
          const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          const placeholder = await input.getAttribute('placeholder');
          const required = await input.evaluate((el) => (el as HTMLInputElement).required);
          const value = await input.getAttribute('value') || await input.inputValue().catch(() => null);
          // Extract data-premium for rider checkboxes
          const dataPremium = await input.getAttribute('data-premium');

          // Filter out internal/hidden fields that shouldn't get labels
          // BUT: Allow rider checkboxes (optional benefits) - they have data-premium and are checkboxes
          const isRiderCheckbox = type === 'checkbox' && name?.includes('[riders]') && dataPremium !== null;
          
          // Skip if it's a hidden field or has internal field name patterns
          // Exception: rider checkboxes should be processed to get their labels
          if (
            type === 'hidden' ||
            (name && !isRiderCheckbox && (
              name.includes('[id]') ||
              name.includes('[uuid]') ||
              name.includes('[factor_wlc]') ||
              name.includes('[factor_main]') ||
              name.includes('[calculate_premium]') ||
              name.includes('[free_passenger]') ||
              name.includes('[plan][id]') ||
              name.includes('[data_taxes]') ||
              (name.includes('[riders][') && type !== 'checkbox') || // Filter out rider text inputs, but allow checkboxes
              name === 'website_quotation[id]' ||
              name === 'website_quotation[search_id]' ||
              name === 'website_quotation[date_from]' ||
              name === 'website_quotation[date_to]' ||
              name === 'website_quotation[days]' ||
              name === 'website_quotation[months]' ||
              name === 'website_quotation[passengers]' ||
              name === 'website_quotation[general_agent]' ||
              name === 'website_quotation[product]' ||
              name === 'website_quotation[origin]' ||
              name === 'website_quotation[destination]'
            ))
          ) {
            // Still include these fields in the form data, but skip label extraction
            const fieldData = {
              tag: tagName,
              type: type || null,
              name: name || null,
              id: id || null,
              placeholder: placeholder || null,
              label: null, // Explicitly set to null for internal fields
              required: required,
              value: value,
              options: null,
              dataPremium: dataPremium || null,
            };
            
            fields.push(fieldData);
            fieldsWithAnalysis[i].push({
              ...fieldData,
              _analysis: {
                htmlContext: null,
                labelSource: 'skipped-internal-field',
              },
            });
            continue; // Skip label extraction for internal fields
          }

          // Capture raw HTML context for analysis (parent element and siblings)
          let htmlContext: string | null = null;
          try {
            htmlContext = await input.evaluate((el) => {
              const parent = el.parentElement;
              if (parent) {
                // Get parent's outerHTML but limit to reasonable size
                const html = parent.outerHTML;
                return html.length > 2000 ? html.substring(0, 2000) + '...' : html;
              }
              return null;
            });
          } catch (error) {
            // Ignore errors capturing HTML context
          }

          // Try to find label with multiple strategies
          let label: string | null = null;
          let labelSource: string | null = null; // Track which strategy found the label
          try {
            const labelText = await input.evaluate((el) => {
              const id = el.id;
              
              // Strategy 1: Look for label[for="id"] - this is the most reliable pattern
              // The `for` attribute is the definitive link between label and input
              if (id) {
                const labelEl = document.querySelector(`label[for="${id}"]`);
                if (labelEl) {
                  const text = labelEl.textContent?.trim();
                  // Only return if text exists and doesn't look like programmatic content
                  if (text && !text.includes('[') && !text.includes(']') && text.length < 100) {
                    return { text, source: 'label-for-attribute' };
                  }
                }
              }
              
              // Strategy 2: Check if parent is a label
              if (el.parentElement?.tagName === 'LABEL') {
                const text = el.parentElement.textContent?.trim();
                if (text) return { text, source: 'parent-is-label' };
              }
              
              // Strategy 3: Check previous sibling
              let sibling = el.previousElementSibling;
              while (sibling) {
                if (sibling.tagName === 'LABEL') {
                  const text = sibling.textContent?.trim();
                  if (text) return { text, source: 'previous-sibling-label' };
                }
                sibling = sibling.previousElementSibling;
              }
              
              // Strategy 4: Look for label in immediate parent container (form-group, etc.)
              // Only check within the current passenger's fieldset to avoid picking up labels from other passengers
              // Stop at fieldset boundaries since each breakdown represents a passenger
              let parent = el.parentElement;
              let levelsChecked = 0;
              const maxLevels = 3; // Allow a bit more depth but stop at fieldset
              
              while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY' && levelsChecked < maxLevels) {
                // Stop searching if we hit a fieldset boundary (each passenger is in their own fieldset)
                if (parent.tagName === 'FIELDSET' && parent !== el.closest('fieldset')) {
                  break;
                }
                
                const labelInParent = parent.querySelector('label');
                if (labelInParent && labelInParent !== el) {
                  const labelFor = labelInParent.getAttribute('for');
                  const text = labelInParent.textContent?.trim();
                  
                  // Only accept this label if:
                  // 1. It has text and doesn't contain brackets (programmatic patterns)
                  // 2. Either it has no 'for' attribute (meaning it might be a container label)
                  //    OR its 'for' attribute matches this element's id (meaning it's actually for this field)
                  if (text && !text.includes('[') && !text.includes(']')) {
                    if (!labelFor || labelFor === id) {
                      return { text, source: 'label-in-parent-container' };
                    }
                    // If label has a 'for' that doesn't match this field, it's for another field - skip it
                  }
                }
                parent = parent.parentElement;
                levelsChecked++;
              }
              
              return null;
            });
            
            let rawLabel: string | null = null;
            if (labelText && typeof labelText === 'object') {
              rawLabel = labelText.text;
              labelSource = labelText.source;
            } else if (labelText) {
              rawLabel = labelText;
              labelSource = 'unknown';
            }
            
            // Clean up label text - remove field names, brackets, etc.
            if (rawLabel) {
              let cleanedLabel = rawLabel.replace(/\[.*?\]/g, '').trim();
              cleanedLabel = cleanedLabel.replace(/website.*?quotation/gi, '').trim();
              // If label is too long or contains too many special chars, it's probably not a real label
              if (cleanedLabel.length > 50 || (cleanedLabel.match(/[\[\]{}]/g) || []).length > 2) {
                label = null;
              } else {
                label = cleanedLabel;
              }
            }
            
          } catch (error) {
            // Label not found, continue
          }
          
          // Fallback: Map common field name patterns to Spanish labels
          if (!label && name) {
            labelSource = 'field-name-mapping';
            const fieldNameMapping: { [key: string]: string } = {
              'nombre': 'Nombre',
              'apellido': 'Apellido',
              'genero': 'Género',
              'pais': 'País',
              'email': 'Email',
              'telefono': 'Teléfono',
              'codigo': 'Código País',
              'fecha': 'Fecha de Nacimiento',
              'nacimiento': 'Fecha de Nacimiento',
              'edad': 'Edad',
              'identificacion': 'Tipo de Identificación',
              'numero': 'Número',
              'condiciones': 'Condiciones Médicas',
              'medicas': 'Condiciones Médicas',
              'prima': 'Prima Total a Pagar',
              'agente': 'Agente/Agencia',
              'contacto': 'Contacto de Emergencia',
              'emergencia': 'Contacto de Emergencia',
            };
            
            const nameLower = name.toLowerCase();
            for (const [key, value] of Object.entries(fieldNameMapping)) {
              if (nameLower.includes(key)) {
                label = value;
                break;
              }
            }
          }

          // Get options for select elements
          let options: Array<{ value: string; text: string }> | null = null;
          if (tagName === 'select') {
            const optionElements = await input.locator('option').all();
            options = [];
            for (const option of optionElements) {
              const optionValue = await option.getAttribute('value');
              const optionText = await option.textContent();
              if (optionValue !== null && optionText) {
                options.push({
                  value: optionValue,
                  text: optionText.trim(),
                });
              }
            }
          }

          // Store field data
          const fieldData = {
            tag: tagName,
            type: type || null,
            name: name || null,
            id: id || null,
            placeholder: placeholder || null,
            label: label,
            required: required,
            value: value,
            options: options,
            dataPremium: dataPremium || null,
          };
          
          // Store analysis data separately (will be included in raw data export only)
          const fieldWithAnalysis = {
            ...fieldData,
            _analysis: {
              htmlContext: htmlContext,
              labelSource: labelSource,
            },
          };
          
          // Store field data for return
          fields.push(fieldData);
          
          // Store analysis version separately for raw data export
          fieldsWithAnalysis[i].push(fieldWithAnalysis);
        }

        console.log(`   Campos: ${fields.length}`);

        purchaseForms.push({
          index: i,
          id: formId,
          action: formAction,
          method: formMethod,
          fields: fields,
        });
      }

      const purchaseFormData: PurchaseFormData = {
        url: afterURL,
        html: html,
        forms: purchaseForms,
      };

      // Always save raw data for analysis
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const rawDataPath = path.join(dataDir, `purchase-form-raw-${timestamp}.json`);
      const htmlPath = path.join(dataDir, `purchase-form-html-${timestamp}.html`);
      
      // Save detailed raw data with all field information including analysis data
      const rawData = {
        timestamp: new Date().toISOString(),
        url: afterURL,
        forms: purchaseForms.map((form, formIndex) => ({
          ...form,
          fields: (fieldsWithAnalysis[formIndex] || form.fields).map((field: any) => ({
            tag: field.tag,
            type: field.type,
            name: field.name,
            id: field.id,
            placeholder: field.placeholder,
            label: field.label,
            required: field.required,
            value: field.value,
            options: field.options,
            // Include analysis data
            _analysis: field._analysis || null,
          })),
        })),
      };
      
      fs.writeFileSync(rawDataPath, JSON.stringify(rawData, null, 2), 'utf-8');
      fs.writeFileSync(htmlPath, html, 'utf-8');
      
      console.log(`💾 Raw form data saved for analysis:`);
      console.log(`   JSON: ${rawDataPath}`);
      console.log(`   HTML: ${htmlPath}`);

      return {
        success: true,
        purchaseFormData,
        screenshotPath: screenshotAfterPath,
      };
    } catch (error) {
      console.error('❌ Error al hacer clic en COMPRAR y capturar formulario:', error);

      // Take error screenshot
      const screenshotDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const errorScreenshotPath = path.join(screenshotDir, `purchase-error-${Date.now()}.png`);
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

