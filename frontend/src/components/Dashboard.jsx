import React from 'react';
import MetricCard from './MetricCard';
import Chart from './Chart';

const UNIT_BY_CATEGORY = {
  system: '%',
  network: ' Mbps'
};

function groupByName(metrics) {
  const groups = new Map();
  metrics.forEach((metric) => {
    if (!groups.has(metric.name)) {
      groups.set(metric.name, []);
    }
    groups.get(metric.name).push(metric);
  });
  return groups;
}

function toSeries(entries) {
  return [...entries]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((entry) => ({
      label: new Date(entry.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      value: entry.value
    }));
}

function Dashboard({ metrics, loading, error }) {
  if (loading) {
    return <p className="text-gray-500">Carregando métricas...</p>;
  }

  if (error) {
    return (
      <p className="text-red-600">
        Erro ao carregar métricas: {error}
      </p>
    );
  }

  const groups = groupByName(metrics);
  const latestByName = [...groups.entries()].map(([name, entries]) => {
    const latest = entries[entries.length - 1];
    return { ...latest, unit: UNIT_BY_CATEGORY[latest.category] || '' };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {latestByName.map((metric) => (
          <MetricCard
            key={metric.name}
            title={metric.name}
            value={metric.value}
            unit={metric.unit}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...groups.entries()].map(([name, entries]) => (
          <Chart key={name} title={name} data={toSeries(entries)} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
