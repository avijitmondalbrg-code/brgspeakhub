import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Search, Trash2, Edit3, Save, ArrowLeft, Download, 
  Printer, CheckCircle2, AlertCircle, Calendar, User, Activity, Sparkles, 
  LogIn, LogOut, Cloud, CloudOff, RefreshCw, FileSignature, Layers, 
  ChevronRight, HelpCircle, FileCheck, Check, Info, Menu, X, MessageSquare, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, googleProvider, signInWithPopup } from './firebase';
import { onAuthStateChanged, signOut, signInAnonymously, User as FirebaseUser } from 'firebase/auth';
import { TherapyPlan, WhatsAppSettings } from './types';
import { saveTherapyPlan, deleteTherapyPlan, getTherapyPlans, saveWhatsAppSettings, getWhatsAppSettings } from './firebaseService';
import SignaturePad from './components/SignaturePad';
import { CLINICAL_TEMPLATES } from './clinicalTemplates';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Initial state creator for a clean therapy plan
const createEmptyPlan = (userId: string = 'local-user'): Omit<TherapyPlan, 'createdAt' | 'updatedAt'> => ({
  id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  ownerId: userId,
  patientName: '',
  patientPhone: '',
  age: '',
  gender: '',
  date: new Date().toISOString().split('T')[0],
  provisionalDiagnosis: '',
  presentConcerns: '',
  assessmentFindings: '',
  therapyPlan: [''],
  adviceHomeProgram: '',
  recommendations: '',
  frequencyOfTherapy: '',
  reviewDate: '',
  therapistName: 'BRG',
  therapistSignature: ''
});

// Reusable high-fidelity vector logo representing Bengal Rehabilitation Group (BRG)
const BRGLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" id="svg-brg-logo">
    <rect width="100" height="100" rx="22" fill="url(#brg-grad-3)" />
    <path d="M28 50C28 37.8497 37.8497 28 50 28C62.1503 28 72 37.8497 72 50C72 62.1503 62.1503 72 50 72C37.8497 72 28 62.1503 28 50Z" fill="white" fillOpacity="0.08" />
    <rect x="36" y="44" width="6" height="12" rx="3" fill="#ffffff" />
    <rect x="45" y="32" width="6" height="36" rx="3" fill="#ffffff" />
    <rect x="54" y="24" width="6" height="52" rx="3" fill="#38bdf8" />
    <rect x="63" y="38" width="6" height="24" rx="3" fill="#e0f2fe" />
    <rect x="72" y="46" width="5" height="8" rx="2.5" fill="#e0f2fe" fillOpacity="0.7" />
    <path d="M22 58C28 68 45 74 58 71C71 68 78 55 78 50" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" fillOpacity="0.4" />
    <defs>
      <linearGradient id="brg-grad-3" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1e3a8a" />
        <stop offset="0.6" stopColor="#1d4ed8" />
        <stop offset="1" stopColor="#0284c7" />
      </linearGradient>
    </defs>
  </svg>
);

