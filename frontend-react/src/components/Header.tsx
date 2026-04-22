import { Languages, Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full py-8 mb-8 text-center animate-fade-in relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-accent-blue/10 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
      
      <div className="inline-flex items-center justify-center space-x-3 mb-4 px-4 py-1.5 rounded-full border border-border bg-secondary/50 backdrop-blur-sm">
        <Sparkles className="w-4 h-4 text-accent-teal" />
        <span className="text-sm font-medium tracking-wider text-text-muted uppercase">Google TMT Hackathon 2026</span>
      </div>
      
      <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
        Seamless <span className="text-gradient">Translation</span>
      </h1>
      
      <p className="text-lg text-text-muted max-w-2xl mx-auto flex items-center justify-center gap-2">
        <Languages className="w-5 h-5" />
        Preserve layout and format across English, Nepali, and Tamang.
      </p>
    </header>
  );
}
