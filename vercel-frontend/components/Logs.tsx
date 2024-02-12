'use client';

import { useEffect, useState } from 'react';
import { JsonView, allExpanded, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

const Logs = ({ url }: { url: string }) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(url);
        const data = await response.json();
        setLogs(data?.logs);
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    };

    fetchData();
  }, []);
  return (
    <div className="bg-[#eeeeee] py-3 px-2 rounded-md">
      <JsonView
        data={logs}
        shouldExpandNode={allExpanded}
        style={defaultStyles}
      />
    </div>
  );
};

export default Logs;
