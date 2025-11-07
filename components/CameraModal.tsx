
import React, { useRef, useEffect, useState } from 'react';

interface CameraModalProps {
    onCapture: (dataUrl: string) => void;
    onClose: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mediaStream: MediaStream;
        
        const startCamera = async () => {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    setStream(mediaStream);
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Could not access the camera. Please ensure permissions are granted in your browser settings.");
            }
        };

        startCamera();

        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCaptureClick = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                const video = videoRef.current;
                canvasRef.current.width = video.videoWidth;
                canvasRef.current.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
                onCapture(dataUrl);
            }
        }
    };

    return (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center"
          onClick={onClose}
        >
          <div 
            className="bg-brand-gray-900 rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden m-4"
            onClick={(e) => e.stopPropagation()}
          >
             <header className="flex justify-between items-center p-4 border-b border-brand-gray-700 sticky top-0 bg-brand-gray-900 z-10">
                <h2 className="text-lg font-semibold text-white">Capture Receipt</h2>
                <button 
                    onClick={onClose} 
                    className="text-brand-gray-400 hover:text-white"
                    aria-label="Close camera"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </header>
            <div className="p-2 relative flex-grow flex items-center justify-center">
                {error ? (
                    <div className="text-center text-red-400 p-8">{error}</div>
                ) : (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain"></video>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            </div>
            <footer className="p-4 bg-brand-gray-900 border-t border-brand-gray-700">
                <button
                    onClick={handleCaptureClick}
                    disabled={!stream}
                    className="w-full bg-brand-blue text-white font-semibold py-3 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-brand-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Capture Photo
                </button>
            </footer>
          </div>
        </div>
    );
};
