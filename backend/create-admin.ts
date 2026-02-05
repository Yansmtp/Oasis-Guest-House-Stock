import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@local.com';
  const password = 'admin123';

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('⚠️ El usuario admin ya existe');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Administrador', // ✅ CAMPO QUE FALTABA
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Usuario admin creado correctamente');
  console.log({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
