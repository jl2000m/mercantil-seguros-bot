import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir);
    const catalogFiles = files.filter(f => f.startsWith('catalog-') && f.endsWith('.json'));
    
    if (catalogFiles.length === 0) {
      return NextResponse.json(
        { error: 'No catalog file found' },
        { status: 404 }
      );
    }

    // Get the most recent catalog file
    const catalogFile = catalogFiles.sort().reverse()[0];
    const catalogPath = path.join(dataDir, catalogFile);
    const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

    return NextResponse.json(catalogData);
  } catch (error) {
    console.error('Error loading catalog:', error);
    return NextResponse.json(
      { error: 'Failed to load catalog' },
      { status: 500 }
    );
  }
}

