import { Files, FileText, HardDrive, Cpu } from 'lucide-react';

interface StatsDashboardProps {
  filesCount: number;
  totalPages: number;
  totalSizeBytes: number;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function StatsDashboard({ filesCount, totalPages, totalSizeBytes }: StatsDashboardProps) {
  // Estimate output size to be ~95% of sum due to potential overlapping stream resources, or roughly the same
  const estimatedOutputSize = Math.max(0, Math.round(totalSizeBytes * 0.96));

  const stats = [
    {
      label: 'PDFs Uploaded',
      value: filesCount,
      icon: Files,
      color: 'text-primary bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400',
    },
    {
      label: 'Total Pages',
      value: totalPages,
      icon: FileText,
      color: 'text-secondary bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400',
    },
    {
      label: 'Total Size',
      value: formatBytes(totalSizeBytes),
      icon: HardDrive,
      color: 'text-accent bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400',
    },
    {
      label: 'Output Estimate',
      value: formatBytes(estimatedOutputSize),
      icon: Cpu,
      color: 'text-success bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="flex flex-col p-4 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-premium hover:shadow-premium-hover transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">
                {stat.label}
              </span>
              <div className={`p-2 rounded-xl ${stat.color} transition-colors duration-200`}>
                <Icon size={16} />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {stat.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
