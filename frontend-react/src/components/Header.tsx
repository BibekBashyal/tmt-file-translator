
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
          <h2 className="text-xl font-bold text-text-main leading-tight">
            TMT भाषा अनुवादक
          </h2>
          <p className="text-xs text-text-muted mt-0.5 tracking-wide">
            File Translation Tool · Google TMT Hackathon 2026
          </p>
        </div>
      </div>

      {/* Dhaka-border divider */}
      <div className="w-full h-px mb-6" style={{
        background: 'linear-gradient(to right, transparent, #1e6ebe, #f0f0f0, #c8001f, #1b7340, #d4a017, transparent)'
      }} />

      {/* Main headline */}
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
          <span className="text-gradient">लेआउट-संरक्षित</span>{' '}
          <span className="text-text-main">अनुवाद</span>
        </h1>
        <p className="text-base text-text-muted max-w-xl mx-auto">
          Translate documents between{' '}
          <span className="text-text-main font-medium">English</span>,{' '}
          <span className="text-text-main font-medium">नेपाली</span>, and{' '}
          <span className="text-text-main font-medium">तामाङ</span>{' '}
          — exact layout preserved.
        </p>
      </div>
    </header>
  );
}
