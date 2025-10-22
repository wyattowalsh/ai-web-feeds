import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date_range = searchParams.get('date_range') || '30d';
  const format = searchParams.get('format') || 'csv';

  try {
    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV format is supported' },
        { status: 400 }
      );
    }

    // In production, this would call the Python backend export function
    // For now, we'll generate mock CSV data
    
    const csv = `Analytics Summary
Metric,Value
Date Range,${date_range}
Total Feeds,1250
Active Feeds,1180
Validation Success Rate,94.0%
Avg Response Time (ms),285.50

Health Distribution
Category,Count
Healthy,940
Moderate,240
Unhealthy,70

Most Active Topics
Topic,Feed Count,Validation Frequency,Avg Health Score
llm,245,89.50,0.92
agents,180,76.20,0.88
training,165,68.70,0.90
inference,142,62.30,0.85
genai,130,58.90,0.89
ml,298,55.40,0.86
cv,118,52.10,0.84
nlp,156,49.80,0.87
rl,89,42.50,0.82
data,267,38.90,0.83

Publication Velocity
Date,Validation Count
2025-10-15,985
2025-10-16,1024
2025-10-17,1142
2025-10-18,968
2025-10-19,1089
2025-10-20,1156
2025-10-21,1201
2025-10-22,1078
`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="analytics_export_${date_range}.csv"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}

