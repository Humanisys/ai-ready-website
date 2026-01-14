import { NextRequest, NextResponse } from 'next/server';

/**
 * Wrapper API that combines both /api/ai-readiness and /api/ai-analysis
 * into a single unified endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Ensure URL has protocol
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // Validate URL format
    try {
      new URL(normalizedUrl);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    console.log('[ANALYZE] Starting combined analysis for:', normalizedUrl);
    const startTime = Date.now();
    
    // Step 1: Call ai-readiness endpoint
    console.log('[ANALYZE] Step 1/2: Calling ai-readiness endpoint...');
    const readinessStartTime = Date.now();
    
    let readinessData;
    try {
      const readinessResponse = await fetch(`${request.nextUrl.origin}/api/ai-readiness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      
      if (!readinessResponse.ok) {
        const errorData = await readinessResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[ANALYZE] ai-readiness failed:', errorData);
        return NextResponse.json(
          { error: 'AI readiness analysis failed', details: errorData },
          { status: readinessResponse.status }
        );
      }
      
      readinessData = await readinessResponse.json();
    } catch (fetchError) {
      console.error('[ANALYZE] Failed to call ai-readiness endpoint:', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to call AI readiness endpoint',
          details: fetchError instanceof Error ? fetchError.message : 'Network error'
        },
        { status: 500 }
      );
    }
    console.log(`[ANALYZE] Step 1/2: ai-readiness completed in ${Date.now() - readinessStartTime}ms`);
    
    // Step 2: Call ai-analysis endpoint with the results from ai-readiness
    console.log('[ANALYZE] Step 2/2: Calling ai-analysis endpoint...');
    const analysisStartTime = Date.now();
    
    let analysisData = { success: false, insights: [], overallAIReadiness: '', topPriorities: [] };
    
    try {
      const analysisResponse = await fetch(`${request.nextUrl.origin}/api/ai-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: normalizedUrl,
          htmlContent: readinessData.htmlContent || '',
          currentChecks: readinessData.checks || [],
        }),
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[ANALYZE] ai-analysis failed:', errorData);
        // Continue with readiness data even if analysis fails
        console.log('[ANALYZE] Continuing with readiness data only...');
      } else {
        analysisData = await analysisResponse.json();
      }
    } catch (fetchError) {
      console.error('[ANALYZE] Failed to call ai-analysis endpoint:', fetchError);
      // Continue with readiness data even if analysis fails
      console.log('[ANALYZE] Continuing with readiness data only...');
    }
    
    console.log(`[ANALYZE] Step 2/2: ai-analysis completed in ${Date.now() - analysisStartTime}ms`);
    console.log(`[ANALYZE] Total analysis time: ${Date.now() - startTime}ms`);
    
    // Combine both responses into a unified format
    const combinedResponse = {
      success: true,
      url: normalizedUrl,
      
      // From ai-readiness
      overallScore: readinessData.overallScore,
      checks: readinessData.checks || [],
      metadata: readinessData.metadata || {},
      
      // From ai-analysis
      insights: analysisData.insights || [],
      overallAIReadiness: analysisData.overallAIReadiness || '',
      topPriorities: analysisData.topPriorities || [],
      
      // Combined metadata
      analyzedAt: new Date().toISOString(),
      analysisDuration: Date.now() - startTime,
    };
    
    return NextResponse.json(combinedResponse);
    
  } catch (error) {
    console.error('[ANALYZE] Combined analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform combined analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

