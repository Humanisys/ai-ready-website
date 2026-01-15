"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, 
  FileText, 
  Code, 
  Shield, 
  Search, 
  Zap, 
  Database,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Bot,
  Sparkles,
  FileCode,
  Network,
  Info,
  Eye
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ScoreChart from "./ScoreChart";
import RadarChart from "./RadarChart";
import MetricBars from "./MetricBars";

interface ControlPanelProps {
  isAnalyzing: boolean;
  showResults: boolean;
  url: string;
  analysisData?: any;
  onReset: () => void;
}

interface CheckItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warning';
  score?: number;
  details?: string;
  recommendation?: string;
  actionItems?: string[];
  tooltip?: string;
}

export default function ControlPanel({
  isAnalyzing,
  showResults,
  url,
  analysisData,
  onReset,
}: ControlPanelProps) {
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiInsights, setAiInsights] = useState<CheckItem[]>([]);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [combinedChecks, setCombinedChecks] = useState<CheckItem[]>([]);
  const [isGeneratingLlmsTxt, setIsGeneratingLlmsTxt] = useState(false);
  const [llmsTxtContent, setLlmsTxtContent] = useState<string | null>(null);
  const [llmsTxtError, setLlmsTxtError] = useState<string | null>(null);
  const [showLlmsTxtModal, setShowLlmsTxtModal] = useState(false);
  const [checks, setChecks] = useState<CheckItem[]>([
    {
      id: 'heading-structure',
      label: 'Heading Hierarchy',
      description: 'H1-H6 structure',
      icon: FileText,
      status: 'pending',
    },
    {
      id: 'readability',
      label: 'Readability',
      description: 'Content clarity',
      icon: Globe,
      status: 'pending',
    },
    {
      id: 'meta-tags',
      label: 'Metadata Quality',
      description: 'Title, desc, author',
      icon: FileCode,
      status: 'pending',
    },
    {
      id: 'semantic-html',
      label: 'Semantic HTML',
      description: 'Proper HTML5 tags',
      icon: Code,
      status: 'pending',
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      description: 'Alt text & ARIA',
      icon: Eye,
      status: 'pending',
    },
    {
      id: 'llms-txt',
      label: 'LLMs.txt',
      description: 'AI permissions',
      icon: Bot,
      status: 'pending',
    },
    {
      id: 'robots-txt',
      label: 'Robots.txt',
      description: 'Crawler rules',
      icon: Shield,
      status: 'pending',
    },
    {
      id: 'sitemap',
      label: 'Sitemap',
      description: 'Site structure',
      icon: Network,
      status: 'pending',
    },
  ]);

  const [overallScore, setOverallScore] = useState(0);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(-1);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [hoveredCheck, setHoveredCheck] = useState<string | null>(null);
  const [enhancedScore, setEnhancedScore] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'chart' | 'bars'>('grid');
  const radarChartRef = useRef<HTMLDivElement | null>(null);

  const getAllMetricsForRadar = () => {
    return combinedChecks
      .filter(check => check.status !== 'pending' && check.status !== 'checking')
      .map(check => ({
        label: check.label,
        score: check.score || 0
      }));
  };

  const handleExportPdf = async () => {
    if (!analysisData) return;

    try {
      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import('jspdf') as any,
        import('html2canvas') as any,
      ]);
      const html2canvas = html2canvasModule.default || html2canvasModule;

      // Capture monochrome radar chart from an offscreen render (so export works from any view)
      let radarImageData: string | null = null;
      if (radarChartRef.current) {
        try {
          const canvas = await html2canvas(radarChartRef.current, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false,
            ignoreElements: (element) => {
              // Skip elements with problematic CSS
              const style = window.getComputedStyle(element);
              return false;
            },
            onclone: (clonedDoc) => {
              // Force all colors to simple hex values in the cloned document
              const allElements = clonedDoc.querySelectorAll('*');
              allElements.forEach((el: any) => {
                if (el.style) {
                  // Remove any CSS color() functions
                  const computed = window.getComputedStyle(el);
                  if (computed.color && computed.color.includes('color(')) {
                    el.style.color = '#000000';
                  }
                  if (computed.backgroundColor && computed.backgroundColor.includes('color(')) {
                    el.style.backgroundColor = '#ffffff';
                  }
                  if (computed.fill && computed.fill.includes('color(')) {
                    el.style.fill = '#000000';
                  }
                  if (computed.stroke && computed.stroke.includes('color(')) {
                    el.style.stroke = '#000000';
                  }
                }
              });
            }
          });
          radarImageData = canvas.toDataURL('image/png');
        } catch (canvasError) {
          console.warn('Failed to capture radar chart, continuing without it:', canvasError);
          // Continue without radar chart if capture fails
        }
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      let cursorY = margin;

      const ensureSpace = (needed: number) => {
        if (cursorY + needed > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
      };

      const writeWrapped = (text: string, fontSize: number, maxWidth: number, lineGap = 3) => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          ensureSpace(fontSize + lineGap);
          doc.text(line, margin, cursorY);
          cursorY += fontSize + lineGap;
        });
      };

      const measureWrapped = (text: string, fontSize: number, maxWidth: number, lineGap = 3) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        return lines.length * (fontSize + lineGap);
      };

      const sectionTitle = (text: string) => {
        ensureSpace(40);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(text, margin, cursorY);
        cursorY += 10;
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 14;
      };

      const card = (x: number, y: number, w: number, h: number) => {
        doc.setDrawColor(0);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(x, y, w, h, 8, 8, 'FD');
      };

      // Header
      doc.setTextColor(0, 0, 0);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('InteractGEN', margin, cursorY);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('AI Readiness Report', margin + 120, cursorY);
      cursorY += 18;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      const websiteLine = `Website: ${url}`;
      const websiteLines = doc.splitTextToSize(websiteLine, pageWidth - margin * 2);
      doc.text(websiteLines, margin, cursorY);
      cursorY += websiteLines.length * 16 + 4;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, cursorY);
      cursorY += 14;
      doc.setLineWidth(1);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 18;

      // Summary
      sectionTitle('Summary');
      const summaryScore = enhancedScore > 0 ? enhancedScore : overallScore;
      const doneChecks = combinedChecks.filter(c => c.status !== 'pending' && c.status !== 'checking');
      const countPass = doneChecks.filter(c => c.status === 'pass').length;
      const countWarn = doneChecks.filter(c => c.status === 'warning').length;
      const countFail = doneChecks.filter(c => c.status === 'fail').length;

      ensureSpace(110);
      const gap = 12;
      const cardW = (pageWidth - margin * 2 - gap * 2) / 3;
      const cardH = 86;
      const y0 = cursorY;

      card(margin, y0, cardW, cardH);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(10);
      doc.text('Overall Score', margin + 12, y0 + 18);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(28);
      doc.text(String(summaryScore), margin + 12, y0 + 56);
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(10);
      doc.text('/ 100', margin + 70, y0 + 56);

      card(margin + cardW + gap, y0, cardW, cardH);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(10);
      doc.text('Check Breakdown', margin + cardW + gap + 12, y0 + 18);
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`Pass: ${countPass}`, margin + cardW + gap + 12, y0 + 38);
      doc.text(`Warning: ${countWarn}`, margin + cardW + gap + 12, y0 + 54);
      doc.text(`Fail: ${countFail}`, margin + cardW + gap + 12, y0 + 70);

      card(margin + (cardW + gap) * 2, y0, cardW, cardH);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(10);
      doc.text('AI Insights', margin + (cardW + gap) * 2 + 12, y0 + 18);
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`Count: ${aiInsights.length}`, margin + (cardW + gap) * 2 + 12, y0 + 38);
      const avgAi = aiInsights.length > 0
        ? Math.round(aiInsights.reduce((sum, c) => sum + (c.score || 0), 0) / aiInsights.length)
        : null;
      doc.text(`Avg Score: ${avgAi === null ? '—' : avgAi}`, margin + (cardW + gap) * 2 + 12, y0 + 54);

      cursorY = y0 + cardH + 18;

      const narrative = String(analysisData.overallAIReadiness || '').trim();
      const priorities: string[] = Array.isArray(analysisData.topPriorities) ? analysisData.topPriorities : [];
      if (narrative || priorities.length > 0) {
        ensureSpace(140);
        const h = 120;
        card(margin, cursorY, pageWidth - margin * 2, h);
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(10);
        doc.text('Key Notes', margin + 12, cursorY + 18);

        let y = cursorY + 34;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(10);
        if (narrative) {
          const used = measureWrapped(`Summary: ${narrative}`, 10, pageWidth - margin * 2 - 24, 2);
          doc.text(doc.splitTextToSize(`Summary: ${narrative}`, pageWidth - margin * 2 - 24), margin + 12, y);
          y += used + 6;
        }
        if (priorities.length > 0) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(10);
          doc.text('Top Priorities:', margin + 12, y);
          y += 14;
          doc.setFont('Helvetica', 'normal'); doc.setFontSize(10);
          priorities.forEach((p, i) => {
            const lines = doc.splitTextToSize(`${i + 1}. ${p}`, pageWidth - margin * 2 - 36);
            doc.text(lines, margin + 18, y);
            y += lines.length * 12;
          });
        }
        cursorY += h + 18;
      }

      // Radar chart + metrics table
      const allMetrics = getAllMetricsForRadar();
      if (allMetrics.length > 0) {
        sectionTitle('Radar Chart (All Metrics)');
        const chartW = pageWidth - margin * 2;
        const chartH = chartW * 0.72;
        ensureSpace(chartH + 12);
        
        if (radarImageData) {
          // Use captured image if available
          try {
            card(margin, cursorY, chartW, chartH);
            doc.addImage(radarImageData, 'PNG', margin + 12, cursorY + 12, chartW - 24, chartH - 24, undefined, 'FAST');
            cursorY += chartH + 18;
          } catch (imgError) {
            console.warn('Failed to add radar image, drawing simple chart instead:', imgError);
            // Fall through to draw simple chart
            radarImageData = null;
          }
        }
        
        // If image capture failed or wasn't available, draw a simple radar chart using jsPDF
        if (!radarImageData) {
          const chartX = margin + 12;
          const chartY = cursorY + 12;
          const chartSize = Math.min(chartW - 24, chartH - 24);
          const centerX = chartX + chartSize / 2;
          const centerY = chartY + chartSize / 2;
          const radius = chartSize / 2 - 40;
          
          // Draw grid circles
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          for (let level = 1; level <= 5; level++) {
            const r = (radius * level) / 5;
            doc.circle(centerX, centerY, r, 'D');
          }
          
          // Draw axes
          const angleStep = (Math.PI * 2) / allMetrics.length;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          for (let i = 0; i < allMetrics.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x2 = centerX + radius * Math.cos(angle);
            const y2 = centerY + radius * Math.sin(angle);
            doc.line(centerX, centerY, x2, y2);
          }
          
          // Draw data polygon
          doc.setDrawColor(0, 0, 0);
          doc.setFillColor(240, 240, 240);
          doc.setLineWidth(1);
          const points: number[][] = [];
          for (let i = 0; i < allMetrics.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const r = (allMetrics[i].score / 100) * radius;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            points.push([x, y]);
          }
          
          // Draw polygon outline
          if (points.length > 0) {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(1.5);
            // Draw polygon outline
            for (let i = 0; i < points.length; i++) {
              const p1 = points[i];
              const p2 = points[(i + 1) % points.length];
              doc.line(p1[0], p1[1], p2[0], p2[1]);
            }
            // Draw lines from center to each point for better visibility
            doc.setLineWidth(0.5);
            doc.setDrawColor(200, 200, 200);
            for (const p of points) {
              doc.line(centerX, centerY, p[0], p[1]);
            }
          }
          
          // Draw data points and labels
          doc.setFontSize(8);
          for (let i = 0; i < allMetrics.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const r = (allMetrics[i].score / 100) * radius;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            
            // Data point
            doc.setFillColor(0, 0, 0);
            doc.circle(x, y, 3, 'F');
            
            // Label - use full label without truncation
            const labelR = radius + 35; // Increased distance for longer labels
            const labelX = centerX + labelR * Math.cos(angle);
            const labelY = centerY + labelR * Math.sin(angle);
            doc.setTextColor(0, 0, 0);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7); // Slightly smaller font to fit more text
            // Split long labels across multiple lines if needed
            const labelLines = doc.splitTextToSize(allMetrics[i].label, 60); // Max width for label
            labelLines.forEach((line: string, lineIdx: number) => {
              doc.text(line, labelX, labelY + (lineIdx * 8), { align: 'center' });
            });
            doc.setFontSize(7);
            doc.text(`${allMetrics[i].score}%`, labelX, labelY + (labelLines.length * 8) + 6, { align: 'center' });
          }
          
          cursorY += chartH + 18;
        }
        
        // Add a complete metrics list below the chart to ensure all metrics are visible
        ensureSpace(60);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('All Metrics (Complete List):', margin + 12, cursorY);
        cursorY += 14;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        const metricsPerColumn = Math.ceil(allMetrics.length / 2);
        const colWidth = (pageWidth - margin * 2 - 24) / 2;
        let col1Y = cursorY;
        let col2Y = cursorY;
        
        allMetrics.forEach((metric, idx) => {
          const isSecondColumn = idx >= metricsPerColumn;
          const xPos = isSecondColumn ? margin + 12 + colWidth + 12 : margin + 12;
          const yPos = isSecondColumn ? col2Y : col1Y;
          
          const metricText = `${metric.label}: ${metric.score}%`;
          const lines = doc.splitTextToSize(metricText, colWidth - 8);
          lines.forEach((line: string, lineIdx: number) => {
            doc.text(line, xPos, yPos + (lineIdx * 10));
          });
          
          if (isSecondColumn) {
            col2Y += lines.length * 10 + 4;
          } else {
            col1Y += lines.length * 10 + 4;
          }
        });
        
        cursorY = Math.max(col1Y, col2Y) + 12;
      }

      sectionTitle('Metrics Table');
      const rows = doneChecks.map(c => ({
        label: c.label,
        id: c.id,
        score: c.score ?? 0,
        status: c.status,
        category: (c as any).isAI ? 'AI' : (['robots-txt', 'sitemap', 'llms-txt'].includes(c.id) ? 'Domain' : 'Page'),
      }));

      const tableW = pageWidth - margin * 2;
      const colMetricW = 310;
      const colCatW = 70;
      const colScoreW = 40;
      const colStatusW = tableW - colMetricW - colCatW - colScoreW;
      const xMetric = margin + 8;
      const xCat = margin + 8 + colMetricW;
      const xScore = xCat + colCatW;
      const xStatus = xScore + colScoreW;

      const drawTableHeader = () => {
        ensureSpace(26);
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, cursorY, tableW, 22, 'F');
        doc.setDrawColor(0);
        doc.rect(margin, cursorY, tableW, 22, 'S');
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(9);
        doc.text('Metric', xMetric, cursorY + 14);
        doc.text('Type', xCat, cursorY + 14);
        doc.text('Score', xScore, cursorY + 14);
        doc.text('Status', xStatus, cursorY + 14);
        cursorY += 22;
      };

      drawTableHeader();
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);
      rows.forEach(r => {
        const metricText = `${r.label} (${r.id})`;
        const metricLines = doc.splitTextToSize(metricText, colMetricW - 14);
        const rowH = Math.max(18, metricLines.length * 12);
        if (cursorY + rowH > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
          drawTableHeader();
        }
        doc.rect(margin, cursorY, tableW, rowH, 'S');
        doc.text(metricLines, xMetric, cursorY + 12);
        doc.text(String(r.category), xCat, cursorY + 12);
        doc.text(String(r.score), xScore, cursorY + 12);
        doc.text(String(r.status).toUpperCase(), xStatus, cursorY + 12);
        cursorY += rowH;
      });
      cursorY += 18;

      // Detailed findings (still UI-structured, no raw JSON)
      sectionTitle('Detailed Findings');
      const contentW = pageWidth - margin * 2 - 24;
      const sanitizeText = (text: string): string => {
        if (!text) return '';
        // Replace common problematic characters that jsPDF might not handle well
        let sanitized = String(text);
        // Replace arrow characters with ASCII equivalents
        sanitized = sanitized.replace(/\u2192/g, '->');  // →
        sanitized = sanitized.replace(/\u2190/g, '<-');  // ←
        sanitized = sanitized.replace(/\u21D2/g, '=>');  // ⇒
        sanitized = sanitized.replace(/\u21D0/g, '<=');  // ⇐
        // Replace checkmarks and X marks
        sanitized = sanitized.replace(/\u2713/g, '[Found]');  // ✓
        sanitized = sanitized.replace(/\u2714/g, '[Found]');  // ✔
        sanitized = sanitized.replace(/\u2715/g, '[Not Found]');   // ✕
        sanitized = sanitized.replace(/\u2716/g, '[Not Found]');   // ✖
        sanitized = sanitized.replace(/\u2717/g, '[Not Found]');   // ✗
        sanitized = sanitized.replace(/\u2718/g, '[Not Found]');   // ✘
        // Replace other common symbols
        sanitized = sanitized.replace(/\u2022/g, '*');     // •
        sanitized = sanitized.replace(/\u25CF/g, '*');     // ●
        sanitized = sanitized.replace(/\u25CB/g, 'o');     // ○
        sanitized = sanitized.replace(/\u25AA/g, '*');     // ▪
        sanitized = sanitized.replace(/\u25AB/g, '*');     // ▫
        sanitized = sanitized.replace(/\u25B6/g, '>');     // ▶
        sanitized = sanitized.replace(/\u25C0/g, '<');     // ◀
        // Replace dashes and quotes
        sanitized = sanitized.replace(/\u2013/g, '-');     // –
        sanitized = sanitized.replace(/\u2014/g, '--');    // —
        sanitized = sanitized.replace(/\u201C/g, '"');     // "
        sanitized = sanitized.replace(/\u201D/g, '"');     // "
        sanitized = sanitized.replace(/\u2018/g, "'");     // '
        sanitized = sanitized.replace(/\u2019/g, "'");     // '
        sanitized = sanitized.replace(/\u201A/g, ',');     // ‚
        sanitized = sanitized.replace(/\u201B/g, "'");     // ‛
        sanitized = sanitized.replace(/\u201E/g, '"');     // „
        sanitized = sanitized.replace(/\u201F/g, '"');     // ‟
        // Replace ellipsis
        sanitized = sanitized.replace(/\u2026/g, '...');   // …
        // Replace copyright and trademark symbols
        sanitized = sanitized.replace(/\u00A9/g, '(c)');    // ©
        sanitized = sanitized.replace(/\u00AE/g, '(R)');    // ®
        sanitized = sanitized.replace(/\u2122/g, '(TM)'); // ™
        // Replace degree and other symbols
        sanitized = sanitized.replace(/\u00B0/g, 'deg'); // °
        sanitized = sanitized.replace(/\u00B1/g, '+/-');   // ±
        sanitized = sanitized.replace(/\u00D7/g, 'x');     // ×
        sanitized = sanitized.replace(/\u00F7/g, '/');      // ÷
        // Replace currency symbols
        sanitized = sanitized.replace(/\u00A2/g, 'cents');  // ¢
        sanitized = sanitized.replace(/\u00A3/g, 'GBP');     // £
        sanitized = sanitized.replace(/\u00A4/g, 'EUR');    // ¤
        sanitized = sanitized.replace(/\u00A5/g, 'JPY');   // ¥
        sanitized = sanitized.replace(/\u20AC/g, 'EUR');     // €
        sanitized = sanitized.replace(/\u00A3/g, 'GBP');      // £
        return sanitized;
      };

      const drawCheck = (check: any) => {
        const title = `${check.isAI ? 'AI: ' : ''}${sanitizeText(check.label)}`;
        const status = String(check.status).toUpperCase();
        const score = check.score ?? 0;

        const details = check.details ? sanitizeText(String(check.details)) : '';
        const rec = check.recommendation ? sanitizeText(String(check.recommendation)) : '';
        const actions: string[] = Array.isArray(check.actionItems) 
          ? check.actionItems.map(a => sanitizeText(String(a)))
          : [];

        // Measure required height
        let needed = 54; // title + meta
        if (details) needed += 14 + measureWrapped(details, 9, contentW, 2) + 6;
        if (rec) needed += 14 + measureWrapped(rec, 9, contentW, 2) + 6;
        if (actions.length > 0) {
          needed += 14;
          actions.forEach(a => { needed += measureWrapped(`• ${a}`, 9, contentW, 2) + 2; });
          needed += 6;
        }
        needed = Math.min(Math.max(needed, 90), pageHeight - margin * 2); // clamp to page

        ensureSpace(needed + 10);
        card(margin, cursorY, pageWidth - margin * 2, needed);
        const startY = cursorY;

        doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
        doc.text(title, margin + 12, startY + 20);
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);
        doc.text(`Status: ${status}   |   Score: ${score}`, margin + 12, startY + 36);

        let y = startY + 54;
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);
        if (details) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(9);
          doc.text('Details:', margin + 12, y);
          y += 12;
          doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);
          const lines = doc.splitTextToSize(details, contentW);
          doc.text(lines, margin + 12, y);
          y += lines.length * 11 + 6;
        }
        if (rec) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(9);
          doc.text('Recommendation:', margin + 12, y);
          y += 12;
          doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);
          const lines = doc.splitTextToSize(rec, contentW);
          doc.text(lines, margin + 12, y);
          y += lines.length * 11 + 6;
        }
        if (actions.length > 0) {
          doc.setFont('Helvetica', 'bold'); doc.setFontSize(9);
          doc.text('Action Items:', margin + 12, y);
          y += 12;
          doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);
          actions.forEach(a => {
            const lines = doc.splitTextToSize(`• ${a}`, contentW);
            doc.text(lines, margin + 12, y);
            y += lines.length * 11 + 2;
          });
        }

        cursorY = startY + needed + 12;
      };

      doneChecks.forEach(c => drawCheck(c));

      // Create filename with sanitized URL
      let urlForFilename = url
        .replace(/https?:\/\//g, '') // Remove protocol
        .replace(/\/$/, '') // Remove trailing slash
        .replace(/[^a-zA-Z0-9.-]/g, '-') // Replace non-alphanumeric with dash
        .replace(/-+/g, '-') // Replace multiple dashes with single dash
        .replace(/^-|-$/g, '') // Remove leading/trailing dashes
        .substring(0, 50);
      // Remove trailing dash if present
      urlForFilename = urlForFilename.replace(/-$/, '');
      doc.save(`interactgen-ai-readiness-report-${urlForFilename}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  useEffect(() => {
    if (analysisData && analysisData.checks && showResults) {
      // Use real data from API
      const mappedChecks = analysisData.checks.map((check: any) => ({
        ...check,
        icon: checks.find(c => c.id === check.id)?.icon || FileText,
        description: check.details || checks.find(c => c.id === check.id)?.description,
      }));
      setChecks(mappedChecks);
      setCombinedChecks(mappedChecks); // Initialize with basic checks
      setOverallScore(analysisData.overallScore || 0);
      setCurrentCheckIndex(-1);
      
      // If AI analysis should auto-start, handle the promise
      if (analysisData.autoStartAI && analysisData.aiAnalysisPromise) {
        console.log('Auto-starting AI analysis with promise');
        setIsAnalyzingAI(true);
        setShowAIAnalysis(true);
        
        // Add placeholder AI tiles immediately with actual titles
        const placeholderAIChecks = [
          {
            id: 'ai-loading-0',
            label: 'Content Quality for AI',
            description: 'Analyzing content signal ratio...',
            icon: Sparkles,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-1',
            label: 'Information Architecture',
            description: 'Evaluating page structure...',
            icon: Bot,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-2',
            label: 'Crawlability Patterns',
            description: 'Checking JavaScript usage...',
            icon: Database,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-3',
            label: 'AI Training Value',
            description: 'Assessing training potential...',
            icon: Network,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-4',
            label: 'Knowledge Extraction',
            description: 'Analyzing entity definitions...',
            icon: FileCode,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-5',
            label: 'Template Quality',
            description: 'Reviewing semantic structure...',
            icon: Shield,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-6',
            label: 'Content Depth',
            description: 'Measuring content richness...',
            icon: Zap,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-7',
            label: 'Machine Readability',
            description: 'Testing extraction reliability...',
            icon: Globe,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          }
        ];
        
        // Add loading AI tiles with staggered animation
        placeholderAIChecks.forEach((check, idx) => {
          setTimeout(() => {
            setCombinedChecks(prev => [...prev, check]);
          }, 100 * (idx + 1));
        });
        
        // Handle the AI analysis promise
        analysisData.aiAnalysisPromise
          .then(async (aiResponse: any) => {
            if (aiResponse) {
              const data = await aiResponse.json();
              if (data.success && data.insights) {
                // Convert AI insights to CheckItem format
                const aiChecks: CheckItem[] = data.insights.map((insight: any, idx: number) => ({
                  ...insight,
                  icon: [Sparkles, Bot, Database, Network, FileCode, Shield, Zap, Globe][idx % 8],
                  description: insight.details?.substring(0, 60) + '...' || 'AI Analysis',
                  isAI: true,
                }));
                
                setAiInsights(aiChecks);
                
                // Replace loading tiles with real AI tiles
                setCombinedChecks(prev => {
                  // Remove loading tiles
                  const withoutLoading = prev.filter(c => !(c as any).isLoading);
                  // Add real AI tiles
                  return [...withoutLoading, ...aiChecks];
                });
                
                // Calculate enhanced score
                if (data.insights.length > 0) {
                  const aiScores = data.insights.map((i: any) => i.score || 0);
                  const avgAiScore = aiScores.reduce((a: number, b: number) => a + b, 0) / aiScores.length;
                  const combinedScore = Math.round((overallScore * 0.6) + (avgAiScore * 0.4));
                  setEnhancedScore(combinedScore);
                }
              }
            }
          })
          .catch(error => {
            console.error('AI analysis error:', error);
            // Remove loading tiles on error
            setCombinedChecks(prev => prev.filter(c => !(c as any).isLoading));
          })
          .finally(() => {
            setIsAnalyzingAI(false);
          });
      }
    } else if (isAnalyzing) {
      // Reset all checks when starting analysis
      const resetChecks = checks.map(check => ({ ...check, status: 'pending' as const }));
      setChecks(resetChecks);
      setCombinedChecks(resetChecks); // Reset combined checks too
      setCurrentCheckIndex(0);
      setOverallScore(0);
      
      // Visual animation while waiting for real results
      const checkInterval = setInterval(() => {
        setCurrentCheckIndex(prev => {
          if (prev >= checks.length - 1) {
            clearInterval(checkInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 200);

      return () => clearInterval(checkInterval);
    }
  }, [isAnalyzing, showResults, analysisData]);

  useEffect(() => {
    if (currentCheckIndex >= 0 && currentCheckIndex < checks.length && isAnalyzing) {
      // Mark current as checking during animation
      setChecks(prev => prev.map((check, index) => {
        if (index === currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        if (index < currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        return check;
      }));
      
      // Update combinedChecks to show the animation
      setCombinedChecks(prev => prev.map((check, index) => {
        if (index === currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        if (index < currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        return check;
      }));
    }
  }, [currentCheckIndex, checks.length, isAnalyzing]);

  const getStatusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-16 h-16 text-heat-100 animate-spin" />;
      case 'pass':
        return <CheckCircle2 className="w-16 h-16 text-accent-black" />;
      case 'fail':
        return <XCircle className="w-16 h-16 text-heat-200" />;
      case 'warning':
        return <AlertCircle className="w-16 h-16 text-heat-100" />;
      default:
        return <div className="w-16 h-16 rounded-full border border-black-alpha-8" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-accent-black";
    if (score >= 60) return "text-accent-black";
    return "text-accent-black";
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-[1200px] mx-auto"
    >
      {/* Header */}
      <motion.div 
        className="text-center mb-48 pt-24 md:pt-0"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-title-h2 text-accent-black mb-12">AI Readiness Analysis</h2>
        <p className="text-body-large text-black-alpha-64">Single-page snapshot of {url}</p>
        
        {showResults && (
          <>
            {/* View Mode Toggle - Moved above score */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-24 mb-20 flex justify-center gap-4"
            >
              <button
                onClick={() => setViewMode('grid')}
                className={`px-16 py-8 rounded-8 text-label-medium font-medium transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-accent-black text-white shadow-md' 
                    : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
                }`}
              >
                Grid View
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-16 py-8 rounded-8 text-label-medium font-medium transition-all ${
                  viewMode === 'chart' 
                    ? 'bg-accent-black text-white shadow-md' 
                    : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
                }`}
              >
                Radar Chart
              </button>
              <button
                onClick={() => setViewMode('bars')}
                className={`px-16 py-8 rounded-8 text-label-medium font-medium transition-all ${
                  viewMode === 'bars' 
                    ? 'bg-accent-black text-white shadow-md' 
                    : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
                }`}
              >
                Bar Chart
              </button>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.5 }}
              className="flex justify-center"
            >
              <ScoreChart 
                score={enhancedScore > 0 ? enhancedScore : overallScore}
                enhanced={enhancedScore > 0}
                size={180}
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Conditional rendering based on view mode */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 mb-40 px-40 relative">
          {combinedChecks.map((check, index) => {
            const isActive = index === currentCheckIndex;
            
            return (
              <motion.div
                key={check.id}
                initial={(check as any).isAI ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: isActive ? 1.05 : 1,
                }}
                transition={{ 
                  delay: (check as any).isAI ? 0 : index * 0.1,
                  scale: { type: "spring", stiffness: 300 }
                }}
                className={`
                  relative p-16 rounded-8 transition-all bg-accent-white border
                  ${(check as any).isAI ? 'border-heat-100 border-opacity-40 bg-gradient-to-br from-accent-white to-heat-4' : 'border-black-alpha-8'}
                  ${isActive ? 'border-heat-100 shadow-lg' : ''}
                  ${check.status !== 'pending' && check.status !== 'checking' ? 'cursor-pointer hover:shadow-md' : ''}
                  ${(check as any).isLoading ? 'animate-pulse' : ''}
                `}
                onClick={() => {
                  if (check.status !== 'pending' && check.status !== 'checking') {
                    setSelectedCheck(selectedCheck === check.id ? null : check.id);
                  }
                }}
                onMouseEnter={() => setHoveredCheck(check.id)}
                onMouseLeave={() => setHoveredCheck(null)}
              >
                <div className="relative">
                  <div className="flex items-start justify-end mb-12">
                    {getStatusIcon(check.status)}
                  </div>
                  
                  <h3 className="text-label-large mb-4 text-accent-black font-medium flex items-center gap-6">
                    {check.label}
                    {check.tooltip && !aiInsights.some(ai => ai.id === check.id) && (
                      <div className="relative inline-block">
                        <Info className="w-14 h-14 text-black-alpha-32 hover:text-black-alpha-64 transition-colors" />
                        <AnimatePresence>
                          {hoveredCheck === check.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 w-200 p-8 bg-accent-black text-white text-body-x-small rounded-6 shadow-lg z-50 pointer-events-none"
                            >
                              {check.tooltip}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-accent-black" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </h3>
                  
                  <p className="text-body-small text-black-alpha-64">
                    {check.description}
                  </p>
                  
                  {check.status !== 'pending' && check.status !== 'checking' && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8"
                      >
                        <div className="h-2 bg-black-alpha-4 rounded-full overflow-hidden">
                          <motion.div
                            className={`
                              h-full rounded-full
                              ${check.status === 'pass' ? 'bg-accent-black' : ''}
                              ${check.status === 'warning' ? 'bg-heat-100' : ''}
                              ${check.status === 'fail' ? 'bg-heat-200' : ''}
                            `}
                            initial={{ width: 0 }}
                            animate={{ width: `${check.score}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-label-x-small text-black-alpha-32 mt-4 text-center"
                      >
                        Click for details
                      </motion.div>
                    </>
                  )}
                </div>
                
                {/* Expanded Details */}
                <AnimatePresence>
                  {selectedCheck === check.id && check.details && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mt-12 pt-12 border-t border-black-alpha-8"
                    >
                      <div className="space-y-6">
                        <div>
                          <div className="text-label-small text-black-alpha-48 mb-2">Status</div>
                          <div className="text-body-small text-accent-black">{check.details}</div>
                        </div>
                        <div>
                          <div className="text-label-small text-black-alpha-48 mb-2">Recommendation</div>
                          <div className="text-body-small text-black-alpha-64">{check.recommendation}</div>
                          {check.actionItems && check.actionItems.length > 0 && (
                            <ul className="mt-4 space-y-2">
                              {check.actionItems.map((item: string, i: number) => (
                                <li key={i} className="flex items-start gap-6 text-body-small text-black-alpha-64">
                                  <span className="text-heat-100 mt-1">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Radar Chart View */}
      {viewMode === 'chart' && showResults && (
        <div>
          <motion.div 
            className="flex justify-center gap-40 mb-40"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Basic Analysis Chart */}
            <div className="flex flex-col items-center">
              <h3 className="text-label-large text-accent-black mb-16 font-medium">Basic Analysis</h3>
              <RadarChart 
                data={checks
                  .filter(check => check.status !== 'pending' && check.status !== 'checking')
                  .map(check => ({
                    label: check.label,
                    score: check.score || 0
                  }))}
                size={350}
              />
              <div className="mt-16 text-center">
                <div className="text-title-h3 text-accent-black">{overallScore}%</div>
                <div className="text-label-small text-black-alpha-48">Overall Score</div>
              </div>
            </div>
            
            {/* VS Indicator */}
            {aiInsights.length > 0 && (
              <motion.div 
                className="flex items-center"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <div className="text-label-large text-black-alpha-32 font-medium">VS</div>
              </motion.div>
            )}
            
            {/* AI Analysis Chart - Only show if AI insights exist */}
            {aiInsights.length > 0 && (
              <motion.div 
                className="flex flex-col items-center"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-label-large text-heat-100 mb-16 font-medium">AI Enhanced Analysis</h3>
                <RadarChart 
                  data={aiInsights
                    .filter(check => check.status !== 'pending' && check.status !== 'checking')
                    .slice(0, 8)
                    .map(check => ({
                      label: check.label.length > 12 ? check.label.substring(0, 12) + '...' : check.label,
                      score: check.score || 0
                    }))}
                  size={350}
                />
                <div className="mt-16 text-center">
                  <div className="text-title-h3 text-heat-100">
                    {Math.round(aiInsights.reduce((sum, check) => sum + (check.score || 0), 0) / aiInsights.length)}%
                  </div>
                  <div className="text-label-small text-heat-100 opacity-60">AI Score</div>
                </div>
              </motion.div>
            )}
          </motion.div>
          
          {/* Comparison Summary */}
          {aiInsights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center mb-20"
            >
              <div className="inline-flex items-center gap-8 px-16 py-8 bg-heat-4 rounded-8">
                <span className="text-label-medium text-accent-black">
                  AI analysis found {aiInsights.filter(i => i.score && i.score < 50).length} additional areas for improvement
                </span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Bar Chart View */}
      {viewMode === 'bars' && showResults && (
        <motion.div 
          className="px-40 mb-40"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <MetricBars 
            metrics={combinedChecks
              .filter(check => check.status !== 'pending' && check.status !== 'checking')
              .map(check => ({
                label: check.label,
                score: check.score || 0,
                status: check.status as 'pass' | 'warning' | 'fail',
                category: (check as any).isAI ? 'ai' : 
                  ['robots-txt', 'sitemap', 'llms-txt'].includes(check.id) ? 'domain' : 'page',
                details: check.details,
                recommendation: check.recommendation,
                actionItems: check.actionItems
              }))}
          />
        </motion.div>
      )}

      {/* Action Buttons */}
      {showResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap gap-12 justify-center"
        >
          <button
            onClick={onReset}
            className="px-20 py-10 bg-accent-white border border-black-alpha-8 hover:bg-black-alpha-4 rounded-8 text-label-medium transition-all"
          >
            Analyze Another Site
          </button>
          <button
            onClick={handleExportPdf}
            className="px-20 py-10 bg-accent-white border border-black-alpha-8 hover:bg-black-alpha-4 rounded-8 text-label-medium transition-all"
          >
            Export Report (PDF)
          </button>
          <button
            onClick={async () => {
              if (!url) {
                alert('Please enter a URL first');
                return;
              }
              
              setIsGeneratingLlmsTxt(true);
              setLlmsTxtError(null);
              setLlmsTxtContent(null);
              
              try {
                // Auto-prepend https:// if no protocol is provided
                let processedUrl = url.trim();
                if (!processedUrl.match(/^https?:\/\//i)) {
                  processedUrl = 'https://' + processedUrl;
                }
                
                const response = await fetch('/api/generate-llms-txt', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ url: processedUrl }),
                });
                
                const data = await response.json();
                
                if (data.success) {
                  setLlmsTxtContent(data.content);
                  setShowLlmsTxtModal(true);
                } else {
                  setLlmsTxtError(data.error || 'Failed to generate llms.txt');
                }
              } catch (error) {
                console.error('LLMs.txt generation error:', error);
                setLlmsTxtError('An error occurred while generating llms.txt');
              } finally {
                setIsGeneratingLlmsTxt(false);
              }
            }}
            disabled={isGeneratingLlmsTxt || !url}
            className="px-20 py-10 bg-heat-100 hover:bg-heat-200 text-white rounded-8 text-label-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingLlmsTxt ? 'Generating...' : 'Generate llms.txt'}
          </button>
          {true && ( 
            <button 
              onClick={async () => {
              setIsAnalyzingAI(true);
              setShowAIAnalysis(true);
              
              // Add placeholder AI tiles immediately with actual titles
              const placeholderAIChecks = [
                {
                  id: 'ai-loading-0',
                  label: 'Content Quality for AI',
                  description: 'Analyzing content signal ratio...',
                  icon: Sparkles,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-1',
                  label: 'Information Architecture',
                  description: 'Evaluating page structure...',
                  icon: Bot,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-2',
                  label: 'Crawlability Patterns',
                  description: 'Checking JavaScript usage...',
                  icon: Database,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-3',
                  label: 'AI Training Value',
                  description: 'Assessing training potential...',
                  icon: Network,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-4',
                  label: 'Knowledge Extraction',
                  description: 'Analyzing entity definitions...',
                  icon: FileCode,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-5',
                  label: 'Template Quality',
                  description: 'Reviewing semantic structure...',
                  icon: Shield,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-6',
                  label: 'Content Depth',
                  description: 'Measuring content richness...',
                  icon: Zap,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-7',
                  label: 'Machine Readability',
                  description: 'Testing extraction reliability...',
                  icon: Globe,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                }
              ];
              
              // Add loading AI tiles with staggered animation immediately
              placeholderAIChecks.forEach((check, idx) => {
                setTimeout(() => {
                  setCombinedChecks(prev => [...prev, check]);
                }, 100 * (idx + 1));
              });
              
              try {
                const response = await fetch('/api/ai-analysis', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    url,
                    htmlContent: analysisData?.htmlContent || '',
                    currentChecks: checks
                  })
                });
                
                const data = await response.json();
                if (data.success && data.insights) {
                  // Convert AI insights to CheckItem format with AI flag
                  const aiChecks: CheckItem[] = data.insights.map((insight: any, idx: number) => ({
                    ...insight,
                    icon: [Sparkles, Bot, Database, Network, FileCode, Shield, Zap, Globe][idx % 8],
                    description: insight.details?.substring(0, 60) + '...' || 'AI Analysis',
                    isAI: true, // Mark as AI-generated
                  }));
                  
                  setAiInsights(aiChecks);
                  
                  // Replace loading tiles with real AI tiles
                  setCombinedChecks(prev => {
                    // Remove loading tiles
                    const withoutLoading = prev.filter(c => !(c as any).isLoading);
                    // Add real AI tiles
                    return [...withoutLoading, ...aiChecks];
                  });
                  
                  // Calculate enhanced score
                  if (data.insights.length > 0) {
                    const aiScores = data.insights.map((i: any) => i.score || 0);
                    const avgAiScore = aiScores.reduce((a: number, b: number) => a + b, 0) / aiScores.length;
                    const combinedScore = Math.round((overallScore * 0.6) + (avgAiScore * 0.4));
                    setEnhancedScore(combinedScore);
                  }
                }
              } catch (error) {
                console.error('AI analysis error:', error);
                // Remove loading tiles on error
                setCombinedChecks(prev => prev.filter(c => !(c as any).isLoading));
              } finally {
                setIsAnalyzingAI(false);
              }
            }}
            disabled={isAnalyzingAI}
            className="px-20 py-10 bg-accent-black hover:bg-black-alpha-80 text-white rounded-8 text-label-medium transition-all disabled:opacity-50"
          >
              {isAnalyzingAI ? 'Analyzing...' : 'Analyze with AI'}
            </button>
          )}
        </motion.div>
      )}

      {/* Offscreen monochrome radar chart for PDF export (works from any view mode) */}
      {showResults && (
        <div
          ref={radarChartRef}
          style={{
            position: 'absolute',
            left: -10000,
            top: 0,
            width: 1,
            height: 1,
            overflow: 'hidden',
            background: '#ffffff',
          }}
          aria-hidden="true"
        >
          <div style={{ background: '#ffffff', padding: 16, width: 700 }}>
            <RadarChart
              data={getAllMetricsForRadar()}
              size={520}
              variant="mono"
              showLegend={false}
              disableAnimation={true}
            />
          </div>
        </div>
      )}

      {/* LLMs.txt Modal */}
      <AnimatePresence>
        {showLlmsTxtModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black-alpha-64 z-50 flex items-center justify-center p-16"
            onClick={() => setShowLlmsTxtModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-accent-white rounded-12 p-24 max-w-800 w-full max-h-[80vh] flex flex-col shadow-xl"
            >
              <div className="flex items-center justify-between mb-16">
                <h3 className="text-title-h3 text-accent-black">Generated llms.txt</h3>
                <button
                  onClick={() => setShowLlmsTxtModal(false)}
                  className="text-black-alpha-48 hover:text-accent-black transition-colors"
                >
                  <XCircle className="w-24 h-24" />
                </button>
              </div>
              
              {llmsTxtError && (
                <div className="mb-16 p-12 bg-heat-200 bg-opacity-20 rounded-8 text-body-small text-heat-200">
                  {llmsTxtError}
                </div>
              )}
              
              {llmsTxtContent && (
                <>
                  <div className="flex-1 overflow-auto mb-16">
                    <pre className="bg-black-alpha-4 p-16 rounded-8 text-body-small text-accent-black whitespace-pre-wrap font-mono overflow-x-auto">
                      {llmsTxtContent}
                    </pre>
                  </div>
                  <div className="flex gap-12">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(llmsTxtContent);
                        alert('Copied to clipboard!');
                      }}
                      className="px-20 py-10 bg-accent-black hover:bg-black-alpha-80 text-white rounded-8 text-label-medium transition-all"
                    >
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([llmsTxtContent], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'llms.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-20 py-10 bg-accent-white border border-black-alpha-8 hover:bg-black-alpha-4 rounded-8 text-label-medium transition-all"
                    >
                      Download
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}