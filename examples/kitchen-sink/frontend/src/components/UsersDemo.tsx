import React, { useEffect, useState } from 'react';
import {
  User,
  listUsers,
  getUser,
  createUser,
  deleteUser,
  searchUsers,
  BridgeRequestError,
} from '../generated/api';

const UsersDemo: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers({ activeOnly: false });
      setUsers(result);
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleGetUser = async (userId: number) => {
    setLoading(true);
    setError(null);
    try {
      const user = await getUser({ userId });
      setSelectedUser(user);
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Failed to get user');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    
    setLoading(true);
    setError(null);
    try {
      await createUser({ name: newName, email: newEmail });
      setNewName('');
      setNewEmail('');
      await loadUsers();
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Failed to create user');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    setLoading(true);
    setError(null);
    try {
      await deleteUser({ userId });
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
      await loadUsers();
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Failed to delete user');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadUsers();
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const results = await searchUsers({ query: searchQuery });
      setUsers(results);
    } catch (err) {
      if (err instanceof BridgeRequestError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Search failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={styles.heading}>👥 Users Management</h2>
      
      {error && <div style={styles.error}>{error}</div>}
      
      {/* Search */}
      <div style={styles.searchBox}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.input}
        />
        <button onClick={handleSearch} style={styles.button}>
          Search
        </button>
        <button onClick={loadUsers} style={styles.buttonSecondary}>
          Reset
        </button>
      </div>

      {/* Create User Form */}
      <form onSubmit={handleCreateUser} style={styles.form}>
        <h3>Create New User</h3>
        <div style={styles.formRow}>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.button} disabled={loading}>
            Create User
          </button>
        </div>
      </form>

      {/* Users List */}
      <div style={styles.grid}>
        <div style={styles.listSection}>
          <h3>Users List ({users.length})</h3>
          {loading && <p>Loading...</p>}
          <ul style={styles.list}>
            {users.map((user) => (
              <li
                key={user.id}
                style={{
                  ...styles.listItem,
                  ...(selectedUser?.id === user.id ? styles.selectedItem : {}),
                }}
                onClick={() => handleGetUser(user.id)}
              >
                <div>
                  <strong>{user.name}</strong>
                  <br />
                  <small>{user.email}</small>
                </div>
                <div style={styles.actions}>
                  <span
                    style={{
                      ...styles.badge,
                      background: user.isActive ? '#27ae60' : '#e74c3c',
                    }}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUser(user.id);
                    }}
                    style={styles.deleteButton}
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Selected User Details */}
        <div style={styles.detailSection}>
          <h3>User Details</h3>
          {selectedUser ? (
            <div style={styles.details}>
              <p><strong>ID:</strong> {selectedUser.id}</p>
              <p><strong>Name:</strong> {selectedUser.name}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p>
                <strong>Status:</strong>{' '}
                {selectedUser.isActive ? '✅ Active' : '❌ Inactive'}
              </p>
            </div>
          ) : (
            <p style={styles.placeholder}>
              Click on a user to view details
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  heading: {
    marginBottom: '20px',
    color: '#2c3e50',
  },
  error: {
    background: '#fee',
    color: '#c00',
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  searchBox: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  form: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  formRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    flex: 1,
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    background: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: '10px 20px',
    fontSize: '14px',
    background: '#95a5a6',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  listSection: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
  },
  detailSection: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    marginTop: '10px',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#fff',
    borderRadius: '4px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid #eee',
  },
  selectedItem: {
    borderColor: '#3498db',
    background: '#ebf5fb',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#fff',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  },
  details: {
    marginTop: '10px',
  },
  placeholder: {
    color: '#95a5a6',
    fontStyle: 'italic',
    marginTop: '20px',
  },
};

export default UsersDemo;
