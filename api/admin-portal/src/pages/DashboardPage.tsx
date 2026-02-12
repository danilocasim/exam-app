import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { AdminStats } from '../services/api';
import { useSelectedExamType } from '../components/Layout';

/**
 * T099: Dashboard page with stats overview
 */
export function DashboardPage() {
  const { selectedExamType, examTypes } = useSelectedExamType();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const currentExamType = examTypes.find((et) => et.id === selectedExamType);

  useEffect(() => {
    if (!selectedExamType) return;
    setLoading(true);
    api
      .getStats(selectedExamType)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedExamType]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        Loading stats...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        No data available
      </div>
    );
  }

  return (
    <div>
      <h1 style={styles.title}>
        Dashboard{currentExamType ? ` — ${currentExamType.displayName}` : ''}
      </h1>

      <div style={styles.statsGrid}>
        <StatCard
          label="Total Questions"
          value={stats.totalQuestions}
          color="#1677ff"
        />
        <StatCard label="Draft" value={stats.byStatus.draft} color="#999" />
        <StatCard
          label="Pending Review"
          value={stats.byStatus.pending}
          color="#d48806"
        />
        <StatCard
          label="Approved"
          value={stats.byStatus.approved}
          color="#389e0d"
        />
        <StatCard
          label="Archived"
          value={stats.byStatus.archived}
          color="#cf1322"
        />
      </div>

      <h2 style={styles.sectionTitle}>Questions by Domain</h2>
      <div style={styles.domainGrid}>
        {Object.entries(stats.byDomain).map(([domain, count]) => {
          const domainInfo = currentExamType?.domains.find(
            (d) => d.id === domain,
          );
          return (
            <div key={domain} style={styles.domainCard}>
              <div style={styles.domainName}>{domainInfo?.name || domain}</div>
              <div style={styles.domainCount}>{count}</div>
              {domainInfo && (
                <div style={styles.domainTarget}>
                  Target: {domainInfo.questionCount}
                </div>
              )}
            </div>
          );
        })}
        {Object.keys(stats.byDomain).length === 0 && (
          <div style={{ color: '#999', fontSize: 14, padding: 16 }}>
            No questions yet for this exam type
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 24,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    background: '#fff',
    borderRadius: 6,
    padding: 20,
    border: '1px solid #e8e8e8',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 16,
  },
  domainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },
  domainCard: {
    background: '#fff',
    borderRadius: 6,
    padding: 16,
    border: '1px solid #e8e8e8',
  },
  domainName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#333',
    marginBottom: 4,
  },
  domainCount: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1677ff',
  },
  domainTarget: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
};
