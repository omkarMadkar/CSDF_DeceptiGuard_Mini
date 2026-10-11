# DeceptiGuard: Detection Rules & Risk Scoring Matrix

| Rule ID | Rule Name | Points | Severity | MITRE ATT&CK | Explanation & Forensic Intent |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **R1** | Decoy Asset Interaction | `+100` | CRITICAL | T1083 / T1005 | User opened or downloaded an unauthorized honeyfile or hit a decoy endpoint. |
| **R2** | Decoy Account Authentication | `+90` | CRITICAL | T1078.002 | Probing or credential stuffing on a dormant decoy administrator account. |
| **R3** | Honeytoken Canary Usage | `+100` | CRITICAL | T1552 / T1110 | Canary AWS key, database URI, or search token was submitted in a request. |
| **R4** | After-Hours Privileged Access | `+15` | MEDIUM | T1078 | Confidential asset accessed outside 09:00 - 19:00 window. |
| **R5** | Bulk Download Staging | `+30` | HIGH | T1005 / T1567 | More than 10 documents downloaded in a 5-minute sliding window. |
| **R6** | Cross-Department Role Violation | `+20` | MEDIUM | T1083 | Employee navigated into directories belonging to another department. |
| **R7** | Failed Login Threshold Exceeded | `+10` | LOW | T1110 | >= 5 failed authentications within 10 minutes. |
| **R8** | Rapid Directory Enumeration | `+25` | HIGH | T1083 | Rapid traversals across > 6 distinct directory structures. |

### Score Decay Dynamics
* Scores decay at an exponential rate of **10% per hour**:
  $$\text{Score}_{\text{new}} = \text{Score}_{\text{prior}} \times (0.90)^{\Delta t_{\text{hours}}}$$
* Prevents permanent account penalties from benign transient activity.
