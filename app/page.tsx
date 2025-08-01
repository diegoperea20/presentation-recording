"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  Play,
  Square,
  Camera,
  Mic,
  MicOff,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Maximize,
  Minimize,
  Sun,
  Moon,
  Menu,
  X,
  Github,
} from "lucide-react";
import Link from "next/link";

interface PDFPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
}

export default function PresentationRecorder() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<PDFPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [videoQuality, setVideoQuality] = useState<"HD" | "FHD" | "4K">("FHD");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const drawIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentPageRef = useRef(0);
  const [customBackgroundColor, setCustomBackgroundColor] = useState<string | null>(null);

  // Load PDF.js
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      // @ts-ignore
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    };
    document.head.appendChild(script);
  }, []);

  // Helper function to get video dimensions based on quality
  const getVideoDimensions = (quality: "HD" | "FHD" | "4K") => {
    switch (quality) {
      case "HD":
        return { width: 1280, height: 720, aspectRatio: 16/9 };
      case "FHD":
        return { width: 1920, height: 1080, aspectRatio: 16/9 };
      case "4K":
        return { width: 3840, height: 2160, aspectRatio: 16/9 };
      default:
        return { width: 1920, height: 1080, aspectRatio: 16/9 };
    }
  };

  // 2. Function to get the default color based on the theme
