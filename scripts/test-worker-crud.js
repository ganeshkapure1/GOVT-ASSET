async function test() {
  console.log('--- 1. Login as Officer Sachin ---');
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({ email: 'officer.csmc@govasset.in', password: 'password123' })
  });

  const cookies = loginRes.headers.get('set-cookie');
  console.log('Login Status:', loginRes.status, 'Has Cookies:', Boolean(cookies));
  if (!cookies) return;

  console.log('\n--- 2. Fetch Workers List ---');
  const getWorkersRes = await fetch('http://localhost:3000/api/v1/ops/workers?includeInactive=true', {
    headers: {
      'Cookie': cookies,
      'Origin': 'http://localhost:3000'
    }
  });
  const workersJson = await getWorkersRes.json();
  console.log('Workers fetch status:', getWorkersRes.status, 'Total workers:', workersJson.data?.length);

  const testWorker = workersJson.data?.[0];
  if (!testWorker) {
    console.log('No workers found to test toggle.');
    return;
  }

  console.log('\n--- 3. Testing Worker Deactivation on:', testWorker.fullName, 'Current Active:', testWorker.isActive);
  const toggleRes = await fetch('http://localhost:3000/api/v1/ops/workers', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({
      workerId: testWorker.id,
      isActive: !testWorker.isActive
    })
  });
  const toggleJson = await toggleRes.json();
  console.log('Toggle response status:', toggleRes.status, toggleJson);

  // Toggle back to original state
  console.log('\n--- 4. Restoring Worker to original state ---');
  const restoreRes = await fetch('http://localhost:3000/api/v1/ops/workers', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({
      workerId: testWorker.id,
      isActive: testWorker.isActive
    })
  });
  const restoreJson = await restoreRes.json();
  console.log('Restore response status:', restoreRes.status, restoreJson);

  console.log('\n--- 5. Testing Onboarding New Worker ---');
  const uniqueCode = 'WRK-' + Date.now().toString().slice(-4);
  const uniquePhone = '+9198' + Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8);
  const uniqueEmail = `test.worker.${Date.now()}@govasset.in`;

  const createRes = await fetch('http://localhost:3000/api/v1/ops/workers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({
      fullName: 'Sunil Kumar (Electrician)',
      phoneNumber: uniquePhone,
      email: uniqueEmail,
      staffCode: uniqueCode,
      designation: 'Streetlight Maintenance Technician',
      skills: 'Streetlight, Electrical, Wiring, Transformer Repair',
      password: 'password123'
    })
  });
  const createJson = await createRes.json();
  console.log('Create Worker response status:', createRes.status, createJson);
}

test().catch(console.error);

