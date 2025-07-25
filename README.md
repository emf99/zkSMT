# zkSMT - Zero-Knowledge Sparse Merkle Tree

A blockchain application demonstrating **Zero-Knowledge Sparse Merkle Tree** implementation with membership proofs on Internet Computer Protocol (ICP).

## 💡 Zero-Knowledge SQL Database Verification

This project is the **foundation for Zero-Knowledge proof verification of SQL queries** on databases represented as Sparse Merkle Trees.

### The Vision: ZK-SQL
What we've implemented here - **SMT membership verification** - is essentially a zero-knowledge proof for:
```sql
SELECT id FROM users WHERE name = "alice"
```

**Traditional Database Query:**
- Client queries: `SELECT id FROM users WHERE name = "alice"`  
- Database returns: `id = 123`
- Problem: The client learns Alice's secret ID

**Zero-Knowledge Database Query:**
- Client proves: "I know there exists a record for user 'alice'"
- Database verifies: "Yes, Alice exists in the database"
- Result: **Database confirms Alice's membership without revealing her secret ID**

### Future Applications
This SMT-based approach enables zero-knowledge proofs for:
- **User authentication** without revealing credentials
- **Data existence proofs** without exposing sensitive data  
- **Database integrity verification** while maintaining privacy
- **Selective disclosure** from private databases

The current implementation demonstrates the core building block for **privacy-preserving database queries** where the database structure (SMT) enables cryptographic proofs of query results without data leakage.

## 🎯 What is Zero-Knowledge?

**Zero-Knowledge Proof** is a cryptographic method where one party (the prover) can prove to another party (the verifier) that they know a secret value, without revealing any information about the secret itself.

### Simple Example:
- **Alice** has a secret ID: `123`
- **Alice** wants to prove she knows this ID without revealing it
- **Alice** generates a ZK proof: `"I know the secret value for user 'alice'"`
- **Bob** (verifier) can verify the proof is valid
- **Bob** confirms Alice knows the secret, but never learns that the secret is `123`

## 🌳 What is Sparse Merkle Tree?

A **Sparse Merkle Tree (SMT)** is a variant of Merkle tree optimized for storing key-value pairs where:
- Keys can be any string (e.g., usernames)
- Values are associated data (e.g., user IDs)
- Tree provides cryptographic proofs of membership/non-membership
- Tree root changes when data is added/modified

### Example SMT Structure:
```
users in SMT:
├── "alice" → "123"
├── "bob" → "456"  
├── "charlie" → "789"
└── "diana" → "234"

SMT Root: 0x7c655e1d031bd8c8e3ba4dd79bc20f33734983e6573e869f8a3939ca75b6446d
```

## 🔐 How zkSMT Works

This application combines **Zero-Knowledge Proofs** with **Sparse Merkle Trees**:

1. **Storage**: Users are stored in SMT as `username → secret_id` pairs
2. **Proof Generation**: User provides only `username` and `nonce`
3. **Secret Retrieval**: System automatically retrieves secret ID from SMT
4. **ZK Proof**: System generates proof without revealing the secret ID
5. **Verification**: Anyone can verify the user knows their secret ID without learning what it is

### 🎭 The Magic of Zero-Knowledge

