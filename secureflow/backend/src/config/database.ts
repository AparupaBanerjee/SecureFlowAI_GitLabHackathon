import { Sequelize } from 'sequelize';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/secureflow';

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions:
    process.env.NODE_ENV === 'production'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
});

export const connectDB = async (): Promise<void> => {
  await sequelize.authenticate();
  console.log('PostgreSQL connected.');
  await sequelize.sync({ alter: true });
  console.log('Models synced.');
};
