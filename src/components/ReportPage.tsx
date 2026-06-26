import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  FileText, 
  Info 
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TherapyPlan } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Setup OKLCH/OKLAB support interceptor for libraries like html2canvas
const setupOklchInterceptor = () => {
  let isRestored = false;
  const originalGetComputedStyle = window.getComputedStyle;
  
  // Backup descriptor of CSSRule.prototype.cssText
  const cssRuleProto = typeof CSSRule !== 'undefined' ? CSSRule.prototype : null;
  const originalCssRuleTextDescriptor = cssRuleProto 
    ? Object.getOwnPropertyDescriptor(cssRuleProto, 'cssText') 
    : null;
  
  // Backup descriptor of CSSStyleDeclaration.prototype.cssText
  const cssStyleDeclProto = typeof CSSStyleDeclaration !== 'undefined' ? CSSStyleDeclaration.prototype : null;
  const originalStyleDeclTextDescriptor = cssStyleDeclProto 
    ? Object.getOwnPropertyDescriptor(cssStyleDeclProto, 'cssText') 
    : null;
  
  // Backup CSSStyleDeclaration.prototype.getPropertyValue
  const originalGetPropertyValue = cssStyleDeclProto ? cssStyleDeclProto.getPropertyValue : null;

  // Helper to translate OKLCH and OKLAB color formats back to safe equivalents (HSL/RGB)
  const approximateOklchToHsl = (cssText: string): string => {
    if (!cssText) return cssText;
    
    // Replace oklch() with equivalent hsl()
    let result = cssText.replace(/oklch\(([^)]+)\)/g, (match, content) => {
      try {
        const parts = content.trim().split(/[\s,+/]+/);
        if (parts.length < 3) return match;

        let lStr = parts[0];
        let cStr = parts[1];
        let hStr = parts[2];
        let aStr = parts[3];

        let l = parseFloat(lStr);
        if (lStr.includes('%')) l = l / 100;

        let c = parseFloat(cStr);
        if (cStr.includes('%')) c = c / 100;

        let h = parseFloat(hStr);
        if (hStr.includes('rad')) {
          h = h * (180 / Math.PI);
        } else if (hStr.includes('grad')) {
          h = h * 0.9;
        } else if (hStr.includes('turn')) {
          h = h * 360;
        }
        if (isNaN(h)) h = 0;

        const s = Math.min(100, Math.max(0, c * 250));
        const lPct = Math.min(100, Math.max(0, l * 100));

        if (aStr !== undefined) {
          let a = parseFloat(aStr);
          if (aStr.includes('%')) a = a / 100;
          return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${lPct.toFixed(1)}%, ${a})`;
        } else {
          return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${lPct.toFixed(1)}%)`;
        }
      } catch {
        return '#888888';
      }
    });

    // Replace oklab() with equivalent rgb() 
    result = result.replace(/oklab\(([^)]+)\)/g, (match, content) => {
      try {
        const parts = content.trim().split(/[\s,+/]+/);
        if (parts.length < 3) return match;

        let lStr = parts[0];
        let aStr = parts[3];

        let l = parseFloat(lStr);
        if (lStr.includes('%')) l = l / 100;

        const grayVal = Math.round(Math.min(255, Math.max(0, l * 255)));

        if (aStr !== undefined) {
          let a = parseFloat(aStr);
          if (aStr.includes('%')) a = a / 100;
          return `rgba(${grayVal}, ${grayVal}, ${grayVal}, ${a})`;
        } else {
          return `rgb(${grayVal}, ${grayVal}, ${grayVal})`;
        }
      } catch {
        return '#888888';
      }
    });

    return result;
  };

  // 1. Intercept CSSRule.prototype.cssText
  if (cssRuleProto && originalCssRuleTextDescriptor && originalCssRuleTextDescriptor.get) {
    try {
      Object.defineProperty(cssRuleProto, 'cssText', {
        configurable: true,
        enumerable: true,
        get() {
          const val = originalCssRuleTextDescriptor.get!.call(this);
          return typeof val === 'string' ? approximateOklchToHsl(val) : val;
        },
        set(newVal) {
          if (originalCssRuleTextDescriptor.set) {
            originalCssRuleTextDescriptor.set.call(this, newVal);
          }
        }
      });
    } catch (err) {
      console.warn('Could not intercept CSSRule.prototype.cssText:', err);
    }
  }

  // 2. Intercept CSSStyleDeclaration.prototype.cssText
  if (cssStyleDeclProto && originalStyleDeclTextDescriptor && originalStyleDeclTextDescriptor.get) {
    try {
      Object.defineProperty(cssStyleDeclProto, 'cssText', {
        configurable: true,
        enumerable: true,
        get() {
          const val = originalStyleDeclTextDescriptor.get!.call(this);
          return typeof val === 'string' ? approximateOklchToHsl(val) : val;
        },
        set(newVal) {
          if (originalStyleDeclTextDescriptor.set) {
            originalStyleDeclTextDescriptor.set.call(this, newVal);
          }
        }
      });
    } catch (err) {
      console.warn('Could not intercept CSSStyleDeclaration.prototype.cssText:', err);
    }
  }

  // 3. Intercept CSSStyleDeclaration.prototype.getPropertyValue
  if (cssStyleDeclProto && originalGetPropertyValue) {
    try {
      cssStyleDeclProto.getPropertyValue = function(prop: string) {
        const val = originalGetPropertyValue.call(this, prop);
        return typeof val === 'string' ? approximateOklchToHsl(val) : val;
      };
    } catch (err) {
      console.warn('Could not intercept getPropertyValue:', err);
    }
  }

  // 4. Intercept window.getComputedStyle with Proxy
  try {
    (window as any).getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
      const style = originalGetComputedStyle.call(window, elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          const val = Reflect.get(target, prop);
          if (typeof val === 'function') {
            return function(this: any, ...args: any[]) {
              const res = val.apply(target, args);
              return typeof res === 'string' ? approximateOklchToHsl(res) : res;
            };
          }
          return typeof val === 'string' ? approximateOklchToHsl(val) : val;
        }
      });
    };
  } catch (proxyError) {
    console.error('Could not set up window.getComputedStyle interceptor proxy:', proxyError);
  }

  const restore = () => {
    if (isRestored) return;
    isRestored = true;

    // Restore CSSRule.prototype.cssText
    if (cssRuleProto && originalCssRuleTextDescriptor) {
      try {
        Object.defineProperty(cssRuleProto, 'cssText', originalCssRuleTextDescriptor);
      } catch (e) {
        console.warn('Failed to restore CSSRule.prototype.cssText:', e);
      }
    }

    // Restore CSSStyleDeclaration.prototype.cssText
    if (cssStyleDeclProto && originalStyleDeclTextDescriptor) {
      try {
        Object.defineProperty(cssStyleDeclProto, 'cssText', originalStyleDeclTextDescriptor);
      } catch (e) {
        console.warn('Failed to restore CSSStyleDeclaration.prototype.cssText:', e);
      }
    }

    // Restore CSSStyleDeclaration.prototype.getPropertyValue
    if (cssStyleDeclProto && originalGetPropertyValue) {
      try {
        cssStyleDeclProto.getPropertyValue = originalGetPropertyValue;
      } catch (e) {
        console.warn('Failed to restore getPropertyValue:', e);
      }
    }

    // Restore window.getComputedStyle
    (window as any).getComputedStyle = originalGetComputedStyle;
  };

  return restore;
};

