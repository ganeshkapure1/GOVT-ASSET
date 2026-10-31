async function test() {
  // 1. Login as Sachin (OFFICER)
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({ email: 'officer.csmc@govasset.in', password: 'password123' })
  });

  const cookies = loginRes.headers.get('set-cookie');
  const loginJson = await loginRes.json();
  console.log('Login status:', loginRes.status, 'Cookie exists:', Boolean(cookies), 'User:', loginJson.data?.user?.fullName);

  if (!cookies) return;

  // 2. Query Queue with dept=all & ward=all
  const queueRes = await fetch('http://localhost:3000/api/v1/ops/queue?dept=all&ward=all', {
    headers: {
      'Cookie': cookies,
      'Origin': 'http://localhost:3000'
    }
  });

  const queueJson = await queueRes.json();
  console.log('Queue fetch success:', queueJson.success);
  if (queueJson.success && queueJson.data) {
    console.log('Total complaints in queue:', queueJson.data.length);
    const categories = new Set(queueJson.data.map(c => c.category?.nameEn || c.title));
    console.log('Categories present:', Array.from(categories));
    for (const item of queueJson.data) {
      console.log(`- [${item.referenceNumber}] (${item.status}) ${item.category?.nameEn || item.title}`);
    }
  } else {
    console.log('Queue error:', queueJson.error);
  }

  // 3. Test verification on WORK_COMPLETED item (e.g. GOV-2026-00022)
  const verifyRes = await fetch('http://localhost:3000/api/v1/ops/complaints/2fd8ac41-2e86-4341-9d7c-22166ceb595a/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({ action: 'APPROVE', notes: 'Officer approved test verification.' })
  });

  const verifyJson = await verifyRes.json();
  console.log('Verification test status:', verifyRes.status, 'Response:', verifyJson);
}

test().catch(console.error);
