import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('Usuario no encontrado');
    return;
  }

  const isValid = await bcrypt.compare(password, user.password);
  console.log('Contraseña válida?', isValid);
}

testLogin('tu_correo@example.com', 'tu_contraseña');
