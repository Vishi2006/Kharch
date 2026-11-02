'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Upload, AlertCircle, RefreshCw, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function QRScanner({ onScanSuccess, onScanError }) {
  const [scannerError, setScannerError] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const qrCodeInstanceRef = useRef(null);
  const fileInputRef = useRef(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    const elementId = 'kharch-qr-reader';
    const html5QrCode = new Html5Qrcode(elementId);
    qrCodeInstanceRef.current = html5QrCode;

    // Start live camera
    const startCamera = async () => {
      try {
        setScannerError(null);
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (onScanSuccess) {
              onScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            if (onScanError) {
              onScanError(errorMessage);
            }
          }
        );
        setCameraActive(true);
      } catch (err) {
        console.warn('Camera start issue:', err);
        setCameraActive(false);
        // Usually happens on non-HTTPS origins on mobile
        setScannerError('Camera access unavailable. You can upload a QR image from your gallery below.');
      }
    };

    startCamera();

    return () => {
      if (html5QrCode && html5QrCode.isScanning && !isStoppingRef.current) {
        isStoppingRef.current = true;
        html5QrCode.stop()
          .then(() => html5QrCode.clear())
          .catch((err) => console.warn('QR cleanup error:', err));
      }
    };
  }, [onScanSuccess, onScanError]);

  // Handle image upload from file or gallery
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);

    try {
      let qrScanner = qrCodeInstanceRef.current;
      if (!qrScanner) {
        qrScanner = new Html5Qrcode('kharch-qr-reader');
        qrCodeInstanceRef.current = qrScanner;
      }

      // If camera is currently active, stop it before scanning file
      if (qrScanner.isScanning) {
        await qrScanner.stop();
        setCameraActive(false);
      }

      const decodedText = await qrScanner.scanFile(file, false);
      if (decodedText) {
        if (onScanSuccess) {
          onScanSuccess(decodedText);
        }
      }
    } catch (err) {
      console.warn('QR decode failed from image file:', err);
      setFileError('Could not detect a valid QR code in this image. Please select a clearer photo.');
    } finally {
      setIsProcessingFile(false);
      // Reset input value so same file can be chosen again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm mx-auto">
      {/* Camera Viewport Container */}
      <div className="relative w-full aspect-square bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center">
        {/* The DOM element required by html5-qrcode */}
        <div id="kharch-qr-reader" className="w-full h-full object-cover"></div>

        {/* Overlay while processing an uploaded file */}
        {isProcessingFile && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-xs font-bold text-slate-200">Decoding QR Code...</span>
          </div>
        )}

        {/* Fallback overlay when camera is not running / denied */}
        {scannerError && !cameraActive && !isProcessingFile && (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-950/90 z-10 gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <Camera className="w-7 h-7 text-amber-400" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              {scannerError}
            </p>
            <button
              type="button"
              onClick={triggerFileInput}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Choose from Gallery
            </button>
          </div>
        )}
      </div>

      {/* File error message if decode fails */}
      {fileError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Upload QR Photo Button */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <button
          type="button"
          onClick={triggerFileInput}
          disabled={isProcessingFile}
          className="w-full py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 active:scale-98 text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <ImageIcon className="w-4 h-4 text-indigo-400" />
          <span>Upload QR from Photos / Gallery</span>
        </button>
      </div>
    </div>
  );
}
