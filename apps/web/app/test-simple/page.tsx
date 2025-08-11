'use client';

export default function SimpleTestPage() {
  console.log('SimpleTestPage: Rendering');
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Simple Test Page</h1>
      <p>This is a minimal page to test if Next.js is working</p>
      <p>If you see this, Next.js components are rendering correctly</p>
    </div>
  );
}