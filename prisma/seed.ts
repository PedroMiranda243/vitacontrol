import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminPassword = await hash(process.env.ADMIN_PASSWORD || 'admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@vitacontrol.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@vitacontrol.com',
      name: process.env.ADMIN_NAME || 'Administrador',
      password: adminPassword,
      role: 'ADMIN',
    },
  })
  console.log(`✅ Admin user created: ${admin.email}`)

  // Create viewer user (fonoaudióloga)
  const viewerPassword = await hash(process.env.VIEWER_PASSWORD || 'viewer123', 10)
  const viewer = await prisma.user.upsert({
    where: { email: process.env.VIEWER_EMAIL || 'lilian@vitacontrol.com' },
    update: {},
    create: {
      email: process.env.VIEWER_EMAIL || 'lilian@vitacontrol.com',
      name: process.env.VIEWER_NAME || 'Lilian Marinho',
      password: viewerPassword,
      role: 'VIEWER',
    },
  })
  console.log(`✅ Viewer user created: ${viewer.email}`)

  console.log('🎉 Seed completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
