import { chromium, Browser, Page } from 'playwright';
import { QuoteConfig } from './types';
import { QUOTE_URL } from './config';

/**
 * Intercept network requests to discover the API endpoint
 */
export async function interceptNetworkRequests(config: QuoteConfig) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const requests: Array<{ url: string; method: string; postData?: string; headers?: Record<string, string> }> = [];

  // Intercept all requests
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const postData = request.postData();
    const headers = request.headers();

    // Only log requests that might be API calls
    if (url.includes('mercantilseguros.com') && (method === 'POST' || url.includes('quotation'))) {
      requests.push({
        url,
        method,
        postData: postData || undefined,
        headers: Object.fromEntries(Object.entries(headers)),
      });
      console.log(`📡 Request: ${method} ${url}`);
      if (postData) {
        console.log(`   Body: ${postData.substring(0, 200)}...`);
      }
    }
  });

  // Intercept all responses
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('mercantilseguros.com') && (url.includes('quotation') || status === 200)) {
      console.log(`📥 Response: ${status} ${url}`);
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('json')) {
        try {
          const json = await response.json();
          console.log(`   JSON: ${JSON.stringify(json).substring(0, 200)}...`);
        } catch (e) {
          // Not JSON
        }
      }
    }
  });

  try {
    // Navigate and fill form (simplified version)
    await page.goto(QUOTE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#websitebundle_quotation_search_product', { timeout: 15000 });

    // Fill form
    await page.selectOption('#websitebundle_quotation_search_product', config.tripType);
    await page.waitForTimeout(500);

    // Get origin value
    const originOptions = await page.locator('#websitebundle_quotation_search_origin option').all();
    let originValue = '';
    for (const option of originOptions) {
      const text = await option.textContent();
      if (text && text.includes(config.origin)) {
        originValue = (await option.getAttribute('value')) || '';
        break;
      }
    }

    // Get destination value
    const destinationOptions = await page.locator('#websitebundle_quotation_search_destination option').all();
    let destinationValue = '';
    for (const option of destinationOptions) {
      const text = await option.textContent();
      if (text && text.includes(config.destination)) {
        destinationValue = (await option.getAttribute('value')) || '';
        break;
      }
    }

    // Fill dates
    const [day, month, year] = config.departureDate.split('/');
    const departureDate = `${year}-${month}-${day}`;
    const [day2, month2, year2] = config.returnDate.split('/');
    const returnDate = `${year2}-${month2}-${day2}`;

    await page.fill('#sliderDateRange', `${config.departureDate} - ${config.returnDate}`);
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');

    // Set passengers
    await page.selectOption('#selector-passenger-count', config.passengers.toString());
    await page.waitForTimeout(1000);

    // Set ages
    for (let i = 0; i < config.ages.length; i++) {
      await page.fill(`#passengers-age\\[${i}\\]`, config.ages[i].toString());
      await page.waitForTimeout(200);
    }

    // Submit form
    console.log('🚀 Submitting form to intercept requests...');
    await page.getByRole('button', { name: 'COTIZAR SEGURO' }).click();

    // Wait for navigation/response
    await page.waitForTimeout(10000);

    console.log('\n📊 All intercepted requests:');
    requests.forEach((req, index) => {
      console.log(`\n${index + 1}. ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`   POST Data: ${req.postData}`);
      }
      if (req.headers) {
        console.log(`   Headers: ${JSON.stringify(req.headers, null, 2)}`);
      }
    });

    await browser.close();
    return requests;
  } catch (error) {
    console.error('Error intercepting requests:', error);
    await browser.close();
    throw error;
  }
}

