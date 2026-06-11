import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';

export const seedAdmin = async () => {
  const existingAdmin = await User.findOne({ email: 'admin@fashion.com' });
  if (existingAdmin) {
    console.log('Admin user already exists');
    return;
  }

  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  await User.create({
    name: 'Quản trị viên',
    email: 'admin@fashion.com',
    password: hashedPassword,
    phone: '0900000000',
    role: 'admin',
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

  console.log('Seeded admin user: admin@fashion.com / Admin@123');
};
