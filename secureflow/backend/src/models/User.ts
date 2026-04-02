import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

export class User extends Model {
  declare id: number;
  declare email: string;
  declare password: string;
  declare role: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'user' },
  },
  { sequelize, tableName: 'users', timestamps: true }
);
