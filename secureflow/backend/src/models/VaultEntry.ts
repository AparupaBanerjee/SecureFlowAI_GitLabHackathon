import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

export class VaultEntry extends Model {
  declare id: number;
  declare userId: number;
  declare name: string;
  declare username: string;
  declare password: string;
  declare url: string;
  declare notes: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

VaultEntry.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    username: { type: DataTypes.STRING, defaultValue: '' },
    password: { type: DataTypes.TEXT, allowNull: false },
    url: { type: DataTypes.STRING, defaultValue: '' },
    notes: { type: DataTypes.TEXT, defaultValue: '' },
  },
  { sequelize, tableName: 'vault_entries', timestamps: true }
);
