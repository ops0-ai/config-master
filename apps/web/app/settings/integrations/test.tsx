'use client';

import { useState, useEffect } from 'react';

export default function IntegrationsTest() {
  console.log('IntegrationsTest component mounting...');
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1>Test Integrations Page</h1>
      <p>If you see this, the component is working</p>
    </div>
  );
}