import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
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

    const groupId = params.groupId;
    const url = `https://api.hume.ai/v0/evi/chat_groups/${groupId}/events?page_number=${pageNumber}&page_size=${pageSize}&ascending_order=${ascendingOrder}`;

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
    console.log(`Hume API chat group events response for ${groupId}:`, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching chat group events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat group events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 