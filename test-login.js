// Simple test to simulate login and check if it works
const testLogin = async () => {
  try {
    // Test login API
    const response = await fetch('http://localhost:5005/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@pulse.dev',
        password: 'demo123'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful');
      console.log('Token:', data.token.substring(0, 50) + '...');
      console.log('User:', data.user);
      console.log('Organization:', data.organization);
      
      // Test if we can access protected routes
      const serversResponse = await fetch('http://localhost:5005/api/servers', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      
      console.log('Protected route status:', serversResponse.status);
      if (serversResponse.ok) {
        console.log('✅ Protected routes accessible');
      }
      
      return data;
    } else {
      console.error('❌ Login failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testLogin();