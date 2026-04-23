"use client";

import { Badge } from "@/components/ui/badge";
import { SEV_LABELS } from "@/lib/zabbix";
import { cn } from "@/lib/utils";

const SEV_STYLES: Record<number, string> = {
  0: "bg-muted text-muted-foreground border-border",
  1: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  2: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400",
  3: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  4: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  5: "bg-red-600/20 text-red-700 border-red-600/30 dark:text-red-400 font-bold",
};

interface Props {
  severity: number | string;
  className?: string;
}

export function SeverityBadge({ severity, className }: Props) {
  const sev = Number(severity ?? 0);
  const label = SEV_LABELS[sev] ?? "?";
  const style = SEV_STYLES[sev] ?? SEV_STYLES[0];

  return (
    <Badge variant="outline" className={cn(style, className)}>
      {label}
    </Badge>
  );
}
