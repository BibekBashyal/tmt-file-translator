import { RotateCcw, Zap, Layers, Server, Clock } from 'lucide-react';
import { TranslationStats } from '../types';

interface ResultPanelProps {
  stats: TranslationStats | null;
  onReset: () => void;
}

export function ResultPanel({ stats, onReset }: ResultPanelProps) {
  if (!stats) return null;

  const { segmentCount, cacheHits, apiCalls, processingTimeMs } = stats;
  const cacheHitRate = segmentCount > 0 ? Math.round((cacheHits / segmentCount) * 100) : 0;

  return (
    <div className="glass-panel rounded-2xl p-8 animate-slide-up mt-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-text-main mb-2">Translation Successful</h2>
          <p className="text-text-muted">Your file has been downloaded automatically.</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium border border-border hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Translate Again
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<Layers className="w-5 h-5 text-blue-400" />}
          label="Segments"
          value={segmentCount.toString()}
          color="bg-blue-500/10 border-blue-500/20"
        />
        <StatCard 
          icon={<Zap className="w-5 h-5 text-yellow-400" />}
          label="Cache Hits"
          value={`${cacheHitRate}%`}
          desc={`(${cacheHits} reused)`}
          color="bg-yellow-500/10 border-yellow-500/20"
        />
        <StatCard 
          icon={<Server className="w-5 h-5 text-purple-400" />}
          label="API Calls"
          value={apiCalls.toString()}
          color="bg-purple-500/10 border-purple-500/20"
        />
        <StatCard 
          icon={<Clock className="w-5 h-5 text-teal-400" />}
          label="Time"
          value={`${(processingTimeMs / 1000).toFixed(2)}s`}
          color="bg-teal-500/10 border-teal-500/20"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, desc, color }: { icon: React.ReactNode, label: string, value: string, desc?: string, color: string }) {
  return (
    <div className={`p-5 rounded-xl border ${color} flex flex-col items-start gap-3`}>
      <div className="p-2 bg-white/5 rounded-lg border border-border">
        {icon}
      </div>
      <div>
        <p className="text-sm text-text-muted mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text-main">{value}</span>
          {desc && <span className="text-xs text-text-muted">{desc}</span>}
        </div>
      </div>
    </div>
  );
}