```
👤 Alice wants to prove she's in the system

❌ Traditional approach:
Alice: "My ID is 123"
Bob: "OK, I can verify you're in the system, but now I know your secret ID"

✅ Zero-Knowledge approach:  
Alice: "I know the secret ID for user 'alice'" [generates ZK proof]
Bob: "The proof is valid - you're in the system"
Bob: "But I have no idea what your secret ID is!" 🤐
```
```bash
## 🏗️ Project Structure

```
ss1/
├── src/
│   ├── ss1_backend/          # Rust backend (Canister)
│   │   ├── src/lib.rs        # SMT + ZK proof logic
│   │   └── ss1_backend.did   # Candid interface
│   └── ss1_frontend/         # React frontend
│       └── src/App.jsx       # User interface
├── circuits/                 # ZK circuit files (.circom)
├── README.md                 # This file
└── dfx.json                  # ICP configuration
```

## 🚀 Quick Start

### Prerequisites
- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install/) (Internet Computer SDK)
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)

### 1. Clone and Setup
```bash
git clone <repository>
cd ss1
dfx start --background    # Start local ICP replica
```

### 2. Deploy Canisters
```bash
dfx deploy                # Deploy both backend and frontend
```

### 3. Open Application
```bash
# Frontend URL will be displayed after deployment
# Usually: http://u6s2n-gx777-77774-qaaba-cai.localhost:4943/
```

## 📱 How to Use

### Step 1: Add Users to SMT
In the "SMT Operations" section:
- **Username**: `alice`
- **ID/Value**: `123`
- Click **"Insert"**

### Step 2: Generate ZK Proof
In the "Zero-Knowledge Proof Generation" section:
- **Username**: `alice`
- **Nonce**: `999` (any number for randomization)
- Click **"Generate ZK Proof"**

### Step 3: Verify Proof
- The proof is automatically filled in the verification section
- Click **"Verify ZK Proof"**
- Result: `VALID` ✅ (without revealing that Alice's secret ID is 123!)

## �️ SQL-to-SMT Mapping

### Database Table Representation
Traditional SQL table:
```sql
CREATE TABLE users (
    name VARCHAR PRIMARY KEY,
    id INT NOT NULL
);

INSERT INTO users VALUES 
    ('alice', 123),
    ('bob', 456),
    ('charlie', 789);
```

### SMT Equivalent
The same data structure in our Sparse Merkle Tree:
```
SMT Key-Value Store:
├── hash("alice") → 123
├── hash("bob") → 456  
└── hash("charlie") → 789

SMT Root: cryptographic commitment to entire dataset
```

### Zero-Knowledge SQL Query Translation

| SQL Operation | SMT Operation | ZK Proof |
|---------------|---------------|----------|
| `SELECT id FROM users WHERE name = ?` | SMT membership proof | Proves record exists without revealing `id` |
| `INSERT INTO users VALUES (?, ?)` | SMT insertion | Proves successful insertion without revealing data |
| `UPDATE users SET id = ? WHERE name = ?` | SMT update | Proves update occurred without revealing new value |
| `DELETE FROM users WHERE name = ?` | SMT deletion | Proves deletion without revealing what was deleted |

### Privacy Benefits
- **Query Privacy**: Database learns what you're looking for but not the results
- **Data Privacy**: Results are proven correct without exposing actual values  
- **Structural Privacy**: Database structure can be verified without full disclosure
- **Authentication Privacy**: Users can prove membership without revealing credentials

This implementation serves as a **proof-of-concept for private database operations** where traditional SQL queries can be replaced with zero-knowledge proofs over cryptographically committed data structures.

## �🔧 Technical Implementation

### Backend (Rust)

#### Key Functions:
```rust
// Add user to SMT
insert(username: String, id: u64) -> ()

// Generate ZK proof (new API)
generate_zk_proof_for_user(username: String, nonce: u64) -> String

// Verify ZK proof
verify_zk_membership(req: ZKVerifyRequest) -> bool

// Get SMT root
get_root() -> String
```

#### ZK Proof Structure:
```rust
struct UserZKProofData {
    pi_a: [String; 2],           // ZK proof component A
    pi_b: [[String; 2]; 2],      // ZK proof component B  
    pi_c: [String; 2],           // ZK proof component C
    smt_root: String,            // SMT root when proof was generated
    username: String,            // Public: user identifier
    public_key: u64,             // Public: hash of username
    secret_value: u64,           // PRIVATE: hidden in ZK proof!
    nonce: u64,                  // Public: additional randomization
    siblings: [u64; 3],          // Public: Merkle path siblings
}
```

### Frontend (React)

Key components:
- **SMT Operations**: Add/remove users from tree
- **ZK Proof Generation**: Create proofs with just username + nonce
- **ZK Proof Verification**: Verify proofs without learning secrets
- **Real-time Results**: Display verification status

## 🧪 Testing via CLI

You can also test the backend directly:

```bash
# Add user to SMT
dfx canister call ss1_backend insert '("alice", 123)'