const getDefaultBackgroundColor = () => {
  return isDarkMode ? "#1e293b" : "#f1f5f9";
};

  // Keyboard navigation
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (pdfPages.length === 0) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setCurrentPage((prev) => Math.min(pdfPages.length - 1, prev + 1));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setCurrentPage((prev) => Math.max(0, prev - 1));
      } else if (event.key === "Escape" && isFullscreen) {
        toggleFullscreen();
      }
    },
    [pdfPages.length, isFullscreen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Close sidebar on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    setPdfFile(file);
    await loadPDF(file);
    setSidebarOpen(false); // Close sidebar after upload on mobile
  };

  const loadPDF = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore
    const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
    const pages: PDFPage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      pages.push({ pageNumber: i, canvas });
    }

    setPdfPages(pages);
    setCurrentPage(0);
  };

  const startCamera = async () => {
    try {
      //console.log("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      setMediaStream(stream);
      setCameraEnabled(true);
      //console.log("Camera started successfully");
    } catch (error) {
      //console.error("Error accessing webcam", error);
      setCameraEnabled(false);
      alert(`Error accessing the camera: ${error.message}`);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      setMediaStream(null);
    }
    setCameraEnabled(false);
  };

  const toggleCamera = () => {
    if (cameraEnabled) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const toggleMic = async () => {
    if (micEnabled) {
      setMicEnabled(false);
    } else {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setMicEnabled(true);
        //console.log("Microphone enabled");
      } catch (error) {
        //console.error("Error accessing microphone:", error);
        alert("Could not access the microphone. Please check permissions.");
      }
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen && !document.fullscreenElement) {
        if (presentationRef.current?.requestFullscreen) {
          await presentationRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.warn("Fullscreen operation failed:", error);
      // Reset state if operation failed
      setIsFullscreen(!!document.fullscreenElement);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      //console.log("Fullscreen state changed:", isCurrentlyFullscreen);
    };

    const handleFullscreenError = (event: Event) => {
      //console.warn("Fullscreen error:", event);
      setIsFullscreen(false);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("fullscreenerror", handleFullscreenError);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("fullscreenerror", handleFullscreenError);
    };
  }, []);

  // Keep currentPage reference updated
  useEffect(() => {
    currentPageRef.current = currentPage;
    //console.log(`📄 CurrentPage updated to: ${currentPage + 1}`);
  }, [currentPage]);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [mediaStream]);

    // 3. Add useEffect to redraw when theme changes and update the presentation canvas
  useEffect(() => {
    // Redraw when theme or custom color changes
    if (canvasRef.current && !isRecording) {
      requestAnimationFrame(() => drawFrame());
    }
  }, [isDarkMode, customBackgroundColor]);

  const drawFrame = useCallback(() => {
    if (!canvasRef.current) {
      //console.log("❌ No canvas ref available");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    try {
      // Get current time for animations
      const now = Date.now();
      const seconds = Math.floor(now / 1000);

      // Use the current reference of currentPage
      const activePage = currentPageRef.current;

      // FIXED DIMENSIONS for recording - DO NOT change during recording
      const FIXED_WIDTH = canvas.width;
      const FIXED_HEIGHT = canvas.height;

      // Clear canvas completely
      ctx.clearRect(0, 0, FIXED_WIDTH, FIXED_HEIGHT);

      // Background with subtle changing gradient
      const gradient = ctx.createLinearGradient(0, 0, FIXED_WIDTH, FIXED_HEIGHT);

      let baseColor: string;
      let accentColor: string;

      if (customBackgroundColor) {
        // If there's a custom color, use it as base
        baseColor = customBackgroundColor;
        // Create a darker/lighter accent color based on the custom one
        const hex = customBackgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16); 
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Make the accent slightly darker
        const accentR = Math.max(0, r - 30);
        const accentG = Math.max(0, g - 30);
        const accentB = Math.max(0, b - 30);
        
        accentColor = `rgb(${accentR}, ${accentG}, ${accentB})`;
      } else {
        // Use default theme colors
        baseColor = isDarkMode ? "#1e293b" : "#f1f5f9";
        accentColor = isDarkMode ? "#334155" : "#e2e8f0";
      }

      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, accentColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FIXED_WIDTH, FIXED_HEIGHT);

      // Draw presentation (right side) - FIXED DIMENSIONS
      if (pdfPages.length > 0 && pdfPages[activePage]) {
        //console.log(
        //  `🖼️ Drawing slide ${activePage + 1} of ${pdfPages.length}`
        //);
        const slideCanvas = pdfPages[activePage].canvas;
        const slideAspect = slideCanvas.width / slideCanvas.height;

        // USE FIXED CANVAS DIMENSIONS, NOT VIEWPORT
        const presentationWidth = FIXED_WIDTH * 0.65;
        const presentationHeight = FIXED_HEIGHT * 0.8;
        const presentationX = FIXED_WIDTH * 0.32;
        const presentationY = (FIXED_HEIGHT - presentationHeight) / 2;

        let slideWidth = presentationWidth;
        let slideHeight = presentationWidth / slideAspect;

        if (slideHeight > presentationHeight) {
          slideHeight = presentationHeight;
          slideWidth = presentationHeight * slideAspect;
        }

        const slideX = presentationX + (presentationWidth - slideWidth) / 2;
        const slideY = presentationY + (presentationHeight - slideHeight) / 2;

        // Animated shadow
        const shadowOffset = 3 + Math.sin(now / 1000) * 2;
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        ctx.fillRect(
          slideX + shadowOffset,
          slideY + shadowOffset,
          slideWidth + 10,
          slideHeight + 10
        );

        // White background for the slide
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(slideX - 5, slideY - 5, slideWidth + 10, slideHeight + 10);

        // Draw slide
        ctx.drawImage(slideCanvas, slideX, slideY, slideWidth, slideHeight);

        // Border with changing color
        const borderHue = (now / 50) % 360;
        ctx.strokeStyle = `hsl(${borderHue}, 50%, 60%)`;
        ctx.lineWidth = 3;
        ctx.strokeRect(slideX, slideY, slideWidth, slideHeight);
      } else {
        // Animated placeholder for presentation - FIXED DIMENSIONS
        ctx.fillStyle = "#6b7280";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";

        // Pulsing text
        const pulse = 0.8 + Math.sin(now / 500) * 0.2;
        ctx.save();
        ctx.scale(pulse, pulse);
        ctx.fillText(
          "PRESENTATION",
          (FIXED_WIDTH * 0.65) / pulse,
          FIXED_HEIGHT / 2 / pulse
        );
        ctx.restore();

        ctx.font = "24px Arial";
        ctx.fillText(
          "Upload a PDF file",
          FIXED_WIDTH * 0.65,
          FIXED_HEIGHT / 2 + 50
        );
        ctx.textAlign = "left";
      }

      // Draw camera (left side) with rounded corners - FIXED DIMENSIONS
      if (
        cameraEnabled &&
        videoRef.current &&
        mediaStream &&
        videoRef.current.readyState >= 2
      ) {
        const video = videoRef.current;
        // Use a percentage of the canvas for the camera
        const cameraWidthPercent = 0.25; // 25% del ancho del canvas
        const cameraHeightPercent = 0.55; // 55% del alto del canvas
        
        const cameraWidth = FIXED_WIDTH * cameraWidthPercent;
        const cameraHeight = FIXED_HEIGHT * cameraHeightPercent;
        const cameraX = 30;
        const cameraY = (FIXED_HEIGHT - cameraHeight) / 2;

       // Rounded corner radius (equivalent to rounded-lg in the UI)
       const borderRadius = Math.min(cameraWidth, cameraHeight) * 0.08; // Aproximadamente 8px en escala relativa

       // Animated shadow with rounded corners
       const shadowOffset = 5 + Math.sin(now / 800) * 3;
       ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
       ctx.beginPath();
       ctx.roundRect(
         cameraX + shadowOffset,
         cameraY + shadowOffset,
         cameraWidth + 10,
         cameraHeight + 10,
         borderRadius
       );
       ctx.fill();

       // Black background with rounded corners
       ctx.fillStyle = "#000000";
       ctx.beginPath();
       ctx.roundRect(
         cameraX - 5,
         cameraY - 5,
         cameraWidth + 10,
         cameraHeight + 10,
         borderRadius
       );
       ctx.fill();

       // Create a mask for the video with rounded corners
       ctx.save();
       ctx.beginPath();
       ctx.roundRect(cameraX, cameraY, cameraWidth, cameraHeight, borderRadius);
       ctx.clip();

       // Calculate video dimensions maintaining aspect ratio (object-cover)
       const videoAspect = video.videoWidth / video.videoHeight;
       const containerAspect = cameraWidth / cameraHeight;
       
       let drawWidth, drawHeight, drawX, drawY;
       
       if (videoAspect > containerAspect) {
         // Video is wider, adjust by height
         drawHeight = cameraHeight;
         drawWidth = drawHeight * videoAspect;
         drawX = cameraX - (drawWidth - cameraWidth) / 2;
         drawY = cameraY;
       } else {
         // Video is taller, adjust by width
         drawWidth = cameraWidth;
         drawHeight = drawWidth / videoAspect;
         drawX = cameraX;
         drawY = cameraY - (drawHeight - cameraHeight) / 2;
       }

       // Draw video inside the rounded mask with correct proportions
       ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
       
       ctx.restore();

       // Animated blue border with rounded corners
       const borderIntensity = 0.7 + Math.sin(now / 600) * 0.3;
       ctx.strokeStyle = `rgba(59, 130, 246, ${borderIntensity})`;
       ctx.lineWidth = 5;
       ctx.beginPath();
       ctx.roundRect(cameraX, cameraY, cameraWidth, cameraHeight, borderRadius);
       ctx.stroke();

       // "CAMERA" label with effect
       //ctx.fillStyle = "#3b82f6";
       //ctx.font = "bold 18px Arial";
       //ctx.fillText("CAMERA", cameraX, cameraY - 15);
     } else {
       // Animated camera placeholder with rounded corners - FIXED DIMENSIONS
       const cameraWidthPercent = 0.25;
       const cameraHeightPercent = 0.55;
       
       const cameraWidth = FIXED_WIDTH * cameraWidthPercent;
       const cameraHeight = FIXED_HEIGHT * cameraHeightPercent;
       const cameraX = 30;
       const cameraY = (FIXED_HEIGHT - cameraHeight) / 2;

       // Radio de los bordes redondeados
       const borderRadius = Math.min(cameraWidth, cameraHeight) * 0.08;

       // Pulsing background with rounded corners
       const pulse = 0.9 + Math.sin(now / 1000) * 0.1;
       ctx.fillStyle = `rgba(55, 65, 81, ${pulse})`;
       ctx.beginPath();
       ctx.roundRect(cameraX, cameraY, cameraWidth, cameraHeight, borderRadius);
       ctx.fill();

       ctx.fillStyle = "#9ca3af";
       const fontSize = Math.min(28, cameraWidth / 12); // Responsive text
       ctx.font = `${fontSize}px Arial`;
       ctx.textAlign = "center";
       ctx.fillText(
         "CAMERA",
         cameraX + cameraWidth / 2,
         cameraY + cameraHeight / 2 - 15
       );
       ctx.fillText(
         "DEACTIVATED",
         cameraX + cameraWidth / 2,
         cameraY + cameraHeight / 2 + 25
       );
       ctx.textAlign = "left";

       // Borde gris con bordes redondeados
       ctx.strokeStyle = "#6b7280";
       ctx.lineWidth = 2;
       ctx.beginPath();
       ctx.roundRect(cameraX, cameraY, cameraWidth, cameraHeight, borderRadius);
       ctx.stroke();
     }

      // Recording indicators ALWAYS visible and animated - FIXED DIMENSIONS
      if (isRecording) {
        // More visible blinking red dot
        const pulse = Math.sin(now / 250) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(FIXED_WIDTH - 100, 60, 18 + pulse * 5, 0, 2 * Math.PI);
        ctx.fill();

        // Outer circle
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(FIXED_WIDTH - 100, 60, 25, 0, 2 * Math.PI);
        ctx.stroke();

        // More visible recording time
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 28px Arial";
        ctx.fillText(
          `● REC ${formatTime(recordingTime)}`,
          FIXED_WIDTH - 320,
          70
        );

        // Frame counter (for debug)
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px Arial";
        ctx.fillText(`Frame: ${seconds}`, FIXED_WIDTH - 150, 100);

        // Slide info using activePage
        if (pdfPages.length > 0) {
          ctx.fillStyle = "#374151";
          ctx.font = "20px Arial";
          ctx.fillText(
            `Slide ${activePage + 1} of ${pdfPages.length}`,
            FIXED_WIDTH - 320,
            FIXED_HEIGHT - 40
          );
        }

        // Unique elements that GUARANTEE changes in each frame
        const uniqueId = now % 10000;

        // Invisible changing pixel
        ctx.fillStyle = `rgba(${uniqueId % 255}, ${(uniqueId * 2) % 255}, ${
          (uniqueId * 3) % 255
        }, 0.01)`;
        ctx.fillRect(FIXED_WIDTH - 1, FIXED_HEIGHT - 1, 1, 1);

        // Invisible moving line
        ctx.strokeStyle = `rgba(255, 255, 255, 0.001)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(uniqueId % FIXED_WIDTH, 0);
        ctx.lineTo((uniqueId + 100) % FIXED_WIDTH, 10);
        ctx.stroke();

        // Invisible timestamp
        ctx.fillStyle = "rgba(0, 0, 0, 0.001)";
        ctx.font = "1px Arial";
        ctx.fillText(now.toString(), -1000, -1000);
      }

      //console.log(
      //  `✅ Frame ${seconds} drawn - Recording: ${isRecording} - Slide: ${
      //    activePage + 1
      //  }/${pdfPages.length} - Dimensions: ${FIXED_WIDTH}x${FIXED_HEIGHT}`
      //);
    } catch (error) {
      console.error("❌ Error drawing frame:", error);
    }
  }, [
    pdfPages,
    cameraEnabled,
    mediaStream,
    isRecording,
    recordingTime,
    isDarkMode,
  ]);

  const startRecording = async () => {
    if (!canvasRef.current) {
      alert("Canvas not available");
      return;
    }

    try {
      //console.log("🎬 === STARTING RECORDING ===");

      const canvas = canvasRef.current;
      // Configure resolution based on selected quality - ONLY ONCE
      const { width: canvasWidth, height: canvasHeight } = getVideoDimensions(videoQuality);
      let bitrate: number;
      switch (videoQuality) {
        case "HD":
          
          bitrate = 3000000; // 3 Mbps
          break;
        case "FHD":
         
          bitrate = 5000000; // 5 Mbps
          break;
        case "4K":
          
          bitrate = 15000000; // 15 Mbps
          break;
        default:
          
          bitrate = 5000000;
      }

      // Set canvas dimensions once - DO NOT CHANGE DURING RECORDING
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      //console.log(
      //  `🎨 Canvas SET to ${videoQuality}: ${canvasWidth}x${canvasHeight} - WILL NOT CHANGE`
      //);

      // Draw initial frame
      drawFrame();

      //console.log("🎨 Initial frame drawn");

      // Create canvas stream
      const canvasStream = canvas.captureStream(30);
      //console.log(
      //  "📹 Canvas stream created:",
      //  canvasStream.getVideoTracks().length,
      //  "tracks"
      //);

      if (canvasStream.getVideoTracks().length === 0) {
        throw new Error("Could not create video stream");
      }

      // Add audio if enabled
      if (micEnabled) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            canvasStream.addTrack(audioTrack);
            //console.log("🎤 Audio added");
          }
        } catch (audioError) {
          console.warn("⚠️ Could not add audio:", audioError);
        }
      }

      // Configure MediaRecorder
      let mediaRecorder: MediaRecorder;
      let mimeType = "video/webm";

      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        mimeType = "video/webm;codecs=vp8";
      }

      mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: mimeType,
        videoBitsPerSecond: bitrate,
      });

      //console.log(
      //  `📼 MediaRecorder created with: ${mimeType}, ${bitrate / 1000000}Mbps`
      //);

      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          //console.log(
          //  `📦 Chunk received: ${event.data.size} bytes (Total: ${chunks.length})`
          //);
        }
      };

      mediaRecorder.onstop = () => {
        //console.log("🛑 Recording stopped. Chunks:", chunks.length);

        if (chunks.length === 0) {
          alert("Error: No data generated");
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `presentation-${videoQuality}-${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/:/g, "-")}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Recording saved! Duration: ${formatTime(recordingTime)}`);
      };

      // SET STATE BEFORE STARTING
      setIsRecording(true);
      setRecordingTime(0);

      // START LOOPS OF DRAWING AND TIME
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Loop of drawing with setInterval (more reliable than requestAnimationFrame)
      drawIntervalRef.current = setInterval(() => {
        drawFrame();
      }, 33); // ~30 FPS

      //console.log("🔄 Loops started");

      // Wait a bit for the loops to be established
      await new Promise((resolve) => setTimeout(resolve, 500));

      // START MEDIARECORDER
      mediaRecorder.start(1000);
      //console.log("🎬 MediaRecorder started");

      // Verify state
      setTimeout(() => {
        if (mediaRecorder.state !== "recording") {
          //console.error("❌ MediaRecorder not started correctly");
          alert("Error: Could not start recording");
        } else {
          //console.log("✅ Recording confirmed active");
        }
      }, 200);
    } catch (error) {
      //console.error("❌ Error complete:", error);
      alert(`Error: ${error.message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    //console.log("🛑 === STOPPING RECORDING ===");

    // Stop loops
    if (drawIntervalRef.current) {
      clearInterval(drawIntervalRef.current);
      drawIntervalRef.current = null;
      //console.log("🔄 Loop of drawing stopped");
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
      //console.log("⏱️ Loop of time stopped");
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      //console.log("📼 MediaRecorder stopped");
    }

    setIsRecording(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const nextSlide = () => {
    if (currentPage < pdfPages.length - 1) {
      setCurrentPage(currentPage + 1);
      //console.log(`➡️ Changing to slide ${currentPage + 2}`);
    }
  };

  const prevSlide = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      //console.log(`⬅️ Changing to slide ${currentPage}`);
    }
  };
  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDarkMode ? "dark bg-slate-900" : "bg-gray-50"
      }`}
    >
      <div className="flex h-screen text-foreground relative">
        {/* Mobile Menu Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 bg-background border-border"
        >
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-0
          w-64 sm:w-72 md:w-80 lg:w-64 xl:w-72
          bg-card border-r border-border p-3 sm:p-4 
          flex flex-col shadow-sm lg:shadow-none
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Theme toggle */}
          <div className="flex items-center justify-between mb-4 mt-12 lg:mt-0">
            <span className="text-sm font-medium">Theme</span>
            <div className="flex items-center space-x-2">
              <Sun className="w-4 h-4" />
              <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
              <Moon className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Video background</span>
          <input
            type="color"
            value={customBackgroundColor || getDefaultBackgroundColor()}
            onChange={(e) => {
              setCustomBackgroundColor(e.target.value);
              // Force immediate redraw if not recording
              if (!isRecording) {
                requestAnimationFrame(() => drawFrame());
              }
            }}
            className="w-8 h-8 rounded cursor-pointer border border-border"
            title="Select background color"
          />
        </div>

          <div className="mb-4 lg:mb-6">
            <label className="flex items-center justify-center w-full h-10 sm:h-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/50">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-muted-foreground" />
              <span className="text-xs sm:text-sm">Upload file</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-xs text-muted-foreground mt-1 block text-center">.pdf Files</span>
          </div>

          {/* Slides thumbnails */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {pdfPages.map((page, index) => (
              <div
                key={index}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 bg-card shadow-sm hover:shadow-md ${
                  currentPage === index
                    ? "border-primary ring-2 ring-primary/20 scale-105"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => {
                  setCurrentPage(index);
                  setSidebarOpen(false);
                }}
              >
                <canvas
                  ref={(el) => {
                    if (el && page.canvas) {
                      const ctx = el.getContext("2d")!;
                      const aspectRatio = page.canvas.height / page.canvas.width;
                      el.width = 160;
                      el.height = 160 * aspectRatio;

                      ctx.fillStyle = "#ffffff";
                      ctx.fillRect(0, 0, el.width, el.height);
                      ctx.drawImage(page.canvas, 0, 0, el.width, el.height);
                    }
                  }}
                  className="w-full"
                />
                <div className="absolute bottom-1 left-1 bg-black/75 text-white text-xs px-2 py-1 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-card border-b border-border p-2 sm:p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2 sm:space-x-4 ml-12 lg:ml-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">
                <span className="hidden sm:inline">Presentation Recorder</span>
                <span className="sm:hidden">Recorder</span>
              </h1>
              {isRecording && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-500 font-mono text-sm sm:text-base">
                    {formatTime(recordingTime)}
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="hidden sm:flex"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 mr-2" />
              ) : (
                <Maximize className="w-4 h-4 mr-2" />
              )}
              <span className="hidden md:inline">
                {isFullscreen ? "Exit" : "Fullscreen"}
              </span>
            </Button>
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            {/* Camera section */}
            <div className="w-full lg:w-64 xl:w-80 bg-card border-b lg:border-b-0 lg:border-r border-border p-2 sm:p-4 flex-shrink-0">
              <div className="mb-2 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold mb-2">Camera</h3>
                <Card className="bg-muted border-border">
                  <div className="aspect-[4/3] lg:aspect-[3/4] bg-black rounded-lg overflow-hidden relative">
                    {cameraEnabled ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <CameraOff className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Camera disabled
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Click on "Show Camera"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {/* Presentation area */}
            <div
              className="flex-1 flex flex-col overflow-hidden min-w-0"
              ref={presentationRef}
            >
              <div className="flex-1 flex items-center justify-center bg-muted/30 p-2 sm:p-4 overflow-hidden min-h-0">
                {pdfPages.length > 0 ? (
                  <div className="relative bg-white rounded-lg shadow-xl p-2 sm:p-4 lg:p-6 flex items-center justify-center w-full h-full max-w-full max-h-full overflow-hidden">
                    <canvas
                      ref={(el) => {
                        if (el && pdfPages[currentPage]) {
                          const page = pdfPages[currentPage];
                          const ctx = el.getContext("2d")!;

                          const container = el.parentElement!;
                          const containerRect = container.getBoundingClientRect();
                          const maxWidth = containerRect.width - (window.innerWidth < 640 ? 20 : 100);
                          const maxHeight = containerRect.height - (window.innerWidth < 640 ? 20 : 100);

                          const pageAspect = page.canvas.width / page.canvas.height;

                          let displayWidth = maxWidth;
                          let displayHeight = maxWidth / pageAspect;

                          if (displayHeight > maxHeight) {
                            displayHeight = maxHeight;
                            displayWidth = maxHeight * pageAspect;
                          }

                          el.width = displayWidth;
                          el.height = displayHeight;
                          el.style.width = `${displayWidth}px`;
                          el.style.height = `${displayHeight}px`;

                          ctx.fillStyle = "#ffffff";
                          ctx.fillRect(0, 0, displayWidth, displayHeight);
                          ctx.drawImage(page.canvas, 0, 0, displayWidth, displayHeight);
                        }
                      }}
                      className="border-2 border-gray-300 rounded-lg shadow-lg max-w-full max-h-full"
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <Monitor className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg sm:text-xl font-semibold mb-2">PRESENTATION</h3>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      Upload a PDF file to start
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                      Use ← → to navigate
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation */}
              {pdfPages.length > 0 && (
                <div className="flex items-center justify-between p-2 sm:p-4 bg-card border-t border-border flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevSlide}
                    disabled={currentPage === 0}
                    className="text-xs sm:text-sm"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </Button>

                  <span className="text-xs sm:text-sm text-muted-foreground px-2">
                    {currentPage + 1} of {pdfPages.length}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextSlide}
                    disabled={currentPage === pdfPages.length - 1}
                    className="text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom controls */}
          <div className="bg-card border-t border-border p-2 sm:p-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2 lg:space-x-4">
              {/* First row on mobile, left side on desktop */}
              <div className="flex items-center space-x-2 order-2 sm:order-1">
                <Button
                  variant={cameraEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleCamera}
                  className={`text-xs sm:text-sm ${
                    cameraEnabled ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {cameraEnabled ? (
                    <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (
                    <CameraOff className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                  <span className="ml-1 sm:ml-0 sm:hidden lg:inline">
                    {cameraEnabled ? "Hide" : "Show"} Camera
                  </span>
                </Button>

                <Button
                  variant={micEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleMic}
                  className={`text-xs sm:text-sm ${
                    micEnabled ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {micEnabled ? (
                    <Mic className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (
                    <MicOff className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                  <span className="ml-1 sm:ml-0 sm:hidden lg:inline">
                    Microphone
                  </span>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleFullscreen}
                  className="sm:hidden text-xs"
                >
                  <Maximize className="w-3 h-3" />
                </Button>
              </div>

              {/* Quality selector */}
              <div className="flex items-center space-x-2 order-3 sm:order-2">
                  <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                    Quality:
                  </span>
                <select
                  value={videoQuality}
                  onChange={(e) =>
                    setVideoQuality(e.target.value as "HD" | "FHD" | "4K")
                  }
                  disabled={isRecording}
                  className="px-2 py-1 text-xs sm:text-sm border border-border rounded-md bg-background text-foreground disabled:opacity-50 min-w-0"
                >
                  <option value="HD">HD (720p)</option>
                  <option value="FHD">FHD (1080p)</option>
                  <option value="4K">4K (2160p)</option>
                </select>
              </div>

              {/* Record button */}
              <div className="order-1 sm:order-3">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    disabled={pdfPages.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm px-4 sm:px-6"
                    size="sm"
                  >
                    <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Record
                  </Button>
                ) : (
                  <Button 
                    onClick={stopRecording} 
                    variant="destructive"
                    className="text-xs sm:text-sm px-4 sm:px-6"
                    size="sm"
                  >
                    <Square className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Stop
                  </Button>
                )}
            
                <Link 
                  href="https://github.com/diegoperea20/presentation-recording" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-2"
                  title="View on GitHub"
                >
                  <Github className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden canvas for recording */}
        <canvas ref={canvasRef} className="hidden" width={1920} height={1080} />
      </div>
    </div>
  );
}