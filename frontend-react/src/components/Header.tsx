
export function Header() {
  return (
    <header className="w-full pt-6 pb-8 mb-6 animate-fade-in">
      {/* Top branding row */}
      <div className="flex items-center justify-center gap-5 mb-6">
        <img src="/ku-logo.png" alt="Kathmandu University" className="w-16 h-16 flex-shrink-0 object-contain" />

        <div className="text-left">
          <p className="text-xs font-semibold tracking-widest text-accent-blue uppercase mb-0.5">
            Kathmandu University
          </p>
          <h2 className="text-xl font-bold text-text-main leading-tight tracking-wide">
            TMT Unified Translator
          </h2>
          <p className="text-xs text-text-muted mt-0.5 tracking-wide">
            Google TMT Hackathon 2026
          </p>
        </div>
      </div>

      {/* Dhaka-border divider */}
      <div className="w-full h-px mb-8" style={{
        background: 'linear-gradient(to right, transparent, #1e6ebe, #f0f0f0, #c8001f, #1b7340, #d4a017, transparent)'
      }} />

      {/* Main headline */}
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
          <span className="text-gradient">English</span>
          <span className="text-text-muted font-light opacity-50">|</span>
          <span className="text-gradient font-nepali">नेपाली</span>
          <span className="text-text-muted font-light opacity-50">|</span>
          <span className="text-gradient font-tamang">तामाङ</span>
        </h1>
        <p className="text-lg text-text-main font-medium mb-2 tracking-wide">
          Professional Document Translation
        </p>
        <p className="text-base text-text-muted max-w-xl mx-auto leading-relaxed">
          Translate files seamlessly between languages while fully preserving your original formatting, images, and layouts.
        </p>
      </div>
    </header>
  );
}
