import React, { useEffect, useState } from 'react';
import Dashboard from '../components/Dashboard';

function HomePage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return <Dashboard data={data} />;
}

export default HomePage;
