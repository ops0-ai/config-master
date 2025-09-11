import Layout from '@/components/Layout';
import IACChatInterface from '@/components/IACChatInterface';

export default function IaCPage() {
  return (
    <Layout>
      <div className="h-full">
        <IACChatInterface />
      </div>
    </Layout>
  );
}