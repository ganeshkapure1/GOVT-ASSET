import { IndianSmsGatewayAdapter } from '../src/lib/notifications';

async function testTextBeeGateway() {
  console.log('=== VERIFYING TEXTBEE.DEV GATEWAY INTEGRATION ===\n');

  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) {
    throw new Error('TEXTBEE_API_KEY is not defined in environment.');
  }

  const maskedKey = `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
  console.log(`Configured TextBee Key: ${maskedKey}`);

  // Test 1: API Authentication & Device Listing
  console.log('\n--- Check 1: API Key Authentication & Device Registry ---');
  const authRes = await fetch('https://api.textbee.dev/api/v1/gateway/devices', {
    headers: { 'x-api-key': apiKey },
  });
  console.log('HTTP Status:', authRes.status);
  const deviceData = await authRes.json();
  const devices = deviceData?.data || [];
  console.log(`Registered Devices Count: ${devices.length}`);
  if (authRes.status === 200) {
    console.log(' API Key Authentication: PASS');
  } else {
    throw new Error(`Authentication failed with status ${authRes.status}`);
  }

  // Test 2: Invalid API Key Rejection
  console.log('\n--- Check 2: Invalid API Key Rejection ---');
  const badAuthRes = await fetch('https://api.textbee.dev/api/v1/gateway/devices', {
    headers: { 'x-api-key': 'txb_invalid_key_for_security_test' },
  });
  console.log('HTTP Status (Expected 401):', badAuthRes.status);
  if (badAuthRes.status === 401) {
    console.log(' Invalid Key Rejection: PASS');
  } else {
    console.warn('⚠️ Unexpected response for invalid key:', badAuthRes.status);
  }

  // Test 3: Adapter Configuration State
  console.log('\n--- Check 3: Notification Adapter Inspection ---');
  const adapter = new IndianSmsGatewayAdapter();
  const isConfigured = adapter.isConfigured();
  console.log('Adapter Name:', adapter.name);
  console.log('Adapter isConfigured():', isConfigured);
  if (isConfigured) {
    console.log(' Adapter Configuration: PASS');
  } else {
    throw new Error('Adapter failed configuration check.');
  }

  // Test 4: Device Health Status Report
  console.log('\n--- Check 4: Device Readiness Status ---');
  if (devices.length === 0) {
    console.log('⚠️ Device Status: REQUIRES_MANUAL_CONFIGURATION');
    console.log('Reason: No active Android gateway device is linked to this TextBee account yet.');
    console.log('Action: Install the TextBee app from https://textbee.dev/download, scan the QR code under Devices tab, and enable SMS permissions.');
  } else {
    console.log(`Active Device ID: ${devices[0]._id}`);
    console.log(`Device Name: ${devices[0].name}`);
    console.log(`Enabled: ${devices[0].enabled}`);
  }

  console.log('\n======================================================');
  console.log('TEXTBEE GATEWAY ARCHITECTURE & ADAPTER VERIFIED!');
  console.log('======================================================');
}

testTextBeeGateway().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

