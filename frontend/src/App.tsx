import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DomainSelection } from './pages/DomainSelection';
import { Dashboard } from './pages/Dashboard';
import { AssetDetail } from './pages/AssetDetail';
import { RealWorldEvidence } from './pages/RealWorldEvidence';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DomainSelection />} />
        <Route path="/app/transportation" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assets/:assetId" element={<AssetDetail />} />
        <Route path="/evidence" element={<RealWorldEvidence />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
