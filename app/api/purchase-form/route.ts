import { NextRequest, NextResponse } from 'next/server';
import { MercantilSegurosBot } from '../../../src/index';
import { QuoteConfig } from '../../../src/types';

export const maxDuration = 90; // 90 seconds timeout for purchase form

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const planIndex = body.planIndex ?? 0;
    
    // Optional: if quoteConfig is provided, generate quote first
    // Otherwise, assume we're already on the quote results page
    const quoteConfig: QuoteConfig | null = body.quoteConfig || null;

    const bot = new MercantilSegurosBot();
    
    try {
      await bot.initialize();
      
      // If quote config is provided, generate quote first
      if (quoteConfig) {
        console.log('📋 Generando cotización primero...');
        const quoteResult = await bot.generateQuote(quoteConfig);
        
        if (!quoteResult.success || !quoteResult.quoteData) {
          throw new Error(quoteResult.error || 'Error al generar cotización');
        }
        
        console.log('✅ Cotización generada, procediendo a hacer clic en COMPRAR...');
      }
      
      // Click COMPRAR and scrape the purchase form
      const result = await bot.clickComprarAndScrapeForm(planIndex);
      await bot.close();

      return NextResponse.json(result);
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

