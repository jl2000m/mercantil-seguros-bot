import { MercantilSegurosBot } from '../src/index';
import { QuoteConfig } from '../src/types';

/**
 * Test script to generate a quote and scrape the purchase form
 * This will automatically save raw data for analysis
 */
async function testPurchaseForm() {
  const bot = new MercantilSegurosBot();
  
  try {
    console.log('🧪 Starting purchase form test...\n');
    
    // Test configuration
    const testConfig: QuoteConfig = {
      tripType: 'Viajes Por Día',
      origin: 'Panamá',
      destination: 'Europa',
      departureDate: '14/01/2026',
      returnDate: '30/01/2026',
      passengers: 1,
      ages: [25],
      agent: '2851',
    };
    
    console.log('📋 Test Configuration:');
    console.log(JSON.stringify(testConfig, null, 2));
    console.log('');
    
    // Initialize bot
    await bot.initialize();
    
    // Generate quote
    console.log('📊 Generating quote...');
    const quoteResult = await bot.generateQuote(testConfig);
    
    if (!quoteResult.success || !quoteResult.quoteData?.url) {
      throw new Error(`Quote generation failed: ${quoteResult.error || 'Unknown error'}`);
    }
    
    console.log(`✅ Quote generated successfully!`);
    console.log(`   URL: ${quoteResult.quoteData.url}`);
    console.log(`   Plans found: ${quoteResult.quoteData.planCount || 0}\n`);
    
    // Click COMPRAR on the first plan (index 0) and scrape the purchase form
    console.log('🛒 Clicking COMPRAR on first plan and scraping purchase form...');
    const purchaseFormResult = await bot.clickComprarAndScrapeForm(0);
    
    if (!purchaseFormResult.success || !purchaseFormResult.purchaseFormData) {
      throw new Error(`Purchase form scraping failed: ${purchaseFormResult.error || 'Unknown error'}`);
    }
    
    console.log(`✅ Purchase form scraped successfully!`);
    console.log(`   Forms found: ${purchaseFormResult.purchaseFormData.forms.length}`);
    
    let totalFields = 0;
    let fieldsWithLabels = 0;
    
    for (const form of purchaseFormResult.purchaseFormData.forms) {
      totalFields += form.fields.length;
      fieldsWithLabels += form.fields.filter(f => f.label && f.label.trim()).length;
      console.log(`   Form ${form.index + 1}: ${form.fields.length} fields (${form.fields.filter(f => f.label && f.label.trim()).length} with labels)`);
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total fields: ${totalFields}`);
    console.log(`   Fields with labels: ${fieldsWithLabels} (${((fieldsWithLabels / totalFields) * 100).toFixed(1)}%)`);
    console.log(`   Fields without labels: ${totalFields - fieldsWithLabels} (${(((totalFields - fieldsWithLabels) / totalFields) * 100).toFixed(1)}%)`);
    
    console.log(`\n💾 Raw data has been saved to the data/ directory for analysis.`);
    console.log(`   Run: npx tsx scripts/analyze-purchase-form.ts`);
    
    // Close browser
    await bot.close();
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await bot.close().catch(() => {});
    process.exit(1);
  }
}

// Run the test
testPurchaseForm().catch(console.error);
