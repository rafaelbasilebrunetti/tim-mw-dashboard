import React from 'react';

function MetricCard({ title, value, unit }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </h3>
      <p className="mt-2 text-2xl font-bold text-blue-700">
        {value}
        {unit ? unit : ''}
      </p>
    </div>
  );
}

export default MetricCard;
