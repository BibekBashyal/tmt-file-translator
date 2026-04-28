interface ChipProps {
  icon: React.ReactNode;
  label: string;
  variant?: 'teal';
}

export function Chip({ icon, label, variant }: ChipProps) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
        variant === 'teal'
          ? 'bg-accent-teal/10 border-accent-teal/20 text-accent-teal'
          : 'bg-white/5 border-border text-text-muted'
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
