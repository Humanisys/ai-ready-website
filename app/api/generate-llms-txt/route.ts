import { NextRequest, NextResponse } from 'next/server';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

/**
 * Fetch robots.txt and extract sitemap URLs
 */
async function getSitemapUrlFromRobots(baseUrl: string): Promise<string | null> {
  try {
    const robotsUrl = `${baseUrl}/robots.txt`;
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      const robotsText = await response.text();
      // Extract sitemap URLs
      const sitemapMatches = robotsText.match(/Sitemap:\s*(.+)/gi);
      if (sitemapMatches && sitemapMatches.length > 0) {
        // Get the first sitemap URL
        const sitemapUrl = sitemapMatches[0].replace(/Sitemap:\s*/i, '').trim();
        return sitemapUrl;
      }
    }
  } catch (error) {
    console.log('Could not fetch robots.txt:', error);
  }
  return null;
}

/**
 * Parse XML sitemap and extract URLs
 */
async function parseSitemapXml(xmlContent: string, baseUrl: string): Promise<{ urls: string[], sitemapUrls: string[] }> {
  const urls: string[] = [];
  const sitemapUrls: string[] = [];
  
  // Check if it's a sitemap index
  const isSitemapIndex = xmlContent.includes('<sitemapindex') || xmlContent.includes('<sitemap>');
  
  if (isSitemapIndex) {
    // Extract sitemap URLs from index
    const sitemapMatches = xmlContent.match(/<loc>(.*?)<\/loc>/gi);
    if (sitemapMatches) {
      sitemapMatches.forEach(match => {
        const url = match.replace(/<\/?loc>/gi, '').trim();
        if (url.endsWith('.xml')) {
          sitemapUrls.push(url);
        }
      });
    }
  } else {
    // Regular sitemap - extract URLs
    const urlMatches = xmlContent.match(/<loc>(.*?)<\/loc>/gi);
    if (urlMatches) {
      urlMatches.forEach(match => {
        const url = match.replace(/<\/?loc>/gi, '').trim();
        // Only collect non-XML URLs
        if (!url.endsWith('.xml')) {
          urls.push(url);
        } else {
          // If it's an XML URL, add to sitemapUrls for recursive processing
          sitemapUrls.push(url);
        }
      });
    }
  }
  
  return { urls, sitemapUrls };
}

/**
 * Recursively scrape sitemap.xml and collect all non-XML links
 */
