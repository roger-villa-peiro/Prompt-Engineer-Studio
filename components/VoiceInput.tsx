import React, { useState, useEffect, useCallback } from 'react';

// Define the SpeechRecognition interface for TypeScript
interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: Event) => void;
    onend: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    className?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, className = '' }) => {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setIsSupported(false);
        }
    }, []);

    const startListening = useCallback(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0][0].transcript;
            onTranscript(transcript);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
        setIsListening(true);
    }, [onTranscript]);

    if (!isSupported) {
        return (
            <button
                disabled
                title="Speech recognition not supported in this browser"
                className={`p-2 rounded-lg bg-surface-dark text-text-tertiary cursor-not-allowed opacity-50 ${className}`}
            >
                <MicrophoneIcon />
            </button>
        );
    }

    return (
        <button
            onClick={startListening}
            disabled={isListening}
            title={isListening ? 'Listening...' : 'Click to speak'}
            className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${isListening
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'bg-surface-dark hover:bg-primary/20 text-text-secondary hover:text-primary'
                } ${className}`}
        >
            <MicrophoneIcon />
        </button>
    );
};

const MicrophoneIcon: React.FC = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5"
    >
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1a1 1 0 0 1 2 0v1a5 5 0 0 0 10 0v-1a1 1 0 0 1 2 0Z" />
        <path d="M12 21a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1Z" />
    </svg>
);

export default VoiceInput;
