import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/user.model';

const getInitialAdminPassword = () => {
  const configuredPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();

  if (configuredPassword) {
    return configuredPassword;
  }

  return crypto.randomBytes(18).toString('base64url');
};

export const seedAdmin = async () => {
  const existingAdmin = await User.findOne({ email: 'admin@fashion.com' });
  if (existingAdmin) {
    console.log('Admin user already exists');
    return;
  }

  const hashedPassword = await bcrypt.hash(getInitialAdminPassword(), 10);

  await User.create({
    name: 'Quản trị viên',
    email: 'admin@fashion.com',
    password: hashedPassword,
    phone: '0900000000',
    role: 'admin',
    mustChangePassword: true,
    gender: 'male',
    dateOfBirth: new Date('1990-01-01'),
    isActive: true,
    address: [
      {
        customerName: 'Quản trị viên',
        province: 'Cần Thơ',
        district: 'Ninh Kiều',
        ward: 'An Khánh',
        streetName: '123 Đường 3/2',
        phoneNumber: '0900000000',
        provinceId: 92,
        districtId: 789,
        wardCode: '00123',
        isDefault: true,
      },
    ],
  });

  console.log('Seeded admin user: admin@fashion.com; initial password is not logged. Set ADMIN_INITIAL_PASSWORD before seeding if you need a known bootstrap password.');
};