# Generate ZK proof
dfx canister call ss1_backend generate_zk_proof_for_user '("alice", 999)'

# Verify ZK proof
dfx canister call ss1_backend verify_zk_membership '(record { 
    key = "alice"; 
    root = "current_smt_root"; 
    zk_proof = "generated_proof_hex" 
})'
```

## 🔍 Understanding the Verification Process

### What the Verifier Sees:
- ✅ **Username**: `"alice"` (public)
- ✅ **Public Key**: `96321` (hash of "alice")
- ✅ **Nonce**: `999` (randomization)
- ✅ **ZK Proof**: `pi_a, pi_b, pi_c` (cryptographic proof)
- ✅ **SMT Root**: Current tree state
- ❌ **Secret ID**: `HIDDEN!` 🔒

### What the Verifier Learns:
- Alice is a valid user in the system
- Alice knows her secret ID
- The proof was generated recently (SMT root matches)

### What the Verifier NEVER Learns:
- Alice's actual secret ID value
- Any information that could reveal the secret

## 💡 Real-World Applications

### 1. **Private Membership**
- Prove you're a member of an exclusive club
- Without revealing your member ID or personal details

### 2. **Anonymous Voting**
- Prove you're eligible to vote
- Without revealing which district you're from

### 3. **KYC Compliance**
- Prove you passed identity verification
- Without revealing your personal information

### 4. **Access Control**
- Prove you have required clearance level
- Without revealing your exact permission level

## 🛠️ Development

### Backend Development:
```bash
cd src/ss1_backend
cargo test              # Run tests
cargo clippy            # Lint code
```

### Frontend Development:
```bash
cd src/ss1_frontend
npm install             # Install dependencies
npm run dev             # Development server
```

### Circuit Development:
```bash
cd circuits
# ZK circuits are in .circom format
# Used for generating actual cryptographic proofs
```

## 🔒 Security Considerations

### What Makes This Secure:

1. **Cryptographic Soundness**: ZK proofs are mathematically sound
2. **Zero Information Leakage**: Verifier learns nothing about secrets
3. **Unforgeable**: Cannot create valid proof without knowing secret
4. **SMT Integrity**: Tree structure prevents tampering

### Current Limitations:

- **Demo Implementation**: Uses simplified circuit simulation
- **Local Testing**: Runs on local ICP replica
- **Development Stage**: Not production-ready

### For Production:

- Implement full Groth16 ZK proof system
- Add more sophisticated SMT with proper Merkle paths
- Enhanced security auditing
- Gas optimization for mainnet deployment

## � Learn More

### Zero-Knowledge Resources:
- [ZK-SNARKs Explained](https://blog.ethereum.org/2016/12/05/zksnarks-in-a-nutshell/)
- [Circom Documentation](https://docs.circom.io/)
- [zkSNARKs vs zkSTARKs](https://consensys.net/blog/blockchain-explained/zero-knowledge-proofs-starks-vs-snarks/)

### Sparse Merkle Trees:
- [SMT Specification](https://docs.iden3.io/getting-started/babyjubjub/)
- [Merkle Tree Concepts](https://en.wikipedia.org/wiki/Merkle_tree)

### Internet Computer:
- [ICP Developer Docs](https://internetcomputer.org/docs/)
- [Candid Interface](https://internetcomputer.org/docs/current/developer-docs/backend/candid/)
- [Rust CDK](https://docs.rs/ic-cdk/)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- Internet Computer Protocol team for the blockchain infrastructure
- Circom team for ZK circuit tools
- Zero-Knowledge research community
- All contributors to this educational project

---

**Remember**: This is an educational demonstration of Zero-Knowledge Sparse Merkle Trees. The magic is that Alice can prove she belongs to the system without anyone ever learning her secret ID! 🎭✨
```bash


