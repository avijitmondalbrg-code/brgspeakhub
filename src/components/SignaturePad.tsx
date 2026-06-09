import React, { useRef, useState, useEffect } from 'react';
import { Trash2, PenTool, Upload, HelpCircle, Check } from 'lucide-react';

interface SignaturePadProps {
  value: string; // Base64 data URL
  onChange: (value: string) => void;
}

export default function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [inputMode, setInputMode] = useState<'draw' | 'upload'>('draw');
  const [dragActive, setDragActive] = useState(false);

  // Setup drawing configuration
  useEffect(() => {
    if (inputMode === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#0f172a'; // slate-900 / dark line
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }
  }, [inputMode]);

  // Support canvas resize/clearing initial state
  useEffect(() => {
    if (inputMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      // Get display size
      const rect = canvas.getBoundingClientRect();
      // Set buffer resolution to match display size for 1:1 crisp drawing
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Re-apply stroke specs after resize
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      // If we already have a value, we can optionally draw it, but representing it in an image preview is cleaner.
    }
  }, [inputMode]);

  // Handle drawing events (Desktop Mouse)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Sync base64 immediately when drawing stroke completes
    saveCanvas();
  };

  // Handle drawing events (Mobile Touch)
  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent scrolling when drawing on touchscreen
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveCanvas();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      onChange('');
    }
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Check if canvas is empty to prevent saving blank space
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      if (canvas.toDataURL() === blank.toDataURL()) {
        onChange('');
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  // Handlers for File Upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Pleas select an image file (PNG/JPG)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        onChange(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm" id="signature-pad-container">
      {/* Tab select option */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-1 gap-1">
        <button
          type="button"
          onClick={() => setInputMode('draw')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            inputMode === 'draw'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-900'
          }`}
          id="btn-sig-draw"
        >
          <PenTool size={14} />
          Digital Draw
        </button>
        <button
          type="button"
          onClick={() => setInputMode('upload')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            inputMode === 'upload'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-900'
          }`}
          id="btn-sig-upload"
        >
          <Upload size={14} />
          Upload Image File
        </button>
      </div>

      <div className="p-4 bg-white">
        {inputMode === 'draw' ? (
          <div>
            <div className="relative border border-dashed border-slate-200 rounded-lg hover:border-slate-300 transition duration-150 h-36 bg-slate-50/20">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawingTouch}
                onTouchMove={drawTouch}
                onTouchEnd={stopDrawingTouch}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />
              {!value && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
                  <PenTool className="opacity-40 mb-1" size={20} />
                  <span className="text-[11px]">Draw signature with finger or pointer</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-3">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <HelpCircle size={10} /> Saved automatically during sketching
              </span>
              <button
                type="button"
                onClick={clearCanvas}
                className="py-1 px-3 text-xs bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-100 rounded-md transition flex items-center gap-1"
                id="btn-sig-clear"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg h-36 flex flex-col items-center justify-center transition p-4 ${
                dragActive ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300 bg-slate-50/20'
              }`}
            >
              <Upload className="text-slate-400 mb-2" size={24} />
              <label className="cursor-pointer text-center">
                <span className="text-xs font-semibold text-blue-600 hover:text-blue-700 block">
                  Click to choose file
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Supports PNG, JPG, or SVG
                </span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Dynamic Signature Preview */}
        {value && (
          <div className="mt-3 p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-white border border-emerald-100 overflow-hidden flex items-center justify-center p-0.5">
                <img src={value} alt="Signature preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-emerald-800 block">
                  Signature Ready
                </span>
                <span className="text-[9px] text-emerald-600 block leading-none">
                  Stored securely inside clinical record
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-slate-400 hover:text-red-500 p-1"
              id="btn-remove-signature"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