async function collectSitemapUrls(
  sitemapUrl: string,
  baseUrl: string,
  visited: Set<string> = new Set()
): Promise<string[]> {
  // Prevent infinite loops
  if (visited.has(sitemapUrl)) {
    return [];
  }
  visited.add(sitemapUrl);
  
  const allUrls: string[] = [];
  
  try {
    const response = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch sitemap: ${sitemapUrl}`);
      return [];
    }
    
    const xmlContent = await response.text();
    
    // Verify it's actually XML
    if (!xmlContent.includes('<?xml') && !xmlContent.includes('<urlset') && !xmlContent.includes('<sitemapindex')) {
      console.log(`Not a valid XML sitemap: ${sitemapUrl}`);
      return [];
    }
    
    const { urls, sitemapUrls } = await parseSitemapXml(xmlContent, baseUrl);
    
    // Add non-XML URLs to collection
    allUrls.push(...urls);
    
    // Recursively process XML sitemap URLs
    for (const nestedSitemapUrl of sitemapUrls) {
      const nestedUrls = await collectSitemapUrls(nestedSitemapUrl, baseUrl, visited);
      allUrls.push(...nestedUrls);
    }
  } catch (error) {
    console.error(`Error processing sitemap ${sitemapUrl}:`, error);
  }
  
  return allUrls;
}

/**
 * Filter URLs to only level 1 paths (one path param after domain)
 * Example: wizcommerce.com/about-us ✓, wizcommerce.com/blogs/something ✗
 */
function filterLevel1Paths(urls: string[], domain: string): string[] {
  const domainUrl = new URL(domain);
  const baseDomain = domainUrl.hostname;
  
  return urls.filter(url => {
    try {
      const urlObj = new URL(url);
      // Must match the same domain
      if (urlObj.hostname !== baseDomain && urlObj.hostname !== `www.${baseDomain}` && `www.${urlObj.hostname}` !== baseDomain) {
        return false;
      }
      
      // Get pathname without leading slash
      const pathname = urlObj.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      
      // Split by slashes
      const pathParts = pathname.split('/').filter(part => part.length > 0);
      
      // Only allow exactly 1 path segment (level 1)
      return pathParts.length === 1;
    } catch (error) {
      return false;
    }
  });
}

/**
 * Generate llms.txt content using LLM
 */
async function generateLlmsTxtContent(level1Urls: string[], domain: string): Promise<string> {
  try {
    // Use OpenAI API for GPT-4o-mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at generating llms.txt files. Generate a well-structured llms.txt file following the exact format specified. Use markdown-style formatting with titles, descriptions, sections, and bullet points. Always provide detailed, informative descriptions that help AI systems understand the content and purpose of each page.'
          },
          {
            role: 'user',
            content: `Generate an llms.txt file for the domain ${domain} based on these level 1 pages:

${level1Urls.slice(0, 50).join('\n')}
${level1Urls.length > 50 ? `\n... and ${level1Urls.length - 50} more pages` : ''}

IMPORTANT: Follow this exact format:

# Title

> Optional description goes here

Optional details go here

## Section name

- [Link title](https://link_url): Optional link details

Requirements:
1. Start with a # Title (the main title for the website)
2. Add a detailed description using > quote format that explains what the website is about, its purpose, and main offerings
3. Add optional details as plain text that provide additional context about the website structure, content types, or key features
4. Create sections using ## Section name - use descriptive section names that categorize the pages logically
5. List links using - [Link title](url): Optional link details format
   - Link titles should be clear and descriptive (not just the URL path)
   - Link details should be detailed and informative, explaining what content or functionality each page provides
   - Include information about what users/AI systems can expect to find on each page
   - Describe the purpose, content type, or key information available on each page
6. Group related pages into logical sections based on their purpose or content type
7. Use descriptive link titles based on the URL path - infer the page purpose from the URL structure
8. Make descriptions detailed and helpful - explain what each page contains, its purpose, and why it's valuable
9. For each link, provide a comprehensive description that helps AI systems understand:
   - What type of content is on the page
   - What information or functionality it provides
   - How it relates to the overall website structure
   - What value it offers to users or AI systems

Generate only the llms.txt content in the exact format above, no markdown code blocks or explanations. Make sure all descriptions are detailed, informative, and helpful for AI systems to understand the website structure and content.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      let content = data.choices[0].message.content;
      // Remove markdown code blocks if present
      content = content.replace(/```txt\n?/g, '').replace(/```llms-txt\n?/g, '').replace(/```\n?/g, '').trim();
      return content;
    }
  } catch (error) {
    console.error('LLM generation error:', error);
  }
  
  // Fallback: Generate a basic llms.txt
  return generateFallbackLlmsTxt(level1Urls, domain);
}

/**
 * Generate a fallback llms.txt if LLM fails
 */
function generateFallbackLlmsTxt(level1Urls: string[], domain: string): string {
  // Group URLs by category/type
  const pages: Array<{ title: string; url: string; path: string }> = [];
  
  level1Urls.forEach(url => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      
      // Generate a readable title from the path
      const title = pathname
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Home';
      
      pages.push({ title, url, path: pathname });
    } catch {
      pages.push({ title: url, url, path: url });
    }
  });
  
  // Group into sections
  const homePage = pages.find(p => !p.path || p.path === '');
  const otherPages = pages.filter(p => p.path && p.path !== '');
  
  let content = `# ${domain.replace('www.', '')}\n\n`;
  
  if (homePage) {
    content += `> Main website for ${domain.replace('www.', '')}\n\n`;
  }
  
  content += `This llms.txt file provides information about the website structure for AI systems.\n\n`;
  
  if (homePage) {
    content += `## Home\n\n`;
    content += `- [Home](${homePage.url}): Main landing page\n\n`;
  }
  
  if (otherPages.length > 0) {
    content += `## Main Pages\n\n`;
    
    // Show first 30 pages
    otherPages.slice(0, 30).forEach(page => {
      content += `- [${page.title}](${page.url}): ${page.path} page\n`;
    });
    
    if (otherPages.length > 30) {
      content += `\n... and ${otherPages.length - 30} more pages\n`;
    }
  }
  
  content += `\n## AI Usage\n\n`;
  content += `This website allows AI systems to crawl and index its content for training purposes.\n`;
  
  return content;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Ensure URL has protocol
    let processedUrl = url;
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }
    
    // Validate URL format
    let urlObj: URL;
    try {
      urlObj = new URL(processedUrl);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    const baseUrl = urlObj.origin;
    const domain = urlObj.hostname;
    
    console.log('[LLMS-TXT] Step 1/4: Finding sitemap.xml...');
    
    // Step 1: Try to get sitemap URL from robots.txt
    let sitemapUrl = await getSitemapUrlFromRobots(baseUrl);
    let sitemapSource = '';
    let errorDetails: string[] = [];
    
    // Step 2: Check if sitemap exists
    let sitemapExists = false;
    let checkedSitemapUrl = '';
    
    if (sitemapUrl) {
      // robots.txt contains sitemap reference
      checkedSitemapUrl = sitemapUrl;
      sitemapSource = 'robots.txt';
      console.log('[LLMS-TXT] Found sitemap in robots.txt:', sitemapUrl);
      
      // Verify the sitemap actually exists
      try {
        const checkResponse = await fetch(sitemapUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (checkResponse.ok) {
          const content = await checkResponse.text();
          // Verify it's actually XML
          if (content.includes('<?xml') || content.includes('<urlset') || content.includes('<sitemapindex')) {
            sitemapExists = true;
          } else {
            errorDetails.push(`Sitemap referenced in robots.txt (${sitemapUrl}) is not a valid XML file.`);
          }
        } else {
          errorDetails.push(`Sitemap referenced in robots.txt (${sitemapUrl}) returned ${checkResponse.status} ${checkResponse.statusText}.`);
        }
      } catch (error) {
        errorDetails.push(`Sitemap referenced in robots.txt (${sitemapUrl}) could not be accessed.`);
      }
    } else {
      // robots.txt doesn't contain sitemap, check standard location
      sitemapUrl = `${baseUrl}/sitemap.xml`;
      checkedSitemapUrl = sitemapUrl;
      sitemapSource = 'standard location';
      console.log('[LLMS-TXT] Sitemap not in robots.txt, checking standard location:', sitemapUrl);
      errorDetails.push('robots.txt does not contain a sitemap reference.');
      
      // Check if standard location sitemap exists
      try {
        const checkResponse = await fetch(sitemapUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (checkResponse.ok) {
          const content = await checkResponse.text();
          // Verify it's actually XML
          if (content.includes('<?xml') || content.includes('<urlset') || content.includes('<sitemapindex')) {
            sitemapExists = true;
          } else {
            errorDetails.push(`Sitemap at standard location (${sitemapUrl}) is not a valid XML file.`);
          }
        } else {
          errorDetails.push(`Sitemap at standard location (${sitemapUrl}) returned ${checkResponse.status} ${checkResponse.statusText}.`);
        }
      } catch (error) {
        errorDetails.push(`Sitemap at standard location (${sitemapUrl}) could not be accessed.`);
      }
    }
    
    // If sitemap doesn't exist, return error with details
    if (!sitemapExists) {
      let errorMessage = '';
      if (sitemapSource === 'robots.txt') {
        errorMessage = 'Sitemap referenced in robots.txt is not accessible or invalid.';
      } else {
        errorMessage = 'No sitemap found at standard location.';
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        errorType: sitemapSource === 'robots.txt' ? 'sitemap_not_accessible' : 'sitemap_not_found',
        errorDetails,
        sitemapUrl: checkedSitemapUrl,
        sitemapSource
      }, { status: 404 });
    }
    
    console.log('[LLMS-TXT] Step 2/4: Collecting URLs from sitemap...');
    
    // Step 3: Recursively collect all non-XML URLs from sitemap
    const allUrls = await collectSitemapUrls(sitemapUrl, baseUrl);
    
    if (allUrls.length === 0) {
      return NextResponse.json({ 
        error: 'No URLs found in sitemap. The sitemap may be empty or contain only XML sitemap references.',
        errorType: 'empty_sitemap',
        errorDetails: [`Sitemap at ${sitemapUrl} was found but contains no valid URLs.`],
        sitemapUrl 
      }, { status: 404 });
    }
    
    console.log(`[LLMS-TXT] Collected ${allUrls.length} URLs from sitemap`);
    
    console.log('[LLMS-TXT] Step 3/4: Filtering to level 1 paths...');
    
    // Step 4: Filter to only level 1 paths
    const level1Urls = filterLevel1Paths(allUrls, baseUrl);
    
    if (level1Urls.length === 0) {
      return NextResponse.json({ 
        error: 'No level 1 paths found. The sitemap may only contain nested paths.',
        totalUrls: allUrls.length,
        sampleUrls: allUrls.slice(0, 5)
      }, { status: 404 });
    }
    
    console.log(`[LLMS-TXT] Filtered to ${level1Urls.length} level 1 paths`);
    
    console.log('[LLMS-TXT] Step 4/4: Generating llms.txt with LLM...');
    
    // Step 5: Generate llms.txt using LLM
    const llmsTxtContent = await generateLlmsTxtContent(level1Urls, domain);
    
    console.log('[LLMS-TXT] Generation complete');
    
    return NextResponse.json({
      success: true,
      content: llmsTxtContent,
      stats: {
        totalUrls: allUrls.length,
        level1Urls: level1Urls.length,
        sitemapUrl
      },
      level1Urls: level1Urls.slice(0, 100) // Return first 100 for reference
    });
    
  } catch (error) {
    console.error('LLMs.txt generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate llms.txt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