export const ReportPage: React.FC = () => {
  const [reportPlan, setReportPlan] = useState<TherapyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Auto-notification clear
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Read report ID and fetch document
  useEffect(() => {
    const reportId = new URLSearchParams(window.location.search).get("id");
    console.log("Client-side fetched report ID:", reportId);

    if (!reportId) {
      setError("Report Not Found / রিপোর্ট আইডি অনুপস্থিত।");
      setLoading(false);
      return;
    }

    const loadPlan = async () => {
      try {
        const docRef = doc(db, 'therapyPlans', reportId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const planData = { id: docSnap.id, ...docSnap.data() } as TherapyPlan;
          setReportPlan(planData);
        } else {
          setError("Report Not Found / রিপোর্টটি খুঁজে পাওয়া যায়নি বা মুছে ফেলা হয়েছে।");
        }
      } catch (err: any) {
        console.error("Firestore loading error:", err);
        setError(`Failed to fetch report from database: ${err.message || String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, []);

  // Scale and dimensions calculator for printing and responsiveness
  useEffect(() => {
    if (!reportPlan) return;

    const updateDimensions = () => {
      if (containerRef.current && printAreaRef.current) {
        const parentWidth = containerRef.current.clientWidth;
        const paperWidth = printAreaRef.current.offsetWidth || 794; 
        const scale = Math.min(1, (parentWidth - 16) / paperWidth);
        const paperHeight = printAreaRef.current.offsetHeight || 1123;
        
        setPreviewScale(scale);
        setPreviewHeight(paperHeight * scale);
      }
    };

    const timer = setTimeout(updateDimensions, 100);

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    if (printAreaRef.current) {
      observer.observe(printAreaRef.current);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [reportPlan]);

  // Public print implementation
  const printReport = () => {
    const element = document.getElementById('public-clinical-report-paper');
    if (!element || !reportPlan) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    let headTags = '';
    document.querySelectorAll('link, style').forEach((node) => {
      headTags += node.outerHTML;
    });

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Clinical Speech Assessment Report - ${reportPlan.patientName || 'Patient Copy'}</title>
          ${headTags}
          <style>
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
              body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            body {
              font-family: 'Inter', sans-serif;
              background-color: white;
              padding: 0;
              margin: 0;
            }
            #clinical-report-paper {
              box-shadow: none !important;
              width: 100% !important;
              max-width: 210mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
            }
          </style>
        </head>
        <body>
          <div id="clinical-report-paper" class="bg-white text-slate-900 w-[210mm] min-h-[297mm] p-12 pr-14 pl-14 relative text-xs flex flex-col justify-between">
            ${element.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 500);
              }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    iframeDoc.close();

    setNotification({
      message: 'Opening system print dialog...',
      type: 'info'
    });
  };

  // Public PDF download implementation
  const downloadReportAsPDF = async () => {
    if (!reportPlan) return;
    setIsExporting(true);
    setNotification({
      message: 'Generating professional vector clinical report...',
      type: 'info'
    });

    const restoreStyles = setupOklchInterceptor();

    try {
      const element = document.getElementById('public-clinical-report-paper');
      if (!element) {
        throw new Error('Preview element not found.');
      }

      const documentImages = Array.from(element.querySelectorAll('img'));
      await Promise.all(
        documentImages.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BRG-Speech-Report-${reportPlan.patientName.replace(/\s+/g, '-')}.pdf`);

      setNotification({
        message: 'Clinical report downloaded successfully!',
        type: 'success'
      });
    } catch (error: any) {
      console.error('PDF public generation failed:', error);
      setNotification({
        message: `Failed to compile PDF: ${error.message || 'Rendering error'}`,
        type: 'error'
      });
    } {
      restoreStyles();
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans" id="public-portal-loading">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm font-bold tracking-wide animate-pulse">রিপোর্ট লোড হচ্ছে... / Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !reportPlan) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans" id="public-portal-error">
        <div className="max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-950 border border-red-900 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-sm font-bold tracking-tight uppercase text-white mb-2">Error / ত্রুটি</h3>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mb-6">
            {error || 'Report not found or has been removed. / রিপোর্টটি খুঁজে পাওয়া যায়নি বা মুছে ফেলা হয়েছে।'}
          </p>
          <a
            href="/"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition inline-block"
          >
            Go to Homepage / হোমপেজে ফিরে যান
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-y-auto pb-12" id="vocalis-public-report-root">
      
      {/* TOP COMPACT HEADER */}
      <header className="bg-slate-950 border-b border-slate-800 py-3.5 px-6 sticky top-0 z-50 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-white flex items-center justify-center p-0.5 text-slate-900 font-black shrink-0 shadow-sm">
              BRG
            </div>
            <div>
              <h2 className="text-xs font-black tracking-tight uppercase text-white">BRG Clinical Report Portal</h2>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Bengal Rehabilitation Group</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={printReport}
              className="flex-1 sm:flex-none py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Printer size={13} />
              <span>Print / প্রিন্ট করুন</span>
            </button>
            <button
              type="button"
              onClick={downloadReportAsPDF}
              disabled={isExporting}
              className="flex-1 sm:flex-none py-2 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isExporting ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              <span>Download PDF / ডাউনলোড</span>
            </button>
          </div>
        </div>
      </header>

      {/* NOTIFICATION TOAST BAR */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[100] max-w-sm w-full px-4"
          >
            <div className={`rounded-xl p-3.5 border shadow-xl flex items-start gap-2.5 backdrop-blur-md ${
              notification.type === 'success' ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' :
              notification.type === 'error' ? 'bg-red-950/90 border-red-900 text-red-200' :
              'bg-slate-900/95 border-slate-800 text-blue-200'
            }`}>
              <Info size={16} className="shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold leading-relaxed">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTAINER WORKSPACE */}
      <main className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col items-center gap-6 w-full">
        
        {/* Friendly Bengali instruction card */}
        <div className="w-full max-w-[210mm] bg-blue-950/30 border border-blue-900 rounded-xl p-4 text-left shadow-sm">
          <div className="flex gap-3">
            <div className="text-blue-400 mt-0.5 shrink-0">
              <FileText size={16} />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-blue-200 uppercase tracking-wide">
                Clinical Assessment Report & Home Program / অ্যাসেসমেন্ট ও থেরাপি প্ল্যান
              </h4>
              <p className="text-[10px] text-slate-355 leading-relaxed mt-1">
                সম্মানিত অভিভাবক/রোগী, এটি <strong>Bengal Rehabilitation Group (BRG)</strong> এর অফিশিয়াল ক্লিনিকাল স্পিচ অ্যাসেসমেন্ট রিপোর্ট ও হোম রিহ্যাবিলিটেশন থেরাপি প্ল্যান। আপনি উপরে অবস্থিত <strong>"Download PDF"</strong> বাটনে ক্লিক করে রিপোর্টটি ডাউনলোড করে রাখতে পারেন।
              </p>
            </div>
          </div>
        </div>

        {/* Canvas simulation container with auto-scaler for fluid responsive display */}
        <div 
          ref={containerRef} 
          className="bg-slate-850 rounded-2xl p-4 md:p-6 border border-slate-800 overflow-hidden relative flex justify-center w-full shadow-inner"
          style={{ height: previewHeight ? `${previewHeight + 24}px` : 'auto', minHeight: '500px' }}
        >
          <div
            style={{
              transform: `translateX(-50%) scale(${previewScale})`,
              transformOrigin: 'top center',
              width: '210mm',
              position: 'absolute',
              left: '50%',
              top: '24px',
            }}
          >
            <div 
              ref={printAreaRef}
              id="public-clinical-report-paper"
              className="bg-white text-slate-900 w-[210mm] min-h-[297mm] p-12 pr-14 pl-14 shadow-2xl relative text-xs flex flex-col justify-between rounded-md"
            >
              <div className="space-y-5">
                
                {/* Letterhead */}
                <div className="border-b-2 border-blue-600 pb-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded border border-slate-150 shadow-sm bg-white flex items-center justify-center p-0.5 text-slate-950 font-black">
                      BRG
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold tracking-tight text-slate-950 uppercase leading-none">BRG Speak HUB</h2>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">Bengal Rehabilitation Group • Clinical Speech Assessment</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-455 uppercase tracking-widest">Assessment Record</p>
                    <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">FORM NO: SLP-X781</span>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100/80">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Patient Name</span>
                    <span className="text-xs font-bold text-slate-900 capitalize mt-0.5 block">{reportPlan.patientName || '_________________'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Patient Phone</span>
                    <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">{reportPlan.patientPhone || '_________________'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Evaluation Date</span>
                    <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">{reportPlan.date || '_________________'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Age </span>
                    <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">
                      {reportPlan.age ? `${reportPlan.age}` : '_____'} / {reportPlan.gender || '_____'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Planned Review</span>
                    <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">{reportPlan.reviewDate || '_________________'}</span>
                  </div>
                </div>

                {/* provisional profile */}
                <div className="space-y-1 bg-blue-50/30 border-l-4 border-blue-600 p-2.5 rounded-r-md">
                  <h4 className="text-[9px] font-bold text-blue-900 uppercase tracking-wider">Provisional Diagnostic Impressions:</h4>
                  <p className="text-xs font-semibold text-slate-850 leading-relaxed">{reportPlan.provisionalDiagnosis || 'Diagnosis is pending active evaluation outcomes.'}</p>
                </div>

                {/* concerns */}
                <div className="space-y-0.5">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Presenting Concerns</h4>
                  <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                  <p className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-line">{reportPlan.presentConcerns || 'No concerns recorded.'}</p>
                </div>

                {/* assessment */}
                <div className="space-y-0.5">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Clinical Observations & Findings</h4>
                  <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                  <p className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-line">{reportPlan.assessmentFindings || 'Specific formal assessment observations are pending.'}</p>
                </div>

                {/* plan bullet points */}
                <div className="space-y-1.5">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Therapy Target Objectives Bullet Plan</h4>
                  <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                  
                  <ol className="space-y-1.5" id="pdf-goals-list">
                    {reportPlan.therapyPlan.filter(g => g.trim() !== '').length === 0 ? (
                      <li className="text-[11px] text-slate-400 italic">No objectives have been logged yet.</li>
                    ) : (
                      reportPlan.therapyPlan
                        .filter(g => g.trim() !== '')
                        .map((goal, i) => (
                          <li key={i} className="flex gap-2 items-start text-[11px] text-slate-800 leading-relaxed">
                            <span className="w-3.5 h-3.5 bg-blue-50 rounded text-blue-800 text-[9px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span>{goal}</span>
                          </li>
                        ))
                    )}
                  </ol>
                </div>

                {/* homework advice */}
                <div className="space-y-0.5">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Suggestions & Home Advice Program</h4>
                  <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                  <p className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-line">{reportPlan.adviceHomeProgram || 'Direct home drills and guidelines will follow.'}</p>
                </div>

                {/* recommendation */}
                <div className="space-y-0.5">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Clinician Recommendations path</h4>
                  <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                  <p className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-line">{reportPlan.recommendations || 'No further path defined at this phase.'}</p>
                </div>

              </div>

              {/* verification footer */}
              <div className="pt-4 border-t border-slate-200 mt-6 shrink-0">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Prescribed Frequency</span>
                    <span className="text-[10px] font-semibold text-slate-800 block bg-slate-100 py-0.5 px-2 rounded border border-slate-200 inline-block">
                      {reportPlan.frequencyOfTherapy || 'As scheduled'}
                    </span>
                  </div>

                  <div className="text-right space-y-1">
                    {reportPlan.therapistSignature ? (
                      <div className="inline-block border border-slate-100 rounded p-1 bg-white max-w-[100px] mb-1">
                        <img 
                          src={reportPlan.therapistSignature} 
                          alt="Clinician sign seal" 
                          className="max-h-10 max-w-full object-contain mx-auto" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="h-8 w-24 border-b border-dashed border-slate-200 mb-1 flex items-center justify-center">
                        <span className="text-[8px] text-slate-350">Signature Stamp</span>
                      </div>
                    )}

                    <span className="text-[11px] font-bold text-slate-900 block leading-none capitalize">
                      {reportPlan.therapistName || 'Active Speech Therapist'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-1">
                      Registered Speech Therapist
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
