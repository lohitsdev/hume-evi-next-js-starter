import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const pageNumber = searchParams.get('page_number') || '0';
    const pageSize = searchParams.get('page_size') || '10';
    const ascendingOrder = searchParams.get('ascending_order') || 'false';
    
    const apiKey = process.env.HUME_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Hume API key not configured' }, { status: 500 });
    }

    const chatId = params.chatId;
    // Correct endpoint according to Hume docs: /chats/{chatId} for getting chat events
    const url = `https://api.hume.ai/v0/evi/chats/${chatId}?page_number=${pageNumber}&page_size=${pageSize}&ascending_order=${ascendingOrder}`;

    console.log('Fetching chat events from URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Hume-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hume API error: ${response.status} - ${errorText}`);
      throw new Error(`Hume API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Hume API chat events response for ${chatId}:`, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching chat events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 