// Robust key-value fallback storage for contexts where localStorage is blocked (e.g., inside restricted iframes)
const inMemoryStorage: Record<string, string> = {};
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access restricted, falling back to in-memory store", e);
      return inMemoryStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage write restricted, falling back to in-memory store", e);
      inMemoryStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage removal restricted", e);
      delete inMemoryStorage[key];
    }
  }
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [plans, setPlans] = useState<TherapyPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Custom persistent brand logo state & file picker ref
  const [customLogo, setCustomLogo] = useState<string>(() => {
    return safeLocalStorage.getItem('vocalis_custom_logo') || '';
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setNotification({
          message: 'Logo size is too large. Please select an image under 2MB.',
          type: 'error'
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomLogo(base64);
        safeLocalStorage.setItem('vocalis_custom_logo', base64);
        setNotification({
          message: 'Your custom logo was uploaded and saved successfully!',
          type: 'success'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoReset = () => {
    setCustomLogo('');
    safeLocalStorage.removeItem('vocalis_custom_logo');
    setNotification({
      message: 'Logo reset to default BRG branding.',
      type: 'success'
    });
  };

  // Reusable component that displays either the custom uploaded logo or the high-fidelity SVG
  const AppLogo = ({ className = "w-10 h-10", allowUpload = false }: { className?: string; allowUpload?: boolean }) => {
    const triggerUpload = (e: React.MouseEvent) => {
      if (allowUpload) {
        e.stopPropagation();
        logoInputRef.current?.click();
      }
    };

    if (customLogo) {
      return (
        <div className={`relative group shrink-0 ${allowUpload ? 'cursor-pointer' : ''}`} onClick={triggerUpload}>
          <img
            src={customLogo}
            alt="Institution Logo"
            className={`${className} object-contain bg-white shrink-0`}
            referrerPolicy="no-referrer"
          />
          {allowUpload && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center rounded text-[8px] font-bold text-white uppercase text-center tracking-wider leading-none p-1">
              <span>Change</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`relative group shrink-0 ${allowUpload ? 'cursor-pointer' : ''}`} onClick={triggerUpload}>
        <BRGLogo className={className} />
        {allowUpload && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center rounded text-[10px] font-bold text-white uppercase text-center tracking-wider leading-none p-1">
            <span>Edit</span>
          </div>
        )}
      </div>
    );
  };
  
  // App views: 'dashboard' | 'form'
  const [view, setView] = useState<'dashboard' | 'form'>('dashboard');
  const [currentPlan, setCurrentPlan] = useState<Omit<TherapyPlan, 'createdAt' | 'updatedAt'> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // WhatsApp settings and modals
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<{success: boolean; message: string} | null>(null);
  const [registerPin, setRegisterPin] = useState('');
  const [registering, setRegistering] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<string | null>(null);
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings>({
    accessToken: safeLocalStorage.getItem('slp_wa_access_token') || 'EAAaIJ8yMa4sBRkR9hGWgaQPBZBxKqWbUzGOYcHDNc2eNTYee5KDUNlSMegxggjhqNYesll1ZBnxZBGkd8xPftzZAT68VIy8iibMMoD5zXkrJN1j0ZCXNH7QXxO7CZCqkr2QzayVKnki5lUu687dByehoeJIVn9rZCmfH493NKa6hvHBnVjKbhKrVnKhiPCAtaqgkwZDZD',
    phoneNumberId: safeLocalStorage.getItem('slp_wa_phone_number_id') || '1183533281504386',
    businessAccountId: safeLocalStorage.getItem('slp_wa_business_account_id') || '1323055779302168',
    templateName: safeLocalStorage.getItem('slp_wa_template_name') || 'hello_world',
    langCode: safeLocalStorage.getItem('slp_wa_lang_code') || 'en_US'
  });
  
  // Status notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [autoPrintOnLoad, setAutoPrintOnLoad] = useState(false);
  const [autoWhatsAppOnLoad, setAutoWhatsAppOnLoad] = useState(false);
  
  // Paper Print Element Ref for high fidelity PDF convert
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Scaler states for centering and responsive fit of the 210mm A4 preview on any laptop/mobile viewport
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view !== 'form') return;
    const updateDimensions = () => {
      if (containerRef.current && printAreaRef.current) {
        const parentWidth = containerRef.current.clientWidth;
        // The standard width of A4 in pixels is approx 794px.
        const paperWidth = printAreaRef.current.offsetWidth || 794; 
        const scale = Math.min(1, (parentWidth - 16) / paperWidth);
        const paperHeight = printAreaRef.current.offsetHeight || 1123;
        
        setPreviewScale(scale);
        setPreviewHeight(paperHeight * scale);
      }
    };

    // Delay briefly to allow rendering/fonts/widths to settle of A4 DOM
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
  }, [view, currentPlan]);

  // Authenticate monitor
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthLoading(false);
        const displayName = firebaseUser.isAnonymous ? "Guest Session" : (firebaseUser.email || "Practitioner");
        setNotification({
          message: `Logged in securely as ${displayName}`,
          type: 'success'
        });
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Auto anonymous sign-in failed:", error);
          setUser(null);
          setAuthLoading(false);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Fetch plans from server or fell back to Local Storage
  useEffect(() => {
    loadPlans();
  }, [user]);

  // Sync WhatsApp settings on user state update
  useEffect(() => {
    const localToken = safeLocalStorage.getItem('slp_wa_access_token');
    const localPhoneId = safeLocalStorage.getItem('slp_wa_phone_number_id');
    const localBusinessId = safeLocalStorage.getItem('slp_wa_business_account_id');
    
    const oldObsoleteToken = 'EAAaIJ8yMa4sBRvLwBZA9bYBwHzpRoRnJo56AmPh6Vs0LpghzrokMnvT89emZABTleLk0LRBJpmuG0EGYS8DXGZAk2XZACHEAawhZC3fJVyPZCZCo9Fkx52CPo0v0rzgeWY2jVQIOMgQEYawrXqpVqpua2RbA5xNwcnwdKXLXnayj3bgN4H5qAEn8ZAqONfBDUbwGu5PlDhHB1MCHg3PabOpZCxFgkFWFnipzZCLrNTHDPXuqgcloCtZAVxGNtr2pf3CPtag8Tt46ddcnKNXoMpqR767rp5JLZCdBbaFWZB0HEpQZDZD';
    const oldObsoleteToken2 = 'EAAaIJ8yMa4sBRkRZCZCnuoZCY9EYZAucpW7s3nmIAxBLcVKrKC7JG6F8hzZAyzfwe3UqxbItMihJpVXmOxNHoL9wnyFjkLJFvsxMoMuGLdC4mOXE9vnwQFxu6BtQZCSy4DGsZC4zHcbdQTJ4as64kG2VcDvGwwRpDaxX5BWLL9Mb2IDbj149CugOBHD1eepmA3vXEyJT2NQeGSmdKWEndjbFOPD6P2MnV1o1ThHVSwSspCmwpLB1dzJhzmgcF7oCYkkA2xqF0JFDCw42fNbc9eKqj6VXYfPkJmQ7gn8IAZDZD';
    const oldObsoleteToken3 = 'EAAaIJ8yMa4sBRkfvlykYZAp3iBHnpA5PVVNnsbSZCsTpqq354lcspIhjYYw5ppCYZB4NbfBVZApJEI5HCbRMI7PZCcslMzJOYiZAmOZCD9uJGqtplwZBmML1AyXZCewqJpk796UKjSz9KaRjrzXowZAgd3717jJ6LQBa4gPkgmHZCn57pxu93UiTrLvGiuW4fzP0EkP3gZDZD';
    const newActiveToken = 'EAAaIJ8yMa4sBRkR9hGWgaQPBZBxKqWbUzGOYcHDNc2eNTYee5KDUNlSMegxggjhqNYesll1ZBnxZBGkd8xPftzZAT68VIy8iibMMoD5zXkrJN1j0ZCXNH7QXxO7CZCqkr2QzayVKnki5lUu687dByehoeJIVn9rZCmfH493NKa6hvHBnVjKbhKrVnKhiPCAtaqgkwZDZD';
    
    const obseletePhoneId = '1193795173813206';
    const newPhoneId = '1183533281504386';
    
    const obseleteBusinessId = '995786956257682';
    const newBusinessId = '1323055779302168';
 
    let updated = false;
    let tokenToSet = localToken || newActiveToken;
    let phoneToSet = localPhoneId || newPhoneId;
    let businessToSet = localBusinessId || newBusinessId;
 
    if (!localToken || localToken === oldObsoleteToken || localToken === oldObsoleteToken2 || localToken === oldObsoleteToken3) {
      tokenToSet = newActiveToken;
      safeLocalStorage.setItem('slp_wa_access_token', newActiveToken);
      updated = true;
    }
    if (!localPhoneId || localPhoneId === obseletePhoneId) {
      phoneToSet = newPhoneId;
      safeLocalStorage.setItem('slp_wa_phone_number_id', newPhoneId);
      updated = true;
    }
    if (!localBusinessId || localBusinessId === obseleteBusinessId) {
      businessToSet = newBusinessId;
      safeLocalStorage.setItem('slp_wa_business_account_id', newBusinessId);
      updated = true;
    }
 
    if (updated) {
      setWhatsappSettings(prev => ({
        ...prev,
        accessToken: tokenToSet,
        phoneNumberId: phoneToSet,
        businessAccountId: businessToSet
      }));
    }
  }, []);

  // Sync WhatsApp settings on user state update
  useEffect(() => {
    const fetchWhatsAppSettings = async () => {
      if (user) {
        try {
          const cloudSettings = await getWhatsAppSettings(user.uid);
          if (cloudSettings) {
            const merged = {
              accessToken: cloudSettings.accessToken || 'EAAaIJ8yMa4sBRkR9hGWgaQPBZBxKqWbUzGOYcHDNc2eNTYee5KDUNlSMegxggjhqNYesll1ZBnxZBGkd8xPftzZAT68VIy8iibMMoD5zXkrJN1j0ZCXNH7QXxO7CZCqkr2QzayVKnki5lUu687dByehoeJIVn9rZCmfH493NKa6hvHBnVjKbhKrVnKhiPCAtaqgkwZDZD',
              phoneNumberId: cloudSettings.phoneNumberId || '1183533281504386',
              businessAccountId: cloudSettings.businessAccountId || '1323055779302168',
              templateName: cloudSettings.templateName || 'hello_world',
              langCode: cloudSettings.langCode || 'en_US'
            };
            setWhatsappSettings(merged);
            safeLocalStorage.setItem('slp_wa_access_token', merged.accessToken);
            safeLocalStorage.setItem('slp_wa_phone_number_id', merged.phoneNumberId);
            safeLocalStorage.setItem('slp_wa_business_account_id', merged.businessAccountId);
            safeLocalStorage.setItem('slp_wa_template_name', merged.templateName);
            safeLocalStorage.setItem('slp_wa_lang_code', merged.langCode);
          }
        } catch (err) {
          console.error("Could not load WhatsApp configurations from Firestore:", err);
        }
      }
    };
    fetchWhatsAppSettings();
  }, [user]);

  const handleSaveWhatsAppSettings = async (settings: WhatsAppSettings) => {
    setWhatsappSettings(settings);
    safeLocalStorage.setItem('slp_wa_access_token', settings.accessToken);
    safeLocalStorage.setItem('slp_wa_phone_number_id', settings.phoneNumberId);
    safeLocalStorage.setItem('slp_wa_business_account_id', settings.businessAccountId);
    safeLocalStorage.setItem('slp_wa_template_name', settings.templateName || 'hello_world');
    safeLocalStorage.setItem('slp_wa_lang_code', settings.langCode || 'en_US');

    if (user) {
      try {
        await saveWhatsAppSettings(user.uid, settings);
        setNotification({
          message: 'WhatsApp automated parameters saved & synced with your online account!',
          type: 'success'
        });
      } catch (err) {
        setNotification({
          message: 'Saved changes locally, online cloud synchronization failed.',
          type: 'info'
        });
      }
    } else {
      setNotification({
        message: 'WhatsApp parameters saved locally on this browser!',
        type: 'success'
      });
    }
    setShowWhatsAppModal(false);
  };

  const testWhatsAppConnection = async (tempToken?: string, tempPhoneId?: string) => {
    setDiagnosing(true);
    setDiagResult(null);
    const token = (tempToken || whatsappSettings.accessToken).trim();
    const phoneId = (tempPhoneId || whatsappSettings.phoneNumberId).trim();

    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      if (res.ok) {
        setDiagResult({
          success: true,
          message: `✅ Connection Successful / কানেকশন সফল হয়েছে!\n• Phone Number: ${data.display_phone_number || 'Registered'}\n• Verified Name: ${data.verified_name || 'N/A'}\n• Status: ${data.status || 'Verified & Ready'}`
        });
      } else {
        const errCode = data.error?.code;
        const errMsg = data.error?.message || '';
        
        let customHelp = '';
        if (errCode === 133010 || errMsg.toLowerCase().includes('not registered')) {
          customHelp = `\n\n🔍 সমাধান (Solution): আপনার এই নাম্বার আইডিটি (${phoneId}) হোয়াটসঅ্যাপে রেজিস্টার করা হয়নি। নিচে আপনার ২-স্টেপ ভেরিফিকেশন পিন (Two-step PIN) দিয়ে 'Register Number with Meta' বাটনে ক্লিক করে রেজিস্ট্রেশনটি সম্পন্ন করুন।`;
        } else if (errCode === 190) {
          customHelp = `\n\n🔍 সমাধান (Solution): আপনার টোকেনটি সঠিক নয় অথবা এটির মেয়াদ ফুরিয়ে গেছে। দয়া করে developers.facebook.com থেকে সঠিক সচল টোকেনটি কপি করে এডিট করুন।`;
        }

        setDiagResult({
          success: false,
          message: `❌ Error: ${errMsg} (Code: ${errCode})${customHelp}`
        });
      }
    } catch (err: any) {
      setDiagResult({
        success: false,
        message: `❌ Connection Failed / কানেকশন ব্যর্থ হয়েছে: ${err.message}`
      });
    } finally {
      setDiagnosing(false);
    }
  };

  const registerWhatsAppNumber = async (pin6: string, tempToken?: string, tempPhoneId?: string) => {
    if (!pin6 || pin6.length !== 6) {
      setNotification({
        message: 'Two-step verification PIN is required and must be exactly 6 digits! / ৬ সংখ্যার পিন দিন।',
        type: 'error'
      });
      return;
    }

    setRegistering(true);
    const token = (tempToken || whatsappSettings.accessToken).trim();
    const phoneId = (tempPhoneId || whatsappSettings.phoneNumberId).trim();

    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          pin: pin6
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          message: '🎉 WhatsApp Phone Number successfully registered with Meta Cloud API!',
          type: 'success'
        });
        setDiagResult({
          success: true,
          message: '✅ Phone Number Successfully Registered / নাম্বার সফলভাবে হোয়াটসঅ্যাপ মেটা ক্লাউডে রেজিস্টার হয়েছে! এখন থেকে সরাসরি রোগীদের যেকোনো রিপোর্টে মেসেজ পাঠাতে পারবেন।'
        });
      } else {
        const errMsg = data.error?.message || 'Unknown registration error';
        const errCode = data.error?.code;
        setDiagResult({
          success: false,
          message: `❌ Registration Failed / রেজিস্ট্রেশন ব্যর্থ হয়েছে: ${errMsg} (Code: ${errCode || 'N/A'})\n\n💡 সমাধান: আপনার মেটা পোর্টাল (developers.facebook.com) এ গিয়ে নিশ্চিত হোন যে আপনার নম্বর আইডি ও টোকেনের পারমিশন ঠিক আছে এবং টু-স্টেপ ভেরিফিকেশন পিনটি সঠিক।`
        });
      }
    } catch (err: any) {
      setDiagResult({
        success: false,
        message: `❌ Connection Error / কানেকশন ব্যর্থ: ${err.message}`
      });
    } finally {
      setRegistering(false);
    }
  };

  const loadPlans = async () => {
    setLoadingPlans(true);
    if (user) {
      try {
        const cloudPlans = await getTherapyPlans(user.uid);
        setPlans(cloudPlans);
      } catch (err) {
        console.error("Cloud fetching failed, falling back to local files", err);
        loadLocalPlans();
      }
    } else {
      loadLocalPlans();
    }
    setLoadingPlans(false);
  };

  const loadLocalPlans = () => {
    const localData = safeLocalStorage.getItem('vocalis_local_plans');
    if (localData) {
      try {
        setPlans(JSON.parse(localData));
      } catch (e) {
        setPlans([]);
      }
    } else {
      setPlans([]);
    }
  };

  const saveLocalPlans = (updatedPlans: any[]) => {
    safeLocalStorage.setItem('vocalis_local_plans', JSON.stringify(updatedPlans));
    setPlans(updatedPlans);
  };

  // Triggers alert auto-timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auto print from history trigger
  useEffect(() => {
    if (view === 'form' && autoPrintOnLoad) {
      const timer = setTimeout(() => {
        printReport();
        setAutoPrintOnLoad(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [view, autoPrintOnLoad]);

  // Auto WhatsApp background dispatcher from history trigger
  useEffect(() => {
    if (view === 'form' && autoWhatsAppOnLoad && currentPlan) {
      const timer = setTimeout(() => {
        sendPDFToWhatsApp(currentPlan as TherapyPlan);
        setAutoWhatsAppOnLoad(false);
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [view, autoWhatsAppOnLoad, currentPlan]);

  // Auth logins
  const handleLogIn = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setNotification({
        message: `Sign in error: ${error.message || 'Verification cancelled'}`,
        type: 'error'
      });
      setAuthLoading(false);
    }
  };

  const handleLogActiveOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setNotification({
        message: "Signed out securely. Switched to local offline mode.",
        type: 'info'
      });
    } catch (error: any) {
      setNotification({
        message: "Sign out failed.",
        type: 'error'
      });
    }
  };

  // Add & edit plans
  const triggerCreateNew = () => {
    const newPlan = createEmptyPlan(user?.uid || 'local-user');
    setSelectedTemplate('');
    setCurrentPlan(newPlan);
    setIsEditing(false);
    setView('form');
  };

  const triggerEdit = (plan: TherapyPlan) => {
    setCurrentPlan({ ...plan });
    setIsEditing(true);
    setView('form');
  };

  const triggerPrintFromHistory = (plan: TherapyPlan) => {
    setCurrentPlan({ ...plan });
    setIsEditing(false);
    setView('form');
    setAutoPrintOnLoad(true);
  };

  // Sync / save plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlan) return;

    if (!currentPlan.patientName.trim()) {
      setNotification({
        message: 'Patient Name is a mandatory field.',
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      if (user) {
        // Secure Cloud Sync
        await saveTherapyPlan(currentPlan, !isEditing);
        await loadPlans();
      } else {
        // Local Sync
        const updatedPlans = [...plans];
        if (isEditing) {
          const index = updatedPlans.findIndex(p => p.id === currentPlan.id);
          if (index !== -1) {
            updatedPlans[index] = {
              ...currentPlan,
              updatedAt: new Date().toISOString()
            } as TherapyPlan;
          }
        } else {
          updatedPlans.unshift({
            ...currentPlan,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as TherapyPlan);
        }
        saveLocalPlans(updatedPlans);
      }

      setNotification({
        message: user 
          ? 'Clinical report synchronized safely to your secure Google Cloud database.'
          : 'Clinical report saved locally. Sign in to push to the Cloud.',
        type: 'success'
      });
      setView('dashboard');
      setCurrentPlan(null);
    } catch (err: any) {
      setNotification({
        message: `Failed to secure plan: ${err.message || 'Database error'}`,
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete plan
  const handleDeletePlan = async (id: string) => {
    try {
      if (user) {
        await deleteTherapyPlan(id);
        await loadPlans();
      } else {
        const updatedPlans = plans.filter(p => p.id !== id);
        saveLocalPlans(updatedPlans);
      }
      setNotification({
        message: 'Clinical report deleted successfully.',
        type: 'success'
      });
      setShowDeleteConfirm(null);
    } catch (err: any) {
      setNotification({
        message: `Deletion failed: ${err.message}`,
        type: 'error'
      });
    }
  };

  // Generate template autofill
  const handleSelectTemplate = (templateName: string) => {
    setSelectedTemplate(templateName);
    if (!currentPlan || !templateName) return;

    const template = CLINICAL_TEMPLATES[templateName];
    if (template) {
      setCurrentPlan(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          provisionalDiagnosis: template.diagnosis,
          presentConcerns: template.concerns,
          assessmentFindings: template.findings,
          therapyPlan: [...template.goals],
          adviceHomeProgram: template.homeProgram,
          recommendations: template.recommendations,
          frequencyOfTherapy: template.frequency
        };
      });
      setNotification({
        message: `Template loaded successfully: ${templateName}`,
        type: 'success'
      });
    }
  };

  // Form helpers
  const handleFormChange = (field: keyof Omit<TherapyPlan, 'createdAt' | 'updatedAt' | 'therapyPlan'>, value: string) => {
    if (!currentPlan) return;
    setCurrentPlan({
      ...currentPlan,
      [field]: value
    });
  };

  const handleGoalChange = (index: number, value: string) => {
    if (!currentPlan) return;
    const updatedGoals = [...currentPlan.therapyPlan];
    updatedGoals[index] = value;
    setCurrentPlan({
      ...currentPlan,
      therapyPlan: updatedGoals
    });
  };

  const addGoalField = () => {
    if (!currentPlan) return;
    setCurrentPlan({
      ...currentPlan,
      therapyPlan: [...currentPlan.therapyPlan, '']
    });
  };

  const removeGoalField = (index: number) => {
    if (!currentPlan) return;
    // Keep at least one empty target input
    const updatedGoals = currentPlan.therapyPlan.filter((_, i) => i !== index);
    setCurrentPlan({
      ...currentPlan,
      therapyPlan: updatedGoals.length > 0 ? updatedGoals : ['']
    });
  };

  // WhatsApp automatic sender and delivery pipeline
  const sendPDFToWhatsApp = async (plan: TherapyPlan) => {
    setIsSendingWhatsApp(plan.id);
    let isRestored = false;
    setNotification({
      message: `Formulating clinical report PDF for patient "${plan.patientName}"...`,
      type: 'info'
    });

    // Helper to translate OKLCH and OKLAB color formats back to safe equivalents (HSL/RGB)
    const approximateOklchToHsl = (cssText: string): string => {
      if (!cssText) return cssText;
      
      // Replace oklch() with equivalent hsl()
      let result = cssText.replace(
        /oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+%?|\w+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g,
        (_, lStr, cStr, hStr, aStr) => {
          try {
            let l = parseFloat(lStr);
            if (lStr.includes('%')) l = l / 100;
            let c = parseFloat(cStr);
            if (cStr.includes('%')) c = c / 100;
            let h = parseFloat(hStr);
            if (isNaN(h)) h = 0;
            
            // Saturation proxy: C * 250% (capped at 100%)
            const s = Math.min(100, Math.max(0, c * 250));
            const lPct = Math.min(100, Math.max(0, l * 100));
            
            if (aStr !== undefined) {
              return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${lPct.toFixed(1)}%, ${aStr})`;
            } else {
              return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${lPct.toFixed(1)}%)`;
            }
          } catch {
            return '#888888';
          }
        }
      );

      // Replace oklab() with equivalent rgb() 
      result = result.replace(
        /oklab\(\s*([0-9.]+%?)\s+([0-9.-]+%?)\s+([0-9.-]+%?)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g,
        (_, lStr, __, ___, alphaStr) => {
          try {
            let l = parseFloat(lStr);
            if (lStr.includes('%')) l = l / 100;
            const grayVal = Math.round(l * 255);
            if (alphaStr !== undefined) {
              return `rgba(${grayVal}, ${grayVal}, ${grayVal}, ${alphaStr})`;
            } else {
              return `rgb(${grayVal}, ${grayVal}, ${grayVal})`;
            }
          } catch {
            return '#888888';
          }
        }
      );

      return result;
    };

    // 1. BACKUP & CLEAN ELEMENT STYLE TEXT IN DOM STYLETAGS
    const styleElements = Array.from(document.querySelectorAll('style'));
    const styleBackups: Array<{ element: HTMLStyleElement; originalText: string }> = [];
    
    try {
      for (const styleElt of styleElements) {
        const text = styleElt.textContent || '';
        if (text.includes('oklch') || text.includes('oklab')) {
          styleBackups.push({ element: styleElt, originalText: text });
          styleElt.textContent = approximateOklchToHsl(text);
        }
      }
    } catch (err) {
      console.warn('Could not rewrite some custom styles text:', err);
    }

    // 2. STYLESHEET CSSOM SUB-RULES CLEANING WORKAROUND
    const stylesBackup: Array<{
      sheet: CSSStyleSheet;
      rules: Array<{ index: number; cssText: string }>;
    }> = [];

    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const sheet = document.styleSheets[i];
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;
          
          const ruleBackup: Array<{ index: number; cssText: string }> = [];
          for (let j = rules.length - 1; j >= 0; j--) {
            const rule = rules[j];
            if (rule && rule.cssText && (rule.cssText.includes('oklch') || rule.cssText.includes('oklab'))) {
              ruleBackup.push({ index: j, cssText: rule.cssText });
              sheet.deleteRule(j);
            }
          }
          
          if (ruleBackup.length > 0) {
            ruleBackup.sort((a, b) => a.index - b.index);
            stylesBackup.push({ sheet, rules: ruleBackup });
          }
        } catch (e) {
          // Ignore cross-origin access errors
          console.warn('Could not process some stylesheet rules:', e);
        }
      }
    } catch (globalE) {
      console.error('Error pre-filtering style rules:', globalE);
    }

    // 3. SECURE BROWSER COMPUTED STYLES INTERCEPTOR
    const originalGetComputedStyle = window.getComputedStyle;
    try {
      (window as any).getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
        const style = originalGetComputedStyle.call(window, elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            // Avoid passing the receiver (Proxy) which causes "Illegal invocation" for native getters
            const val = Reflect.get(target, prop);
            if (typeof val === 'function') {
              return function(this: any, ...args: any[]) {
                const res = val.apply(target, args);
                if (typeof res === 'string' && (res.includes('oklch') || res.includes('oklab'))) {
                  return approximateOklchToHsl(res);
                }
                return res;
              };
            }
            if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
              return approximateOklchToHsl(val);
            }
            return val;
          }
        });
      };
    } catch (proxyError) {
      console.error('Could not set up window.getComputedStyle interceptor proxy:', proxyError);
    }

    const restoreStyles = () => {
      if (isRestored) return;
      isRestored = true;
      try {
        (window as any).getComputedStyle = originalGetComputedStyle;
      } catch (e) {
        console.error('Could not restore getComputedStyle:', e);
      }

      for (const backup of styleBackups) {
        try {
          backup.element.textContent = backup.originalText;
        } catch (e) {
          console.warn('Could not restore style tag content:', e);
        }
      }

      for (const backup of stylesBackup) {
        const { sheet, rules } = backup;
        for (const rule of rules) {
          try {
            sheet.insertRule(rule.cssText, rule.index);
          } catch (restoreError) {
            try {
              sheet.insertRule(rule.cssText, sheet.cssRules.length);
            } catch (fallbackError) {
              console.warn('Failed to restore custom rule:', rule.cssText, fallbackError);
            }
          }
        }
      }
    };

    try {
      const element = document.getElementById('clinical-report-paper');
      if (!element) {
        throw new Error('Clinical report printable viewport not found in active screen.');
      }

      // Pre-load and decode images for clean presentation in rendering canvas
      const documentImages = Array.from(element.querySelectorAll('img'));
      await Promise.all(
        documentImages.map((img) => {
          if (img.complete) {
            return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            img.onload = () => {
              if (img.decode) {
                img.decode().then(resolve).catch(() => resolve());
              } else {
                resolve();
              }
            };
            img.onerror = () => resolve();
          });
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 350));

      const opt = {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      };

      const canvas = await html2canvas(element, opt);
      restoreStyles();
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const pdfBlob = pdf.output('blob');
      const fileName = `SLP_Report_${plan.patientName.replace(/\s+/g, '_') || 'Patient'}_${plan.date}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      setNotification({
        message: 'Uploading document secure payload to Meta WhatsApp Cloud API server...',
        type: 'info'
      });

      const mediaFormData = new FormData();
      mediaFormData.append('messaging_product', 'whatsapp');
      mediaFormData.append('file', pdfFile);
      mediaFormData.append('type', 'application/pdf');

      const uploadRes = await fetch(`https://graph.facebook.com/v20.0/${whatsappSettings.phoneNumberId}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappSettings.accessToken}`
        },
        body: mediaFormData
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        const errorMsg = errorData.error?.message || '';
        const errorCode = errorData.error?.code;

        if (errorMsg.toLowerCase().includes('authentication') || errorCode === 190) {
          throw new Error(`Authentication Error / অথেন্টিকেশন ত্রুটি:
👉 Solution / সমাধান:
আপনার Meta Access Token এবং Phone Number ID একে অপরের সাথে মেলেনি অথবা টোকেনের মেয়াদ শেষ হয়ে গেছে।
1. 'Sync WhatsApp' প্যানেলে গিয়ে আপনার Phone Number ID এবং Business Account ID টি চেক করুন। ওগুলো কি developers.facebook.com-এর সাথে ম্যাচ করছে?
2. আপনার Access Token টি কি Temporary (যা ২৪ ঘন্টা পর এক্সপায়ার হয়ে যায়)? নতুন টোকেন জেনারেট করে 'Sync WhatsApp' এ আপডেট করুন।`);
        }
        throw new Error(errorMsg || 'Meta API Media Upload did not respond successfully.');
      }

      const uploadData = await uploadRes.json();
      const mediaId = uploadData.id;

      if (!mediaId) {
        throw new Error('No media ID retrieved from Facebook Graph Servers.');
      }

      setNotification({
        message: 'Report uploaded. Delivering automated direct WhatsApp to patient...',
        type: 'info'
      });

      let sanitizedPhone = plan.patientPhone ? plan.patientPhone.replace(/\D/g, '') : '';
      if (sanitizedPhone) {
        // Handle common Bangladesh format: e.g., 01712345678 (11 digits starting with 01)
        if (sanitizedPhone.length === 11 && sanitizedPhone.startsWith('01')) {
          sanitizedPhone = '88' + sanitizedPhone;
        } 
        // Handle common Indian format: 10 digits starting with 6, 7, 8, or 9
        else if (sanitizedPhone.length === 10 && /^[6789]/.test(sanitizedPhone)) {
          sanitizedPhone = '91' + sanitizedPhone;
        }
      }
      if (!sanitizedPhone) {
        throw new Error('Valid patient phone number is missing.');
      }

      const messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: sanitizedPhone,
        type: "document",
        document: {
          id: mediaId,
          filename: fileName,
          caption: `Hello, here is your Speech-Language Pathology Clinical Report formulated on ${plan.date}.`
        }
      };

      const sendRes = await fetch(`https://graph.facebook.com/v20.0/${whatsappSettings.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappSettings.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });

      if (!sendRes.ok) {
        const sendError = await sendRes.json();
        const code = sendError.error?.code;
        const msg = sendError.error?.message || '';
        
        if (msg.toLowerCase().includes('authentication') || code === 190) {
          throw new Error(`Authentication Error / অথেন্টিকেশন ত্রুটি:
👉 Solution / সমাধান:
আপনার Meta Access Token এবং Phone Number ID একে অপরের সাথে মেলেনি অথবা টোকেনের মেয়াদ শেষ হয়ে গেছে।
1. 'Sync WhatsApp' প্যানেলে গিয়ে আপনার Phone Number ID এবং Business Account ID টি চেক করুন। ওগুলো কি developers.facebook.com-এর সাথে ম্যাচ করছে?
2. আপনার Access Token টি কি Temporary (যা ২৪ ঘন্টা পর এক্সপায়ার হয়ে যায়)? নতুন টোকেন জেনারেট করে 'Sync WhatsApp' এ আপডেট করুন।`);
        }
        
        if (msg.toLowerCase().includes('allowed list')) {
          throw new Error(`Recipient Phone Number not in authorized list (Meta Sandbox limit).
👉 Solution / সমাধান:
1. Go to developers.facebook.com and select your App.
2. From left sidebar, go to: WhatsApp -> API Setup.
3. Look at the "To" selection box, click "Manage phone number list".
4. Add and verify your patient's/receiver's phone number with an OTP.

(আপনার ফেসবুক ডেভেলপার অ্যাকাউন্টে এই ফোন নম্বরটি 'Allowed numbers' লিস্টে যোগ করা নেই। developers.facebook.com এ যান -> WhatsApp -> API Setup এ গিয়ে recipient phone number টি ভেরিফাই করে দিন।)`);
        }

        if (code === 133010 || msg.toLowerCase().includes('account not registered')) {
          throw new Error(`(#133010) Account not registered / হোয়াটসঅ্যাপ নাম্বার রেজিস্টার করা নাই।
👉 Solution / সমাধান:
আপনার মেটা বিজনেস ফোন নাম্বার আইডিটি (${whatsappSettings.phoneNumberId}) হোয়াটসঅ্যাপ ক্লাউড এপিআই সিস্টেমে রেজিস্টার করা হয়নি।

১. আপনার এই অ্যাপের 'Sync WhatsApp' প্যানেলে যান এবং নিচে 'Diagnostic Panel' এ আপনার ৬ সংখ্যার গোপন টু-স্টেপ ভেরিফিকেশন পিন (PIN) দিয়ে 'Register Number with Meta' বাটনে ক্লিক করুন।
২. অথবা, developers.facebook.com এ গিয়ে WhatsApp → API Setup এ গিয়ে আপনার ফোন নাম্বারের পাশে রেজিস্ট্রেশন বা ভেরিফিকেশন সম্পন্ন করুন।`);
        }

        // Active window error fallback
        if (code === 131030 || msg.toLowerCase().includes('window')) {
          setNotification({
            message: 'Active conversation window not open. Dispatching standard approved template notification...',
            type: 'info'
          });

          const templatePayload = {
            messaging_product: "whatsapp",
            to: sanitizedPhone,
            type: "template",
            template: {
              name: whatsappSettings.templateName || "hello_world",
              language: {
                code: whatsappSettings.langCode || "en_US"
              }
            }
          };

          const fallbackRes = await fetch(`https://graph.facebook.com/v20.0/${whatsappSettings.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappSettings.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(templatePayload)
          });

          if (!fallbackRes.ok) {
            const fallbackErrorData = await fallbackRes.json();
            const fallbackMsg = fallbackErrorData.error?.message || '';
            if (fallbackMsg.toLowerCase().includes('allowed list')) {
              throw new Error(`Recipient Phone Number not in authorized list (Meta Sandbox limit).
👉 Solution / সমাধান:
1. Go to developers.facebook.com and select your App.
2. From left sidebar, go to: WhatsApp -> API Setup.
3. Look at the "To" selection box, click "Manage phone number list".
4. Add and verify your patient's/receiver's phone number with an OTP.

(আপনার ফেসবুক ডেভেলপার অ্যাকাউন্টে এই ফোন নম্বরটি 'Allowed numbers' লিস্টে যোগ করা নেই। developers.facebook.com এ যান -> WhatsApp -> API Setup এ গিয়ে recipient phone number টি ভেরিফাই করে দিন।)`);
            }
            throw new Error(`Failed to send WhatsApp warning alert. Meta API replied: ${fallbackMsg}`);
          }

          setNotification({
            message: `Template notification dispatched to "${plan.patientName}" on WhatsApp perfectly! (Could not attach document as no active 24-hour chat window exists yet)`,
            type: 'success'
          });
        } else {
          throw new Error(msg || 'Meta Messages endpoint returned an error.');
        }
      } else {
        setNotification({
          message: `Direct PDF report successfully delivered to "${plan.patientName}" on WhatsApp, completely in the background!`,
          type: 'success'
        });
      }

    } catch (err: any) {
      console.error(err);
      setNotification({
        message: `WhatsApp dispatcher failed: ${err.message || 'Meta API error'}`,
        type: 'error'
      });
    } finally {
      restoreStyles();
      setIsSendingWhatsApp(null);
    }
  };

  const triggerWhatsAppFromHistory = (plan: TherapyPlan) => {
    if (!whatsappSettings.accessToken) {
      setCurrentPlan({ ...plan });
      setShowWhatsAppModal(true);
      setNotification({
        message: 'Please click the WhatsApp configurations first to key in your credentials!',
        type: 'info'
      });
      return;
    }

    if (!plan.patientPhone || !plan.patientPhone.trim()) {
      setNotification({
        message: `Patient "${plan.patientName}" has no designated phone number. Add it by editing the record.`,
        type: 'error'
      });
      return;
    }

    setCurrentPlan({ ...plan });
    setIsEditing(false);
    setView('form');
    setAutoWhatsAppOnLoad(true);
  };

  const triggerWhatsAppDirect = async () => {
    if (!currentPlan) return;
    if (!whatsappSettings.accessToken) {
      setShowWhatsAppModal(true);
      setNotification({
        message: 'Please click the WhatsApp configurations first to key in your credentials!',
        type: 'info'
      });
      return;
    }

    if (!currentPlan.patientPhone || !currentPlan.patientPhone.trim()) {
      setNotification({
        message: 'Please add a patient phone number in the form first!',
        type: 'error'
      });
      return;
    }

    await sendPDFToWhatsApp(currentPlan as TherapyPlan);
  };

  // Export PDF Generator
  const downloadReportAsPDF = async () => {
    if (!currentPlan) return;
    setIsExporting(true);
    let isRestored = false;
    setNotification({
      message: 'Generating professional vector clinical report...',
      type: 'info'
    });

    // Helper to translate OKLCH and OKLAB color formats back to safe equivalents (HSL/RGB)
    const approximateOklchToHsl = (cssText: string): string => {
      if (!cssText) return cssText;
      
      // Replace oklch() with equivalent hsl()
      let result = cssText.replace(
        /oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+%?|\w+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g,
        (_, lStr, cStr, hStr, aStr) => {
          try {
            let l = parseFloat(lStr);
            if (lStr.includes('%')) l = l / 100;
            let c = parseFloat(cStr);
            if (cStr.includes('%')) c = c / 100;
            let h = parseFloat(hStr);
            if (isNaN(h)) h = 0;
            
            // Saturation proxy: C * 250% (capped at 100%)
            const s = Math.min(100, Math.max(0, c * 250));
            const lPct = Math.min(100, Math.max(0, l * 100));
            
            if (aStr !== undefined) {
              return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${lPct.toFixed(1)}%, ${aStr})`;
            } else {
              return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${lPct.toFixed(1)}%)`;
            }
          } catch {
            return '#888888';
          }
        }
      );

      // Replace oklab() with equivalent rgb() 
      result = result.replace(
        /oklab\(\s*([0-9.]+%?)\s+([0-9.-]+%?)\s+([0-9.-]+%?)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g,
        (_, lStr, __, ___, alphaStr) => {
          try {
            let l = parseFloat(lStr);
            if (lStr.includes('%')) l = l / 100;
            const grayVal = Math.round(l * 255);
            if (alphaStr !== undefined) {
              return `rgba(${grayVal}, ${grayVal}, ${grayVal}, ${alphaStr})`;
            } else {
              return `rgb(${grayVal}, ${grayVal}, ${grayVal})`;
            }
          } catch {
            return '#888888';
          }
        }
      );

      return result;
    };

    // 1. BACKUP & CLEAN ELEMENT STYLE TEXT IN DOM STYLETAGS
    const styleElements = Array.from(document.querySelectorAll('style'));
    const styleBackups: Array<{ element: HTMLStyleElement; originalText: string }> = [];
    
    try {
      for (const styleElt of styleElements) {
        const text = styleElt.textContent || '';
        if (text.includes('oklch') || text.includes('oklab')) {
          styleBackups.push({ element: styleElt, originalText: text });
          styleElt.textContent = approximateOklchToHsl(text);
        }
      }
    } catch (err) {
      console.warn('Could not rewrite some custom styles text:', err);
    }

    // 2. STYLESHEET CSSOM SUB-RULES CLEANING WORKAROUND
    const stylesBackup: Array<{
      sheet: CSSStyleSheet;
      rules: Array<{ index: number; cssText: string }>;
    }> = [];

    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const sheet = document.styleSheets[i];
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;
          
          const ruleBackup: Array<{ index: number; cssText: string }> = [];
          for (let j = rules.length - 1; j >= 0; j--) {
            const rule = rules[j];
            if (rule && rule.cssText && (rule.cssText.includes('oklch') || rule.cssText.includes('oklab'))) {
              ruleBackup.push({ index: j, cssText: rule.cssText });
              sheet.deleteRule(j);
            }
          }
          
          if (ruleBackup.length > 0) {
            ruleBackup.sort((a, b) => a.index - b.index);
            stylesBackup.push({ sheet, rules: ruleBackup });
          }
        } catch (e) {
          // Ignore cross-origin access errors
          console.warn('Could not process some stylesheet rules:', e);
        }
      }
    } catch (globalE) {
      console.error('Error pre-filtering style rules:', globalE);
    }

    // 3. SECURE BROWSER COMPUTED STYLES INTERCEPTOR
    const originalGetComputedStyle = window.getComputedStyle;
    try {
      (window as any).getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
        const style = originalGetComputedStyle.call(window, elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            // Avoid passing the receiver (Proxy) which causes "Illegal invocation" for native getters
            const val = Reflect.get(target, prop);
            if (typeof val === 'function') {
              return function(this: any, ...args: any[]) {
                const res = val.apply(target, args);
                if (typeof res === 'string' && (res.includes('oklch') || res.includes('oklab'))) {
                  return approximateOklchToHsl(res);
                }
                return res;
              };
            }
            if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
              return approximateOklchToHsl(val);
            }
            return val;
          }
        });
      };
    } catch (proxyError) {
      console.error('Could not set up window.getComputedStyle interceptor proxy:', proxyError);
    }

    const restoreStyles = () => {
      if (isRestored) return;
      isRestored = true;
      try {
        (window as any).getComputedStyle = originalGetComputedStyle;
      } catch (e) {
        console.error('Could not restore getComputedStyle:', e);
      }

      for (const backup of styleBackups) {
        try {
          backup.element.textContent = backup.originalText;
        } catch (e) {
          console.warn('Could not restore style tag content:', e);
        }
      }

      for (const backup of stylesBackup) {
        const { sheet, rules } = backup;
        for (const rule of rules) {
          try {
            sheet.insertRule(rule.cssText, rule.index);
          } catch (restoreError) {
            try {
              sheet.insertRule(rule.cssText, sheet.cssRules.length);
            } catch (fallbackError) {
              console.warn('Failed to restore custom rule:', rule.cssText, fallbackError);
            }
          }
        }
      }
    };

    try {
      const element = document.getElementById('clinical-report-paper');
      if (!element) {
        throw new Error('Preview element not found.');
      }

      // Pre-load and decode all images in the document to ensure they are printed in html2canvas
      const documentImages = Array.from(element.querySelectorAll('img'));
      await Promise.all(
        documentImages.map((img) => {
          if (img.complete) {
            return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            img.onload = () => {
              if (img.decode) {
                img.decode().then(resolve).catch(() => resolve());
              } else {
                resolve();
              }
            };
            img.onerror = () => resolve();
          });
        })
      );

      // Brief delay to allow browser paint engine to settle image buffers
      await new Promise((resolve) => setTimeout(resolve, 350));

      const opt = {
        scale: 2, // Retinal high resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      };

      const canvas = await html2canvas(element, opt);
      restoreStyles();
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 standard width (mm)
      const pageHeight = 297; // A4 standard height (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `SLP_Report_${currentPlan.patientName.replace(/\s+/g, '_') || 'Patient'}_${currentPlan.date}.pdf`;
      pdf.save(fileName);
      
      setNotification({
        message: 'Clinical A4 Report exported in PDF format successfully!',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      setNotification({
        message: `Failed to construct PDF: ${err.message || 'Render block issue'}`,
        type: 'error'
      });
    } finally {
      restoreStyles();
      setIsExporting(false);
    }
  };

  // High fidelity browser print integration
  const printReport = () => {
    const element = document.getElementById('clinical-report-paper');
    if (!element) return;

    // Create an iframe to cleanly hold the print copy of report paper
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

    // Collect head tags (metadata, link stylesheets, style tags)
    let headTags = '';
    document.querySelectorAll('link, style').forEach((node) => {
      headTags += node.outerHTML;
    });

    // Write pristine document content to the iframe
    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Clinical Speech Assessment Report</title>
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
            /* Form inputs styling for seamless printing */
            input, textarea, select {
              border: none !important;
              outline: none !important;
              background: transparent !important;
              padding: 0 !important;
              appearance: none !important;
              -webkit-appearance: none !important;
            }
          </style>
        </head>
        <body>
          <div id="clinical-report-paper" class="bg-white text-slate-900 w-[210mm] min-h-[297mm] p-12 pr-14 pl-14 relative text-xs flex flex-col justify-between">
            ${element.innerHTML}
          </div>
          <script>
            // Synchronize the input values that do not retain value inside .innerHTML
            const originalInput = window.parent.document.getElementById('inline-therapist-name-input');
            const iframeInput = document.getElementById('inline-therapist-name-input');
            if (originalInput && iframeInput) {
              iframeInput.value = originalInput.value;
            }

            // Ensure images of letterhead and stamp signatures are completed before print
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

  // Filter plans list and deduplicate by ID to guarantee unique React keys
  const filteredPlans = (() => {
    const seen = new Set<string>();
    return plans.filter(p => {
      if (!p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);

      const q = searchQuery.toLowerCase();
      return (
        p.patientName.toLowerCase().includes(q) ||
        p.provisionalDiagnosis.toLowerCase().includes(q) ||
        p.therapistName.toLowerCase().includes(q)
      );
    });
  })();

  return (
    <div className="flex bg-slate-100 font-sans text-slate-900 h-screen w-screen overflow-hidden" id="vocalis-app-root">
      {/* Hidden file uploader for Branding Custom Logo */}
      <input 
        type="file" 
        ref={logoInputRef} 
        onChange={handleLogoUpload} 
        accept="image/*" 
        className="hidden" 
        id="hidden-logo-uploader"
      />
      
      {/* 1. PERSISTENT SIDEBAR PANEL (HIGH DENSITY BLUE) */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 hidden md:flex border-r border-slate-800">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10 rounded-lg shadow-sm border border-slate-850" allowUpload />
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight uppercase leading-snug text-white truncate">
                BRG Speak HUB
              </h1>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider truncate">
                Bengal Rehab Group
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Clinical Utilities</div>
          
          <button
            type="button"
            onClick={() => {
              setView('dashboard');
              setCurrentPlan(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer text-left ${
              view === 'dashboard' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <Layers size={15} />
            Patient History
          </button>
          
          <button
            type="button"
            onClick={triggerCreateNew}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer text-left ${
              view === 'form' && !isEditing
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <Plus size={15} />
            New Therapy Plan
          </button>

          {view === 'form' && (
            <div className="mx-2 p-2.5 bg-slate-800/50 border border-slate-700/60 rounded-lg text-[10px] text-blue-400 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
              <span className="truncate">Draft Phase: {currentPlan?.patientName || 'Untitled'}</span>
            </div>
          )}

          {/* Custom Branding/Logo Management Option */}
          <div className="pt-4 border-t border-slate-850">
            <div className="text-[10px] font-bold text-slate-550 uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
              <span>Institution Brand</span>
              {customLogo && (
                <button 
                  type="button" 
                  onClick={handleLogoReset}
                  className="text-[9px] text-red-400 hover:text-red-300 capitalize underline focus:outline-none cursor-pointer"
                  title="Remove uploaded logo"
                >
                  Reset Logo
                </button>
              )}
            </div>
            <div className="mx-2 p-2.5 bg-slate-850/60 rounded-lg flex flex-col gap-1.5 border border-slate-800/50">
              <div className="flex items-center gap-2.5">
                <AppLogo className="w-8 h-8 rounded bg-white shadow" allowUpload />
                <div className="text-[10px] min-w-0 flex-1">
                  <p className="font-semibold text-slate-300 truncate">
                    {customLogo ? 'Your Custom Logo' : 'Default Logo'}
                  </p>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="text-blue-400 hover:text-blue-300 font-bold tracking-wider uppercase text-[8px] flex items-center gap-0.5 mt-0.5 transition cursor-pointer"
                  >
                    <Sparkles size={8} /> Upload Image
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Sync Status</div>
            <div className="mx-2 p-2.5 bg-slate-800/40 rounded-lg flex items-center gap-2 text-[10px] text-slate-450 border border-slate-800/80">
              <div className={`w-2 h-2 rounded-full shrink-0 ${user ? 'bg-emerald-500 shadow-xs' : 'bg-amber-400 animate-ping'}`} />
              <span className="font-semibold truncate">
                {user ? (user.isAnonymous ? 'Google Cloud Sync Active' : 'Encrypted cloud backup') : 'Offline sandbox mode'}
              </span>
            </div>
          </div>
        </nav>

        {/* User profile element */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 text-slate-200 font-extrabold flex items-center justify-center text-xs border border-slate-600/50 shrink-0">
              {user ? (user.email ? user.email.substring(0, 2).toUpperCase() : 'GS') : 'SLP'}
            </div>
            <div className="text-xs min-w-0 flex-1">
              <p className="font-semibold text-slate-200 truncate">{user ? (user.email || 'Cloud Guest Account') : 'BRG'}</p>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Senior SLP</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE COLLAPSIBLE DRAWER SIDEBAR */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-50 md:hidden"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-slate-900 text-white z-50 flex flex-col md:hidden border-r border-slate-800 shadow-2xl"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AppLogo className="w-10 h-10 rounded-lg border border-slate-800" allowUpload />
                  <div className="min-w-0">
                    <h1 className="text-xs font-black tracking-tight leading-tight uppercase text-white truncate">
                      BRG Speak HUB
                    </h1>
                    <p className="text-[8px] text-blue-400 font-bold uppercase tracking-wider truncate">
                      Bengal Rehab Group
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 px-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                  id="btn-close-mobile-menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Clinical Utilities</div>
                
                <button
                  type="button"
                  onClick={() => {
                    setView('dashboard');
                    setCurrentPlan(null);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer text-left ${
                    view === 'dashboard' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <Layers size={14} />
                  Patient History
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    triggerCreateNew();
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer text-left ${
                    view === 'form' && !isEditing
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <Plus size={14} />
                  New Therapy Plan
                </button>

                {view === 'form' && (
                  <div className="mx-2 p-2 bg-slate-800/50 border border-slate-700/60 rounded-md text-[10px] text-blue-400 font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                    <span className="truncate">Drafting: {currentPlan?.patientName || 'Untitled'}</span>
                  </div>
                )}

                {/* Mobile custom branding controller */}
                <div className="pt-4 border-t border-slate-850">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                    <span>Institution Brand</span>
                    {customLogo && (
                      <button 
                        type="button" 
                        onClick={handleLogoReset}
                        className="text-[9px] text-red-400 hover:text-red-300 capitalize underline focus:outline-none cursor-pointer"
                      >
                        Reset Logo
                      </button>
                    )}
                  </div>
                  <div className="mx-2 p-2.5 bg-slate-850/60 rounded-lg flex flex-col gap-1.5 border border-slate-800/50">
                    <div className="flex items-center gap-2.5 font-sans">
                      <AppLogo className="w-8 h-8 rounded bg-white shadow-sm" allowUpload />
                      <div className="text-[10px] min-w-0">
                        <p className="font-semibold text-slate-300 truncate">
                          {customLogo ? 'Your Custom Logo' : 'Default Logo'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setTimeout(() => logoInputRef.current?.click(), 300);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-bold tracking-wider uppercase text-[8px] flex items-center gap-0.5 mt-0.5 transition cursor-pointer"
                        >
                          <Sparkles size={8} /> Change Logo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Sync Status</div>
                  <div className="mx-2 p-2.5 bg-slate-800/40 rounded-lg flex items-center gap-2 text-[10px] text-slate-400 border border-slate-800/60">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${user ? 'bg-emerald-500 shadow-xs' : 'bg-amber-400 animate-ping'}`} />
                    <span className="font-semibold truncate">
                      {user ? (user.isAnonymous ? 'Google Cloud Sync Active' : 'Cloud sync connected') : 'Offline local cache'}
                    </span>
                  </div>
                </div>
              </nav>

              <div className="p-4 border-t border-slate-800 bg-slate-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-700 text-slate-200 font-extrabold flex items-center justify-center text-xs border border-slate-600/50 shrink-0">
                    {user ? (user.email ? user.email.substring(0, 2).toUpperCase() : 'GS') : 'SLP'}
                  </div>
                  <div className="text-xs min-w-0 flex-1">
                    <p className="font-semibold text-slate-200 truncate">{user ? (user.email || 'Cloud Guest Account') : 'BRG'}</p>
                    <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Senior SLP</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 2. MAIN APPLICATION CONTENT VIEW */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 ">
        
        {/* TOP STATUS HEADER WITH CONDITIONAL ACTION INJECTION */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            
            {/* Hamburger button to toggle mobile side drawer */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition mr-1 flex items-center justify-center"
              id="btn-trigger-mobile-menu"
            >
              <Menu size={18} />
            </button>

            <div className="md:hidden flex items-center gap-2">
              <AppLogo className="w-8 h-8 rounded cursor-pointer duration-300" allowUpload />
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight whitespace-nowrap">BRG Speak HUB</span>
            </div>
            
            <div className="hidden md:flex items-center gap-3">
              <span className="text-xs text-slate-400 font-semibold">Patient Record:</span>
              {view === 'form' ? (
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                  {isEditing ? 'Editing Mode' : 'Drafting'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                  Catalog History
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Integration Parameters */}
            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="p-1.5 px-2 border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 bg-white hover:bg-slate-50 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer h-8"
              title="Configure WhatsApp Business API"
              id="h-btn-wa-settings"
            >
              <Settings size={13} className="text-slate-400 group-hover:text-emerald-500" />
              <span className="hidden sm:inline text-[11px] font-bold text-slate-600">Sync WhatsApp</span>
            </button>

            {/* Quick Actions if working on a form */}
            {view === 'form' && currentPlan && (
              <div className="flex gap-2 mr-2">
                <button
                  type="button"
                  onClick={downloadReportAsPDF}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                  id="h-btn-export-pdf"
                >
                  {isExporting ? <RefreshCw className="animate-spin" size={13} /> : <Download size={13} />}
                  <span>Export PDF</span>
                </button>
              </div>
            )}

            {/* Authentication state */}
            {authLoading ? (
              <div className="h-8 w-16 bg-slate-100 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 pl-2 rounded-lg">
                <span className="hidden sm:inline text-[10px] font-semibold text-slate-500 mr-1 max-w-[120px] truncate">
                  {user.isAnonymous ? "Cloud Guest" : user.email}
                </span>
                {!user.isAnonymous ? (
                  <button
                    type="button"
                    onClick={handleLogActiveOut}
                    className="p-1 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50/50 rounded-md cursor-pointer transition text-[11px] font-bold flex items-center gap-1 border border-transparent hover:border-red-100"
                    title="Sign Out"
                    id="btn-sign-out"
                  >
                    <LogOut size={12} />
                    <span className="hidden md:inline">Logout</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogIn}
                    className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-md cursor-pointer transition text-[10px] font-bold flex items-center gap-1"
                    title="Sign In with Google"
                    id="btn-sign-in"
                  >
                    <LogIn size={11} />
                    <span>Link Google</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogIn}
                className="px-3 py-1.5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                id="btn-sign-in"
              >
                <LogIn size={12} />
                <span>Secure Sync</span>
              </button>
            )}
          </div>
        </header>

        {/* NOTIFICATION OVERLAYS */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-18 right-6 z-50 max-w-sm pointer-events-none"
            >
              <div className={`p-3 rounded-lg border shadow-lg flex items-start gap-2 pointer-events-auto bg-white ${
                notification.type === 'success' 
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-900 shadow-emerald-500/5' 
                  : notification.type === 'error'
                  ? 'border-red-100 bg-red-50 text-red-900 shadow-red-500/5'
                  : 'border-blue-100 bg-blue-50 text-blue-900 shadow-blue-500/5'
              }`}>
                {notification.type === 'success' ? (
                  <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                ) : notification.type === 'error' ? (
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                ) : (
                  <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
                )}
                <div className="text-[11px] font-semibold leading-relaxed">
                  {notification.message}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. PRIMARY CONTENT BODY AREA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
          
          {/* VIEW 1: DASHBOARD */}
          {view === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              
              {/* Caching/Sandbox layout warning when offline */}
              {!user && (
                <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold tracking-widest uppercase bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-md border border-blue-500/10 inline-block">
                      Guest Practitioner Access
                    </span>
                    <h2 className="text-base font-bold tracking-tight">
                      Store Clinical Data Securely in the Cloud
                    </h2>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      You are using local sandbox storage. Enable instant encrypted backup to tables with Google cloud syncing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogIn}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shrink-0 shadow-lg shadow-blue-950/20"
                    id="banner-sync-trigger"
                  >
                    Configure Cloud Sync
                  </button>
                </div>
              )}

              {/* Dashboard search actions bar (matching design metrics) */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                
                {/* Search Widget */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Search patient name, diagnosis, therapist..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-1.5 pl-9 pr-4 text-xs rounded-lg focus:border-blue-500 focus:bg-white focus:outline-hidden transition"
                    id="dashboard-search"
                  />
                </div>

                {/* Form Creation Trigger */}
                <button
                  type="button"
                  onClick={triggerCreateNew}
                  className="py-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  id="btn-create-new-plan"
                >
                  <Plus size={14} className="stroke-[2.5]" />
                  New Therapy Plan
                </button>
              </div>

              {/* Patient catalog headers */}
              <div className="flex items-center justify-between pointer-events-none">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Patient Records History
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    Showing {filteredPlans.length} formulated profiles
                  </p>
                </div>

                <div className="pointer-events-auto">
                  <button
                    type="button"
                    onClick={loadPlans}
                    className="px-2.5 py-1 text-slate-500 hover:text-slate-800 border bg-white border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition text-[10px] font-bold flex items-center gap-1.5"
                    title="Refresh Records"
                    id="btn-refresh-history"
                  >
                    <RefreshCw size={11} className={loadingPlans ? 'animate-spin' : ''} />
                    <span>Sync Ref</span>
                  </button>
                </div>
              </div>

              {/* Reports dynamic layout grids */}
              {loadingPlans ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-40 animate-pulse space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100" />
                        <div className="space-y-2 flex-1">
                          <div className="h-3.5 bg-slate-100 rounded w-1/2" />
                          <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2.5 bg-slate-100 rounded w-full" />
                        <div className="h-2.5 bg-slate-100 rounded w-4/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredPlans.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">No Patient Records Found</h4>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm leading-relaxed">
                      {searchQuery 
                        ? "No records matched your search parameters. Try adjusting the typed query."
                        : "Begin formulating Clinical Speech Therapy documents. Press 'New Therapy Plan' above."}
                    </p>
                  </div>
                  {!searchQuery && (
                    <button
                      type="button"
                      onClick={triggerCreateNew}
                      className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg cursor-pointer transition shadow-xs"
                      id="btn-empty-create"
                    >
                      Construct First Report
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPlans.map((plan) => {
                    const patientInitials = plan.patientName ? plan.patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'PT';
                    return (
                      <motion.div
                        key={plan.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white border border-slate-200 rounded-xl hover:border-blue-400 transition-all flex flex-col hover:shadow-md overflow-hidden group"
                      >
                        <div className="p-4 flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase shrink-0">
                                {patientInitials}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 text-xs tracking-tight capitalize truncate">
                                  {plan.patientName}
                                </h4>
                                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                  <span>{plan.age || 'N/A'} Yrs</span>
                                  <span>•</span>
                                  <span>{plan.gender || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                            
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 py-1 px-1.5 rounded-md flex items-center gap-1 shrink-0">
                              <Calendar size={10} />
                              {plan.date}
                            </span>
                          </div>

                          <div>
                            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wide block">
                              Provisional Diagnosis
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700 block truncate mt-1 bg-slate-50 border border-slate-100 p-1.5 rounded-md">
                              {plan.provisionalDiagnosis || 'Unallocated diagnosis'}
                            </span>
                          </div>

                          {plan.presentConcerns && (
                            <div className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-md italic">
                              &ldquo;{plan.presentConcerns}&rdquo;
                            </div>
                          )}
                        </div>

                        {/* Card footer controls */}
                        <div className="bg-slate-50 border-t border-slate-100 px-3.5 py-2.5 flex justify-between items-center shrink-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <FileSignature size={11} />
                            {plan.therapistSignature ? "Signed" : "Draft"}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => triggerWhatsAppFromHistory(plan)}
                              className={`p-1.5 border rounded cursor-pointer transition shadow-xs ${
                                isSendingWhatsApp === plan.id
                                  ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                  : "text-slate-500 hover:text-emerald-600 bg-white border-slate-200 hover:border-emerald-200"
                              }`}
                              title="Send via WhatsApp Business API"
                              id={`btn-wa-hist-${plan.id}`}
                              disabled={isSendingWhatsApp === plan.id}
                            >
                              {isSendingWhatsApp === plan.id ? (
                                <RefreshCw size={11} className="animate-spin" />
                              ) : (
                                <MessageSquare size={11} />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => triggerPrintFromHistory(plan)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 bg-white border border-slate-200 rounded hover:border-emerald-200 cursor-pointer transition shadow-xs"
                              title="Print Report"
                              id={`btn-print-hist-${plan.id}`}
                            >
                              <Printer size={11} />
                            </button>

                            <button
                              type="button"
                              onClick={() => triggerEdit(plan)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded hover:border-blue-200 cursor-pointer transition shadow-xs"
                              title="Edit Plan"
                              id={`btn-edit-${plan.id}`}
                            >
                              <Edit3 size={11} />
                            </button>

                            {showDeleteConfirm === plan.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePlan(plan.id)}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-red-600 hover:bg-red-700 text-white rounded transition"
                                  id={`btn-delete-confirm-${plan.id}`}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="px-1.5 py-0.5 text-[9px] font-semibold bg-white border border-slate-200 text-slate-500 rounded transition"
                                  id={`btn-delete-cancel-${plan.id}`}
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(plan.id ?? null)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50/10 border border-transparent hover:border-red-100 rounded cursor-pointer transition"
                                title="Delete Plan"
                                id={`btn-delete-${plan.id}`}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: FORM BLOCK INTERFACE */}
          {view === 'form' && currentPlan && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-7xl mx-auto animate-fade-in" id="formulation-zone">
              
              {/* LEFT COLUMN: ACTIVE DENSE INPUT PORTAL (7/12 Width) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Back to Dashboard row */}
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setView('dashboard')}
                    className="py-1 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                    id="btn-back-dashboard"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to History</span>
                  </button>

                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Phase</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 inline-block ${
                      isEditing ? 'bg-amber-50 text-amber-700 border border-amber-250' : 'bg-emerald-50 text-emerald-800 border border-emerald-250'
                    }`}>
                      {isEditing ? 'Modifying Plan' : 'Inception Intake'}
                    </span>
                  </div>
                </div>

                {/* SLP Preloader helper dropdown */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <Sparkles size={14} />
                    <h4 className="text-[10px] font-bold uppercase tracking-wider">
                      Speech Pathology Guideline Loader
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-450 leading-relaxed font-semibold">
                    Load validated clinical diagnostic models for apraxia, sensory dysarthria, articulation phonology or stuttering fields below.
                  </p>
                  
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-semibold rounded-lg focus:border-blue-500 focus:outline-hidden transition text-slate-700"
                    id="template-loader-dropdown"
                  >
                    <option value="">-- Click to Prepopulate Template --</option>
                    {Object.keys(CLINICAL_TEMPLATES).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>

                <form onSubmit={handleSavePlan} className="space-y-4">
                  
                  {/* demographic widget card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs flex justify-between items-center">
                      <span>Clinical Information</span>
                      <span className="text-[10px] font-bold text-blue-500">ID: #{currentPlan.id.split('_')[2] || 'NEW'}</span>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                      {/* Name */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Patient Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Aarav Mukherjee"
                          value={currentPlan.patientName}
                          onChange={(e) => handleFormChange('patientName', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="input-pt-name"
                        />
                      </div>

                      {/* Phone Number */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Patient Phone Number
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. +91 98765 43210"
                          value={currentPlan.patientPhone || ''}
                          onChange={(e) => handleFormChange('patientPhone', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="input-pt-phone"
                        />
                      </div>

                      {/* Age */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Age / Gender
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 6 Years"
                          value={currentPlan.age}
                          onChange={(e) => handleFormChange('age', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="input-pt-age"
                        />
                      </div>

                      {/* Gender */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Gender
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Male"
                          value={currentPlan.gender}
                          onChange={(e) => handleFormChange('gender', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="input-pt-gender"
                        />
                      </div>

                      {/* Date */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Evaluation Date
                        </label>
                        <input
                          type="date"
                          value={currentPlan.date}
                          onChange={(e) => handleFormChange('date', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600"
                          id="input-pt-date"
                        />
                      </div>

                      {/* Review Date */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Review Date
                        </label>
                        <input
                          type="date"
                          value={currentPlan.reviewDate}
                          onChange={(e) => handleFormChange('reviewDate', e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600"
                          id="input-pt-reviewdate"
                        />
                      </div>
                    </div>
                  </div>

                  {/* clinical impression profile findings card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs">
                      Clinical Impression & Findings
                    </div>
                    
                    <div className="p-4 space-y-3">
                      {/* Provisional diagnosis */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                          <span>Provisional Diagnosis</span>
                          {selectedTemplate && <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 rounded">Prepopulated</span>}
                        </label>
                        <textarea
                          rows={2}
                          value={currentPlan.provisionalDiagnosis}
                          onChange={(e) => handleFormChange('provisionalDiagnosis', e.target.value)}
                          placeholder="e.g. Childhood Apraxia of Speech (CAS)"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-850"
                          id="input-diagnosis"
                        />
                      </div>

                      {/* Present Concerns */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Present Concerns</label>
                        <textarea
                          rows={2}
                          value={currentPlan.presentConcerns}
                          onChange={(e) => handleFormChange('presentConcerns', e.target.value)}
                          placeholder="e.g. Inconsistent vowel sound mutations stated by primary guardian..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-850"
                          id="input-concerns"
                        />
                      </div>

                      {/* Assessment Findings */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assessment Findings</label>
                        <textarea
                          rows={3}
                          value={currentPlan.assessmentFindings}
                          onChange={(e) => handleFormChange('assessmentFindings', e.target.value)}
                          placeholder="Syllable structure analysis, goldman fristoe articulation outcomes..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-850 h-20 resize-none"
                          id="input-findings"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Therapy objectives checklist card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs flex justify-between items-center">
                      <span>Therapy Plan Targets</span>
                      <button
                        type="button"
                        onClick={addGoalField}
                        className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 border border-blue-200"
                        id="btn-add-goal"
                      >
                        <Plus size={11} className="stroke-[3]" />
                        <span>Add Strategy</span>
                      </button>
                    </div>

                    <div className="p-4 space-y-2.5" id="goals-fields-group">
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                        Add quantifiable speech-pathology goals. These map dynamically to the bulleted report preview table.
                      </p>

                      {currentPlan.therapyPlan.map((goal, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 select-none">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            placeholder="Type targeted clinical activity..."
                            value={goal}
                            onChange={(e) => handleGoalChange(index, e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            id={`input-goal-${index}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeGoalField(index)}
                            className="p-1 px-2 text-slate-400 hover:text-red-500 transition cursor-pointer"
                            title="Remove Point"
                            id={`btn-remove-goal-${index}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advice and Home Program recommendations card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs">Home Program & Advice</div>
                    <div className="p-4 space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vocal Activities/Homework</label>
                        <textarea
                          rows={2}
                          value={currentPlan.adviceHomeProgram}
                          onChange={(e) => handleFormChange('adviceHomeProgram', e.target.value)}
                          placeholder="e.g. Hand exercises for parent guided vocal sound elongation..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-850 h-20 resize-none"
                          id="input-advice"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clinician Recommendations</label>
                        <textarea
                          rows={2}
                          value={currentPlan.recommendations}
                          onChange={(e) => handleFormChange('recommendations', e.target.value)}
                          placeholder="Further consultation directives (e.g. ENT analysis, school integration paths)..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-850"
                          id="input-recommendations"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Digital Signature and authorization verify */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs">Digital Signature & Sign-off</div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 pb-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequency</label>
                          <input
                            type="text"
                            placeholder="e.g. 2 sessions / week"
                            value={currentPlan.frequencyOfTherapy}
                            onChange={(e) => handleFormChange('frequencyOfTherapy', e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            id="input-pt-frequency"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Therapist Name & Reg ID</label>
                          <input
                            type="text"
                            placeholder="e.g. BRG, MS, CCC-SLP"
                            value={currentPlan.therapistName}
                            onChange={(e) => handleFormChange('therapistName', e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            id="input-pt-slpname"
                          />
                        </div>
                      </div>

                      <SignaturePad
                        value={currentPlan.therapistSignature}
                        onChange={(dataUrl) => handleFormChange('therapistSignature', dataUrl)}
                      />
                      
                      <p className="text-[10px] text-center text-slate-400 italic">
                        Speech-Language Pathologist Verification: {currentPlan.therapistName || 'Active Practitioner Signature'}
                      </p>
                    </div>
                  </div>

                  {/* Save forms action segment */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      id="btn-save-submit"
                    >
                      <Save size={13} />
                      <span>{isSaving ? 'Synchronizing File...' : 'Secure Cloud Save'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('dashboard')}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition"
                      id="btn-cancel-edit"
                    >
                      Cancel
                    </button>
                  </div>

                </form>
              </div>

              {/* RIGHT COLUMN: PROFESSIONAL A4 LETTERHEAD PREVIEW (5/12 Width) */}
              <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">A4 Document Simulation</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">High definition vector print layout scale</p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={triggerWhatsAppDirect}
                      disabled={isSendingWhatsApp === currentPlan?.id}
                      className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-md cursor-pointer transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                      id="btn-active-wa-send"
                    >
                      {isSendingWhatsApp === currentPlan?.id ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <MessageSquare size={11} />
                      )}
                      <span>Send WA</span>
                    </button>
                    <button
                      type="button"
                      onClick={printReport}
                      className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-md cursor-pointer transition-all flex items-center gap-1 shrink-0"
                      id="btn-print-report"
                    >
                      <Printer size={11} />
                      <span>Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadReportAsPDF}
                      disabled={isExporting}
                      className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-md cursor-pointer transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                      id="btn-export-pdf"
                    >
                      {isExporting ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                <div 
                  ref={containerRef} 
                  className="bg-slate-300 rounded-xl p-3 border border-slate-200 overflow-hidden relative flex justify-center"
                  style={{ height: previewHeight ? `${previewHeight + 24}px` : 'auto', minHeight: '350px' }}
                >
                  <div
                    style={{
                      transform: `translateX(-50%) scale(${previewScale})`,
                      transformOrigin: 'top center',
                      width: '210mm',
                      position: 'absolute',
                      left: '50%',
                      top: '12px',
                    }}
                  >
                    <div 
                      ref={printAreaRef}
                      id="clinical-report-paper"
                      className="bg-white text-slate-900 w-[210mm] min-h-[297mm] p-12 pr-14 pl-14 shadow-md relative text-xs flex flex-col justify-between"
                    >
                      <div className="space-y-5">
                        
                        {/* Letterhead */}
                        <div className="border-b-2 border-blue-600 pb-3 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <AppLogo className="w-10 h-10 rounded border border-slate-150 shadow-sm" allowUpload />
                          <div>
                            <h2 className="text-sm font-extrabold tracking-tight text-slate-950 uppercase leading-none">BRG Speak HUB</h2>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">Bengal Rehabilitation Group • Clinical Speech Assessment</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[8px] font-bold text-slate-450 uppercase tracking-widest">Assessment Record</p>
                          <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">FORM NO: SLP-X781</span>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100/80">
                        <div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Patient Name</span>
                          <span className="text-xs font-bold text-slate-900 capitalize mt-0.5 block">{currentPlan.patientName || '_________________'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Patient Phone</span>
                          <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">{currentPlan.patientPhone || '_________________'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Evaluation Date</span>
                          <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">{currentPlan.date || '_________________'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Age </span>
                          <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">
                            {currentPlan.age ? `${currentPlan.age}` : '_____'} / {currentPlan.gender || '_____'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Planned Review</span>
                          <span className="text-[11px] font-semibold text-slate-800 mt-0.5 block">{currentPlan.reviewDate || '_________________'}</span>
                        </div>
                      </div>

                      {/* provisional profile */}
                      <div className="space-y-1 bg-blue-50/30 border-l-4 border-blue-600 p-2.5 rounded-r-md">
                        <h4 className="text-[9px] font-bold text-blue-900 uppercase tracking-wider">Provisional Diagnostic Impressions:</h4>
                        <p className="text-xs font-semibold text-slate-850 leading-relaxed">{currentPlan.provisionalDiagnosis || 'Diagnosis is pending active evaluation outcomes.'}</p>
                      </div>

                      {/* concerns */}
                      <div className="space-y-0.5">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Presenting Concerns</h4>
                        <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                        <p className="text-[11px] text-slate-800 leading-relaxed whitespaces-pre-line">{currentPlan.presentConcerns || 'No concerns recorded.'}</p>
                      </div>

                      {/* assessment */}
                      <div className="space-y-0.5">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Clinical Observations & Findings</h4>
                        <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                        <p className="text-[11px] text-slate-800 leading-relaxed whitespaces-pre-line">{currentPlan.assessmentFindings || 'Specific formal assessment observations are pending.'}</p>
                      </div>

                      {/* plan bullet points */}
                      <div className="space-y-1.5">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Therapy Target Objectives Bullet Plan</h4>
                        <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                        
                        <ol className="space-y-1.5" id="pdf-goals-list">
                          {currentPlan.therapyPlan.filter(g => g.trim() !== '').length === 0 ? (
                            <li className="text-[11px] text-slate-400 italic">No objectives have been logged yet.</li>
                          ) : (
                            currentPlan.therapyPlan
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
                        <p className="text-[11px] text-slate-800 leading-relaxed whitespaces-pre-line">{currentPlan.adviceHomeProgram || 'Direct home drills and guidelines will follow.'}</p>
                      </div>

                      {/* recommendation */}
                      <div className="space-y-0.5">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Clinician Recommendations path</h4>
                        <div className="h-[0.5px] bg-slate-100 w-full mb-1" />
                        <p className="text-[11px] text-slate-800 leading-relaxed whitespaces-pre-line">{currentPlan.recommendations || 'No further path defined at this phase.'}</p>
                      </div>

                    </div>

                    {/* verification footer */}
                    <div className="pt-4 border-t border-slate-200 mt-6 shrink-0">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Prescribed Frequency</span>
                          <span className="text-[10px] font-semibold text-slate-800 block bg-slate-100 py-0.5 px-2 rounded border border-slate-200 inline-block">
                            {currentPlan.frequencyOfTherapy || 'As scheduled'}
                          </span>
                        </div>

                        <div className="text-right space-y-1">
                          {currentPlan.therapistSignature ? (
                            <div className="inline-block border border-slate-100 rounded p-1 bg-white max-w-[100px] mb-1">
                              <img 
                                src={currentPlan.therapistSignature} 
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

                          <input
                            type="text"
                            value={currentPlan.therapistName}
                            onChange={(e) => handleFormChange('therapistName', e.target.value)}
                            className="text-[11px] font-bold text-slate-900 leading-none capitalize block w-full text-right outline-none border-b border-dashed border-transparent hover:border-slate-300 focus:border-blue-500 bg-transparent py-0.5 print:border-none focus:ring-0"
                            placeholder="Type Therapist Name..."
                            title="Click to edit therapist name directly"
                            id="inline-therapist-name-input"
                          />
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-1">
                            Registered Speech Therapist
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        </div>

        {/* 4. CLINCIAL STATUS FOOTER STATUS BAR (HIGH DENSITY BLUE) */}
        <footer className="h-10 bg-slate-900 border-t border-slate-800 px-6 shrink-0 flex items-center justify-between text-[9px] font-medium text-slate-450 uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              Sync: {user ? 'Connected & Cloud Encrypted' : 'Offline Local Mode'}
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:inline">License ID: #SLP-PLAN-2023-X99</span>
          </div>
          <div>
            <span>BRG Speak HUB &copy; 2026</span>
          </div>
        </footer>

      </main>

      {/* WHATSAPP CUSTOM INTEGRATION DRAWER MODAL */}
      <AnimatePresence>
        {showWhatsAppModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              {/* Header */}
              <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-[13px] tracking-tight">WhatsApp API Sync Panel</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">Meta Developer Business Cloud Integration</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Form Fields container */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSaveWhatsAppSettings({
                    accessToken: (formData.get('accessToken') as string || '').trim(),
                    phoneNumberId: (formData.get('phoneNumberId') as string || '').trim(),
                    businessAccountId: (formData.get('businessAccountId') as string || '').trim(),
                    templateName: (formData.get('templateName') as string || '').trim() || 'hello_world',
                    langCode: (formData.get('langCode') as string || '').trim() || 'en_US'
                  });
                }}
                className="p-5 space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                    <span>Meta Access Token (EAAB...)</span>
                    <button
                      type="button"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {showAccessToken ? "Hide Secret" : "Show Secret"}
                    </button>
                  </label>
                  <input
                    type={showAccessToken ? "text" : "password"}
                    name="accessToken"
                    defaultValue={whatsappSettings.accessToken}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    placeholder="Enter access token from developers.facebook.com"
                    required
                  />
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed leading-[1.3]">
                    To retain persistence and send messages seamlessly, copy the temporary and/or permanent token from your Meta App Console.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      name="phoneNumberId"
                      defaultValue={whatsappSettings.phoneNumberId}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="e.g., 1193795173813206"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Business Account ID
                    </label>
                    <input
                      type="text"
                      name="businessAccountId"
                      defaultValue={whatsappSettings.businessAccountId}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="e.g., 995786956257682"
                      required
                    />
                  </div>
                </div>

                <div className="border-t border-slate-150 pt-3.5 mt-3.5 space-y-3">
                  <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Fallback Notification Settings</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Template Name
                      </label>
                      <input
                        type="text"
                        name="templateName"
                        defaultValue={whatsappSettings.templateName}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        placeholder="hello_world"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Language Code
                      </label>
                      <input
                        type="text"
                        name="langCode"
                        defaultValue={whatsappSettings.langCode}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        placeholder="en_US"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 leading-[1.3]">
                    Template name and languages are triggered as fallback automatically if the active 24h window constraint is hit. Default template approved by Meta is <strong>hello_world</strong>.
                  </p>
                </div>

                <div className="border-t border-slate-150 pt-3.5 mt-3.5 space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>🔍 Debug & Verification / লাইভ কানেকশন টুল</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>
                  </h5>
                  
                  <p className="text-[9.5px] text-slate-500 leading-tight leading-[1.3]">
                    বাস্তব রোগীদের হোয়াটসঅ্যাপ নাম্বারে সরাসরি মেসেজ পাঠাতে আপনার বিজনেস নাম্বারটি মেটায় রেজিস্টার থাকতে হবে। এখান থেকে সরাসরি ভেরিফাই ও কানেক্ট করুন:
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={diagnosing}
                      onClick={() => {
                        const form = document.querySelector('form');
                        const tempToken = form ? (new FormData(form).get('accessToken') as string || '') : '';
                        const tempPhoneId = form ? (new FormData(form).get('phoneNumberId') as string || '') : '';
                        testWhatsAppConnection(tempToken, tempPhoneId);
                      }}
                      className="flex-1 py-1 px-2 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800 disabled:bg-slate-300 transition text-center cursor-pointer"
                    >
                      {diagnosing ? 'Checking Connection...' : 'Test Connection Status / কানেকশন চেক'}
                    </button>
                  </div>

                  {diagResult && (
                    <div className={`p-2.5 rounded text-[9.5px] font-bold leading-relaxed whitespace-pre-wrap border ${
                      diagResult.success 
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                        : 'bg-red-50 text-red-900 border-red-200'
                    }`}>
                      {diagResult.message}
                    </div>
                  )}

                  <div className="border-t border-dashed border-slate-300 pt-2.5 mt-2.5 space-y-2">
                    <label className="block text-[10px] font-bold text-slate-600">
                      ৬ সংখ্যার টু-স্টেপ ভেরিফিকেশন পিন (Two-step PIN)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="e.g., 123456"
                        value={registerPin}
                        onChange={(e) => setRegisterPin(e.target.value.replace(/\D/g, ''))}
                        className="w-1/3 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold font-mono tracking-widest text-center"
                      />
                      <button
                        type="button"
                        disabled={registering || registerPin.length !== 6}
                        onClick={() => {
                          const form = document.querySelector('form');
                          const tempToken = form ? (new FormData(form).get('accessToken') as string || '') : '';
                          const tempPhoneId = form ? (new FormData(form).get('phoneNumberId') as string || '') : '';
                          registerWhatsAppNumber(registerPin, tempToken, tempPhoneId);
                        }}
                        className="flex-1 py-1 px-2 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition text-center cursor-pointer"
                      >
                        {registering ? 'Registering with Meta...' : 'Register Number with Meta'}
                      </button>
                    </div>
                    <p className="text-[8.5px] text-slate-400 leading-tight leading-[1.3]">
                      *টু-স্টেপ ভেরিফিকেশন পিন আপনার WhatsApp Manager → Phone Numbers এ সেট করতে পারেন। অথবা মেটার ডিফল্ট পিন বা আপনার দেওয়া পিন দিয়ে সাবমিট করুন।
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-3 space-y-1.5">
                  <h6 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <span>💡 Meta Sandbox Mode / সমাধান</span>
                  </h6>
                  <p className="text-[9.5px] text-emerald-950 font-bold leading-tight">
                    আপনি যদি Meta-র Test Business Account ব্যবহার করেন, তবে রোগী বা প্রাপকের নম্বরটিকে আগে ভেরিফাই করতে হবে:
                  </p>
                  <p className="text-[9px] text-slate-700 leading-relaxed">
                    1. <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-bold">developers.facebook.com</a> এ গিয়ে আপনার App সিলেক্ট করুন। <br />
                    2. বামদিকের Sidebar থেকে <strong>WhatsApp → API Setup</strong> এ যান। <br />
                    3. মাঝখানের "To" dropdown থেকে <strong>Manage phone number list</strong> এ ক্লিক করে প্রাপকের নম্বরটি যোগ ও ওটিপি (OTP) দিয়ে ভেরিফাই করুন।
                  </p>
                </div>

                <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5 -mx-5 -mb-5 bg-slate-50/80">
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    Save & Sync State
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
