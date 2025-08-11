// Test GitHub OAuth callback by visiting the integrations page with success data
const testGitHubCallback = () => {
  const mockData = {
    user: {
      id: 123,
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://github.com/images/error/testuser_happy.gif'
    },
    repositories: [
      {
        id: 456,
        name: 'test-repo',
        full_name: 'testuser/test-repo',
        private: false,
        default_branch: 'main',
        description: 'A test repository',
        html_url: 'https://github.com/testuser/test-repo'
      }
    ],
    accessToken: 'gho_test_token_123',
    userId: 'ae76aed9-dd6b-4f55-9559-08466a782e73',
    organizationId: 'eb602306-9701-4b99-845d-371833d9fcd6'
  };

  const encodedData = Buffer.from(JSON.stringify(mockData)).toString('base64');
  const testUrl = `http://localhost:3000/settings/integrations?success=true&data=${encodedData}`;
  
  console.log('Test URL for GitHub OAuth callback:');
  console.log(testUrl);
  console.log('\nYou can test this by:');
  console.log('1. Opening the URL in your browser');
  console.log('2. Checking browser console for logs');
  console.log('3. Verifying the GitHub setup modal appears');
};

testGitHubCallback();