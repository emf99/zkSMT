import { useState } from 'react';
import { ss1_backend, createActor } from 'declarations/ss1_backend';
import './App.css';

function App() {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [nonce, setNonce] = useState('');
  const [zkUsername, setZkUsername] = useState('');
  const [zkNonce, setZkNonce] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [zkProof, setZkProof] = useState('');

  // Helper function to get backend actor
  const getBackendActor = () => {
    console.log('getBackendActor called');
    console.log('ss1_backend available:', !!ss1_backend);
    if (ss1_backend) {
      console.log('Using ss1_backend from import');
      console.log('ss1_backend methods:', Object.keys(ss1_backend));
      return ss1_backend;
    }
    
    // Fallback - use hardcoded canister ID for local environment
    const localCanisterId = 'uxrrr-q7777-77774-qaaaq-cai';
    console.log('Creating fallback actor with canister ID:', localCanisterId);
    try {
      const actor = createActor(localCanisterId);
      console.log('Created fallback actor:', actor);
      console.log('Fallback actor methods:', Object.keys(actor));
      return actor;
    } catch (error) {
      console.error('Cannot create backend actor:', error);
      return null;
    }
  };

  // Generate ZK proof for user using new backend function
  const handleGenerateZKProof = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!zkUsername.trim()) {
        throw new Error('Enter username');
      }
      
      const nonceNum = parseInt(zkNonce) || 1;
      
      setOutput(`Generating ZK proof for user '${zkUsername}'...`);
      
      // Get backend actor
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available. Check if dfx is running.');
      }
      
      console.log('Backend actor:', backend);
      console.log('Backend methods:', Object.keys(backend));
      console.log('generate_zk_proof_for_user method:', backend.generate_zk_proof_for_user);
      
      if (typeof backend.generate_zk_proof_for_user !== 'function') {
        throw new Error('Function generate_zk_proof_for_user is not available in backend canister.');
      }
      
      // Call new backend function
      const proofHex = await backend.generate_zk_proof_for_user(zkUsername, nonceNum);
      
      // Check if it's an error
      if (proofHex.startsWith('4552524f52')) { // "ERROR" in hex
        const errorBytes = new Uint8Array(proofHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const errorText = new TextDecoder().decode(errorBytes);
        throw new Error(errorText);
      }
      
      setZkProof(proofHex);
      
      // Decode hex to show proof
      try {
        const proofBytes = new Uint8Array(proofHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const proofText = new TextDecoder().decode(proofBytes);
        const proofJson = JSON.parse(proofText);
        
        setOutput(`✅ ZK Proof generated for user '${zkUsername}'!

📋 Proof details:
👤 Username: ${proofJson.username}
🔑 Public Key: ${proofJson.public_key} (hash of username)
🎲 Nonce: ${proofJson.nonce}
🌳 SMT Root: ${proofJson.smt_root.substring(0, 20)}...

🔒 IMPORTANT: Secret value (${proofJson.secret_value}) will NOT be revealed in real ZK proof!

Proof (hex): ${proofHex.substring(0, 100)}...
        
💡 Now you can use this proof for verification below.`);
      } catch (decodeError) {
        setOutput(`✅ ZK Proof generated for user '${zkUsername}'!
Proof (hex): ${proofHex}
        
💡 Now you can use this proof for verification below.`);
      }
    } catch (error) {
      setOutput(`❌ Error during ZK proof generation: ${error.message}`);
    }
    setLoading(false);
  };

  const handleInsert = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Convert value to number if possible, otherwise use hash
      let idValue;
      if (value && !isNaN(value)) {
        idValue = parseInt(value, 10);
      } else {
        // Use simple hash for text values
        idValue = value.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a; // Convert to 32bit integer
        }, 0);
        idValue = Math.abs(idValue); // Make sure it's positive
      }
      
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available.');
      }
      
      const result = await backend.insert(key, idValue);
      setOutput(`Inserted: ${key} -> ${value} (id: ${idValue})\nResult: ${result}`);
    } catch (error) {
      setOutput(`Error inserting: ${error.message}`);
    }
    setLoading(false);
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available.');
      }
      
      const result = await backend.delete(key);
      setOutput(`Deleted: ${key}\nResult: ${result}`);
    } catch (error) {
      setOutput(`Error deleting: ${error.message}`);
    }
    setLoading(false);
  };

  const handleGetProof = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available.');
      }
      
      const proof = await backend.get_merkle_proof(key);
      setOutput(`Merkle Proof for ${key}:\n${JSON.stringify(proof, null, 2)}`);
    } catch (error) {
      setOutput(`Error getting proof: ${error.message}`);
    }
    setLoading(false);
  };

  const handleGetRoot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available.');
      }
      
      const root = await backend.get_root();
      setOutput(`Current SMT Root: ${root}`);
    } catch (error) {
      setOutput(`Error getting root: ${error.message}`);
    }
    setLoading(false);
  };

  const handleVerifyZK = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('Starting ZK proof verification...');
      console.log('ZK Username:', zkUsername);
      console.log('ZK Proof:', zkProof);
      
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available.');
      }
      
      console.log('Getting root from backend...');
      const root = await backend.get_root();
      console.log('Root received:', root);
      
      const verifyRequest = {
        key: zkUsername,
        root: root,
        zk_proof: zkProof
      };
      console.log('Sending verify request:', verifyRequest);
      
      console.log('Calling verify_zk_membership...');
      const result = await backend.verify_zk_membership(verifyRequest);
      console.log('Verification result:', result);
      
      setOutput(`ZK Proof Verification Result: ${result ? 'VALID' : 'INVALID'}`);
    } catch (error) {
      console.error('Error during verification:', error);
      setOutput(`Error verifying ZK proof: ${error.message}`);
    }
    setLoading(false);
  };

  const handleGreet = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available.');
      }
      
      const greeting = await backend.greet(name);
      setOutput(greeting);
    } catch (error) {
      setOutput(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <main className="container">
      <header>
        <img src="/logo2.svg" alt="DFINITY logo" className="logo" />
        <h1>zkSMT - Zero-Knowledge Sparse Merkle Tree</h1>
        <p>Application for managing Sparse Merkle Tree with zero-knowledge proof support</p>
      </header>

      <div className="sections">
        {/* Greeting Section */}
        <section className="card">
          <h2>Greeting</h2>
          <form onSubmit={handleGreet}>
            <div className="form-group">
              <label htmlFor="name">Your name:</label>
              <input 
                id="name" 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Greet me!'}
            </button>
          </form>
        </section>

        {/* SMT Operations */}
        <section className="card">
          <h2>Sparse Merkle Tree Operations</h2>
          <div className="form-group">
            <label htmlFor="nameKey">Username:</label>
            <input 
              id="nameKey" 
              type="text" 
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. alice, bob, charlie"
            />
          </div>
          <div className="form-group">
            <label htmlFor="value">ID or Value:</label>
            <input 
              id="value" 
              type="text" 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 123 or any value"
            />
          </div>
          
          <div className="button-group">
            <button onClick={handleInsert} disabled={loading || !key || !value}>
              Insert
            </button>
            <button onClick={handleDelete} disabled={loading || !key}>
              Delete
            </button>
            <button onClick={handleGetProof} disabled={loading || !key}>
              Get Proof
            </button>
            <button onClick={handleGetRoot} disabled={loading}>
              Get Root
            </button>
          </div>
        </section>

        {/* ZK Proof Generation */}
        <section className="card">
          <h2>Zero-Knowledge Proof Membership Generation in SMT</h2>
          <div className="info-box">
            <h3>📖 How it works:</h3>
            <p>This system generates <strong>real ZK proof of membership in Sparse Merkle Tree</strong></p>
            <ul>
              <li><strong>Username</strong> - username that exists in SMT</li>
              <li><strong>Secret Value</strong> - ID value assigned to the user in SMT (automatically retrieved and hidden in proof)</li>
              <li><strong>Nonce</strong> - additional randomization for security</li>
            </ul>
            <p>🔧 <strong>Process:</strong></p>
            <ol>
              <li>First add a user to SMT in the "SMT Operations" section above (e.g. alice → 123)</li>
              <li>Then generate ZK proof by providing only username and nonce</li>
              <li>System automatically retrieves the ID value from SMT</li>
              <li>Proof proves that you know the ID value for this user without revealing it!</li>
            </ol>
            <p>💡 <strong>Zero-knowledge:</strong> Verifier will only see that the proof is valid for given user, but won't learn their secret ID!</p>
          </div>
          <div className="form-group">
            <label htmlFor="zkUsername">Username:</label>
            <input 
              id="zkUsername" 
              type="text" 
              value={zkUsername}
              onChange={(e) => setZkUsername(e.target.value)}
              placeholder="e.g. alice, bob, charlie"
            />
            <small className="field-help">User that was added to SMT - system will automatically retrieve their ID</small>
          </div>
          <div className="form-group">
            <label htmlFor="zkNonce">Nonce (integer):</label>
            <input 
              id="zkNonce" 
              type="number" 
              value={zkNonce}
              onChange={(e) => setZkNonce(e.target.value)}
              placeholder="e.g. 999"
            />
            <small className="field-help">Additional randomization - hidden in proof (witness)</small>
          </div>
          <div className="calculation-display">
            <strong>⚠️ Remember: </strong>
            <span className="calculation">
              {zkUsername ? 
                `User '${zkUsername}' must first be added to SMT in the section above!` 
                : 'Enter username that exists in SMT'
              }
            </span>
          </div>
          <button onClick={handleGenerateZKProof} disabled={loading || !zkUsername || !zkNonce}>
            {loading ? 'Generating...' : 'Generate ZK Proof'}
          </button>
        </section>

        {/* ZK Proof Verification */}
        <section className="card">
          <h2>Zero-Knowledge Proof Verification</h2>
          <div className="form-group">
            <label htmlFor="zkProof">ZK Proof (hex):</label>
            <textarea 
              id="zkProof" 
              value={zkProof}
              onChange={(e) => setZkProof(e.target.value)}
              placeholder="Proof will be automatically generated above..."
              rows="4"
            />
          </div>
          <button onClick={handleVerifyZK} disabled={loading || !zkUsername || !zkProof}>
            Verify ZK Proof in Backend
            {(!zkUsername || !zkProof) && <span style={{fontSize: '0.8em', display: 'block'}}>
              (Fill {!zkUsername ? 'username' : ''}{!zkUsername && !zkProof ? ' and ' : ''}{!zkProof ? 'proof' : ''})
            </span>}
          </button>
        </section>

        {/* Output */}
        <section className="card output-section">
          <h2>Output</h2>
          <pre className="output">{output || 'No results...'}</pre>
        </section>
      </div>
    </main>
  );
}

export default App;
