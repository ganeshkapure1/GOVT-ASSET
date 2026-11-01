import { POST as loginPost } from '../src/app/api/v1/auth/login/route';
import { POST as otpRequestPost } from '../src/app/api/v1/auth/otp/request/route';
import { POST as otpVerifyPost } from '../src/app/api/v1/auth/otp/verify/route';
import { NextRequest } from 'next/server';

function createPostRequest(url: string, body: any) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'host': 'localhost:3000',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

async function testAllPortals() {
  console.log('=== VERIFYING ALL 3 GOVASSET AUTHENTICATION PORTALS ===\n');

  // 1. Government Official Login
  console.log('--- Portal 1: Government Official Portal ---');
  const officialReq = createPostRequest('http://localhost:3000/api/v1/auth/login', {
    email: 'officer.csmc@govasset.in',
    password: 'password123',
    portalType: 'OFFICIAL',
  });
  const officialRes = await loginPost(officialReq);
  const officialData = await officialRes.json();
  console.log('Status:', officialRes.status);
  console.log('User Role:', officialData.user?.role);
  console.log('Redirect Destination:', officialData.redirectTo);
  if (officialRes.status !== 200 || officialData.user?.role !== 'OFFICER') {
    throw new Error('Official login failed: ' + JSON.stringify(officialData));
  }
  console.log(' Official Login: PASS');

  // 2. Field Worker Login (via Email)
  console.log('\n--- Portal 2A: Field Worker Portal (Email: field.csmc@govasset.in) ---');
  const workerReq = createPostRequest('http://localhost:3000/api/v1/auth/login', {
    email: 'field.csmc@govasset.in',
    password: 'password123',
    portalType: 'WORKER',
  });
  const workerRes = await loginPost(workerReq);
  const workerData = await workerRes.json();
  console.log('Status:', workerRes.status);
  console.log('User Role:', workerData.user?.role);
  console.log('Redirect Destination:', workerData.redirectTo);
  if (workerRes.status !== 200 || workerData.user?.role !== 'FIELD_WORKER') {
    throw new Error('Worker login failed: ' + JSON.stringify(workerData));
  }
  console.log(' Worker Login (Email): PASS');

  // 2B. Field Worker Login (via Staff Code: CSMC-100 / Ramesh)
  console.log('\n--- Portal 2B: Field Worker Portal (Staff Code: CSMC-100) ---');
  const rameshReq = createPostRequest('http://localhost:3000/api/v1/auth/login', {
    staffCode: 'CSMC-100',
    password: 'password123',
    portalType: 'WORKER',
  });
  const rameshRes = await loginPost(rameshReq);
  const rameshData = await rameshRes.json();
  console.log('Status:', rameshRes.status);
  console.log('User:', rameshData.user?.fullName);
  console.log('Role:', rameshData.user?.role);
  if (rameshRes.status !== 200 || rameshData.user?.role !== 'FIELD_WORKER') {
    throw new Error('Worker staff code login failed: ' + JSON.stringify(rameshData));
  }
  console.log(' Worker Login (Staff Code): PASS');

  // 3. Citizen Mobile OTP Login
  console.log('\n--- Portal 3: Citizen Mobile OTP Portal ---');
  const citizenPhone = '+919822010108';
  const otpReq = createPostRequest('http://localhost:3000/api/v1/auth/otp/request', {
    phoneNumber: citizenPhone,
  });
  const otpReqRes = await otpRequestPost(otpReq);
  const otpReqData = await otpReqRes.json();
  console.log('OTP Request Status:', otpReqRes.status);
  console.log('OTP Mock Notice:', otpReqData.mockNotice);

  const otpCode = otpReqData.mockNotice?.match(/\d{6}/)?.[0] || '123456';
  console.log('Attempting verify with code:', otpCode);

  const otpVerifyReq = createPostRequest('http://localhost:3000/api/v1/auth/otp/verify', {
    phoneNumber: citizenPhone,
    otp: otpCode,
  });
  const otpVerifyRes = await otpVerifyPost(otpVerifyReq);
  const otpVerifyData = await otpVerifyRes.json();
  console.log('OTP Verify Status:', otpVerifyRes.status);
  console.log('Role Issued:', otpVerifyData.data?.user?.role);
  console.log('Redirect URL:', otpVerifyData.data?.redirectUrl);
  if (otpVerifyRes.status !== 200 || otpVerifyData.data?.user?.role !== 'CITIZEN') {
    throw new Error('Citizen OTP verify failed: ' + JSON.stringify(otpVerifyData));
  }
  console.log(' Citizen OTP Login: PASS');

  // 4. Invalid Password Handling
  console.log('\n--- Security Check 1: Invalid Password Handling ---');
  const badPassReq = createPostRequest('http://localhost:3000/api/v1/auth/login', {
    email: 'officer.csmc@govasset.in',
    password: 'wrong_password_attempt',
    portalType: 'OFFICIAL',
  });
  const badPassRes = await loginPost(badPassReq);
  console.log('Bad Password Status (expected 401):', badPassRes.status);
  if (badPassRes.status !== 401) throw new Error('Expected 401 for bad password');
  console.log(' Invalid Password Rejection: PASS');

  // 5. Cross-Role Isolation Enforcement
  console.log('\n--- Security Check 2: Cross-Portal Role Isolation ---');
  const crossRoleReq = createPostRequest('http://localhost:3000/api/v1/auth/login', {
    email: 'officer.csmc@govasset.in',
    password: 'password123',
    portalType: 'WORKER',
  });
  const crossRoleRes = await loginPost(crossRoleReq);
  console.log('Cross-Role Status (expected 403):', crossRoleRes.status);
  if (crossRoleRes.status !== 403) throw new Error('Expected 403 for cross-role login');
  console.log(' Cross-Portal Role Isolation: PASS');

  console.log('\n======================================================');
  console.log('ALL 3 AUTHENTICATION PORTALS FULLY VERIFIED & WORKING!');
  console.log('======================================================\n');
}

testAllPortals().catch(console.error);
