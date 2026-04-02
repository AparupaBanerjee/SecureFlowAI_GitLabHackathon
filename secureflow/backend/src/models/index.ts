import { User } from './User';
import { VaultEntry } from './VaultEntry';
import { AuditLog } from './AuditLog';

// Associations
User.hasMany(VaultEntry, { foreignKey: 'userId', as: 'entries' });
VaultEntry.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'actor' });

VaultEntry.hasMany(AuditLog, { foreignKey: 'entryId', as: 'logs' });
AuditLog.belongsTo(VaultEntry, { foreignKey: 'entryId', as: 'entry' });

export { User, VaultEntry, AuditLog };
