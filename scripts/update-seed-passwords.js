const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const SCRYPT_PREFIX = 'scrypt$v1$N=16384,r=8,p=1$';

function generateScryptHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${SCRYPT_PREFIX}${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

function verifyScryptHash(password, storedHash) {
  if (!storedHash || !storedHash.startsWith(SCRYPT_PREFIX)) return Promise.resolve(false);
  const remainder = storedHash.slice(SCRYPT_PREFIX.length);
  const [salt, expectedHashHex] = remainder.split('$');
  const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

  return new Promise((resolve) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        resolve(crypto.timingSafeEqual(derivedKey, expectedBuffer));
      } catch {
        resolve(false);
      }
    });
  });
}

async function main() {
  console.log('--- Migrating Seed User Hashes to Authentic Cryptographic Scrypt Hashes ---');

  const mockHash = '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only';
  const usersWithMockHash = await prisma.user.findMany({
    where: { passwordHash: mockHash },
    select: { id: true, email: true, fullName: true, role: true },
  });

  console.log(`Found ${usersWithMockHash.length} users with legacy mock hash.`);

  for (const user of usersWithMockHash) {
    const realHash = await generateScryptHash('password123');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: realHash },
    });
    const verified = await verifyScryptHash('password123', realHash);
    console.log(`Updated user ${user.email} (${user.role}): scrypt verified = ${verified}`);
  }

  console.log('Password hash migration complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
