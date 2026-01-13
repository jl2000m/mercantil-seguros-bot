import { NextRequest, NextResponse } from 'next/server';
import { MercantilSegurosBot } from '../../../src/index';
import { QuoteConfig } from '../../../src/types';

export const maxDuration = 60; // 60 seconds timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: QuoteConfig = {
      tripType: body.tripType,
      origin: body.origin,
      destination: body.destination,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      passengers: parseInt(body.passengers),
      ages: body.ages.map((age: string) => parseInt(age)),
      agent: body.agent || '2851',
    };

    const bot = new MercantilSegurosBot();
    
    try {
      await bot.initialize();
      const result = await bot.generateQuote(config);
      await bot.close();

      return NextResponse.json(result);
    } catch (error) {
      await bot.close().catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('Error generando cotización:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

