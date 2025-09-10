import Layout from '@/components/Layout';
import ChatInterface from '@/components/ChatInterface';
import FeatureGuard from '@/components/FeatureGuard';

export default function ChatPage() {
  return (
    <Layout>
      <FeatureGuard 
        feature="chat" 
        warningMessage="Phoenix AI DevOps Engineer is not enabled for your organization. Please reach out to the support team to enable this feature."
      >
        <ChatInterface />
      </FeatureGuard>
    </Layout>
  );
}