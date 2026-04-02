import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

export class AuditLog extends Model {
  declare id: number;
  declare userId: number;
  declare entryId: number | null;
  declare action: string;
  declare ipAddress: string;
  declare createdAt: Date;
}

AuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    entryId: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    ipAddress: { type: DataTypes.STRING, defaultValue: '' },
  },
  { sequelize, tableName: 'audit_logs', timestamps: true, updatedAt: false }
);
