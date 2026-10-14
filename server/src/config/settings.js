// ============================================================================
// DECEPTIGUARD SETTINGS
// Student Configuration File: Change rules, points, users, traps in ONE place.
// ============================================================================

module.exports = {
  // Working hours: 9 AM to 7 PM. Access outside these hours triggers Rule R4.
  BUSINESS_HOURS: {
    start: 9,
    end: 19
  },

  // Download limit: More than 10 downloads within 5 minutes triggers Rule R5.
  DOWNLOAD_LIMITS: {
    maxFiles: 10,
    windowMinutes: 5
  },

  // Score decay: A user's risk score drops by 10% for every hour of good behavior.
  SCORE_DECAY_PERCENT_PER_HOUR: 10,

  // Risk bands based on cumulative points
  RISK_BANDS: {
    LOW: 29,       // 0 to 29
    MEDIUM: 59,    // 30 to 59
    HIGH: 89,      // 60 to 89
    CRITICAL: 90   // 90 and above
  },

  // 5 simple rules with plain English names and penalty points
  RULES: [
    {
      id: 'R1',
      name: 'Trap file opened',
      points: 100,
      severity: 'CRITICAL',
      mitre: 'T1083'
    },
    {
      id: 'R2',
      name: 'Fake admin login',
      points: 90,
      severity: 'CRITICAL',
      mitre: 'T1078.002'
    },
    {
      id: 'R3',
      name: 'Fake key used',
      points: 100,
      severity: 'CRITICAL',
      mitre: 'T1552'
    },
    {
      id: 'R4',
      name: 'Night-time access (outside 9 AM to 7 PM)',
      points: 15,
      severity: 'MEDIUM',
      mitre: 'T1078'
    },
    {
      id: 'R5',
      name: 'Too many downloads (more than 10 in 5 minutes)',
      points: 30,
      severity: 'HIGH',
      mitre: 'T1005'
    }
  ],

  // Common password for all demo accounts
  PASSWORD: 'Password123!',

  // The 6 users (5 real employees + 1 fake admin trap)
  USERS: [
    { username: 'onkar', role: 'admin', department: 'IT', label: 'onkar (Admin - Full Access)' },
    { username: 'mugdha', role: 'hr', department: 'HR', label: 'mugdha (HR Specialist)' },
    { username: 'samarth', role: 'intern', department: 'Engineering', label: 'samarth (Engineering Intern)' },
    { username: 'aniket', role: 'engineer', department: 'Engineering', label: 'aniket (Senior Engineer)' },
    { username: 'pranav', role: 'finance', department: 'Finance', label: 'pranav (Finance Analyst)' },
    { username: 'admin.backup', role: 'admin', department: 'IT', isDecoy: true, label: 'admin.backup (FAKE Admin - TRAP)' }
  ],

  // The 6 active traps
  TRAPS: {
    // 3 trap files
    files: [
      {
        name: 'Salary_Revision_2026_CONFIDENTIAL.xlsx',
        path: '/HR/Compensation/Salary_Revision_2026_CONFIDENTIAL.xlsx',
        department: 'HR',
        description: 'Fake salary spreadsheet lure'
      },
      {
        name: 'Passwords_Backup.txt',
        path: '/IT/Old_Archives/Passwords_Backup.txt',
        department: 'IT',
        description: 'Fake password archive lure'
      },
      {
        name: 'Client_Database_Full_Export.csv',
        path: '/Finance/Archive/Client_Database_Full_Export.csv',
        department: 'Finance',
        description: 'Fake customer database lure'
      }
    ],
    // 1 fake canary key
    key: 'canary_sec_key_99x88a77b',
    // 1 fake account
    account: 'admin.backup',
    // 1 trap web address
    endpoint: '/api/v1/admin/export-all'
  },

  // Single Genesis Hash for the evidence chain (64 zeros)
  GENESIS_HASH: '0000000000000000000000000000000000000000000000000000000000000000'
};
