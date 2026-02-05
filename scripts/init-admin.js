const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@empresa.com',
        password: hashedPassword,
        name: 'Administrador',
        role: 'ADMIN',
        isActive: true
      }
    });
    
    console.log('✅ Usuario administrador creado:');
    console.log('   Email: admin@empresa.com');
    console.log('   Contraseña: admin123');
    console.log('   Nombre: Administrador');
    
  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();