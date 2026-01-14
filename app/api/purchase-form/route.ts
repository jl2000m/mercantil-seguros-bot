import { NextRequest, NextResponse } from 'next/server';
import { MercantilSegurosBot } from '../../../src/index';
import { PurchaseFormData, PurchaseFormResult } from '../../../src/types';

export const maxDuration = 90; // 90 seconds timeout for purchase form

/**
 * Map plan ID from quote page (D-30) to purchase form (M-30)
 */
function mapPlanIdToPurchaseForm(planId: string): string {
  // D-30 -> M-30, D-50 -> M-50, etc.
  return planId.replace(/^D-/, 'M-');
}

/**
 * Extract UUID from quote URL
 * Example: https://.../quotation/b91a2eb0822af593be054528d21ca219
 */
function extractQuoteUuid(quoteUrl: string): string | null {
  const match = quoteUrl.match(/quotation\/([a-f0-9]+)/);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, quoteUrl } = body;
    
    if (!planId || !quoteUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'planId and quoteUrl are required',
        },
        { status: 400 }
      );
    }

    const quoteUuid = extractQuoteUuid(quoteUrl);
    if (!quoteUuid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract quote UUID from URL',
        },
        { status: 400 }
      );
    }

    // Map plan ID (D-30 -> M-30)
    const purchasePlanId = mapPlanIdToPurchaseForm(planId);
    const purchaseFormUrl = `https://www1.mercantilseguros.com/as/viajesint/MRP022052/quotation/${quoteUuid}/${purchasePlanId}/buy/step-one`;

    console.log(`📋 Scraping purchase form for plan ${planId} (${purchasePlanId})`);
    console.log(`   URL: ${purchaseFormUrl}`);

    const bot = new MercantilSegurosBot();
    
    try {
      await bot.initialize();
      
      if (!bot['page']) {
        throw new Error('Page not initialized');
      }
      
      const page = bot['page'];
      
      // Navigate directly to the purchase form
      await page.goto(purchaseFormUrl, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(3000); // Wait for page to fully load
      
      // Extract forms
      const forms = await page.locator('form').all();
      const purchaseForms = [];
      
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const formId = await form.getAttribute('id');
        const formAction = await form.getAttribute('action');
        const formMethod = await form.getAttribute('method') || 'GET';
        
        // Extract all input fields
        const inputs = await form.locator('input, select, textarea').all();
        const fields = [];
        
        for (const input of inputs) {
          const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          const placeholder = await input.getAttribute('placeholder');
          const required = await input.evaluate((el) => (el as HTMLInputElement).required);
          const value = await input.getAttribute('value') || await input.inputValue().catch(() => null);
          
          // Try to find label
          let label: string | null = null;
          try {
            const labelElement = await input.evaluateHandle((el) => {
              const id = el.id;
              if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                if (label) return label;
              }
              if (el.parentElement?.tagName === 'LABEL') {
                return el.parentElement;
              }
              if (el.previousElementSibling?.tagName === 'LABEL') {
                return el.previousElementSibling;
              }
              return null;
            });
            
            if (labelElement) {
              const labelText = await labelElement.evaluate((el) => el ? (el.textContent?.trim() || null) : null);
              label = labelText;
            }
          } catch (error) {
            // Label not found, continue
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
          
          fields.push({
            tag: tagName,
            type: type || null,
            name: name || null,
            id: id || null,
            placeholder: placeholder || null,
            label: label,
            required: required,
            value: value,
            options: options,
          });
        }
        
        purchaseForms.push({
          index: i,
          id: formId,
          action: formAction,
          method: formMethod,
          fields: fields,
        });
      }
      
      const html = await page.content();
      const purchaseFormData: PurchaseFormData = {
        url: purchaseFormUrl,
        html: html,
        forms: purchaseForms,
      };
      
      await bot.close();

      return NextResponse.json({
        success: true,
        purchaseFormData,
      } as PurchaseFormResult);
    } catch (error) {
      await bot.close().catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('Error obteniendo formulario de compra:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

