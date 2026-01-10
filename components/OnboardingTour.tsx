import React, { useState, useEffect } from 'react';

const TOUR_STEPS = [
    {
        title: "Welcome to Architect 3.0",
        description: "Your professional Cognitive Intelligence Tier environment for prompt engineering. Let's take a quick tour.",
        target: "body" // Center
    },
    {
        title: "The Editor",
        description: "Write your prompts here. Use the 'New Prompt' placeholder to get started.",
        target: "textarea"
    },
    {
        title: "Global Context",
        description: "Add background info, documentation, or guidelines here to ground the AI.",
        target: "button[title='Global Context']"
    },
    {
        title: "Evaluation System",
        description: "Click here to get instant quality scores, toxicity checks, and cost estimates.",
        target: "button:contains('Evaluate')" // Pseudo-selector logic needed in impl
    },
    {
        title: "Metacognitive Refine",
        description: "The magic button. Transforms basic prompts into professional architectures using AI reasoning.",
        target: "button:contains('Refine')"
    },
    {
        title: "Multi-Model Arena",
        description: "Compare your prompt against different models side-by-side using the Layers icon.",
        target: "button[title='Multi-Model Comparison']" // We added this title earlier
    }
];

export const OnboardingTour: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenV3Tour');
        if (!hasSeenTour) {
            setTimeout(() => setIsVisible(true), 1000); // Delay start
        }
    }, []);

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(curr => curr + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem('hasSeenV3Tour', 'true');
    };

    if (!isVisible) return null;

    const step = TOUR_STEPS[currentStep];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="relative bg-surface-dark border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl mx-4">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}></div>

                <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                        Step {currentStep + 1} of {TOUR_STEPS.length}
                    </span>
                    <button onClick={handleComplete} className="text-slate-500 hover:text-white">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>

                <h2 className="text-xl font-bold mb-2">{step.title}</h2>
                <p className="text-slate-300 text-sm mb-8 leading-relaxed">
                    {step.description}
                </p>

                <div className="flex justify-between items-center">
                    <button
                        onClick={handleComplete}
                        className="text-xs font-bold text-slate-500 hover:text-white uppercase"
                    >
                        Skip Tour
                    </button>
                    <button
                        onClick={handleNext}
                        className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-all"
                    >
                        {currentStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
