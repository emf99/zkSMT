import { useState } from 'react';
import { ss1_backend, createActor } from 'declarations/ss1_backend';
import './App.css';

console.log('App.jsx loading...');
console.log('ss1_backend:', ss1_backend);
console.log('createActor:', createActor);

function App() {
  console.log('App component rendering...');
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
    console.log('Environment variables:', {
      CANISTER_ID_SS1_BACKEND: import.meta.env.CANISTER_ID_SS1_BACKEND,
      DFX_NETWORK: import.meta.env.DFX_NETWORK
    });
    
    if (ss1_backend) {
      console.log('Using ss1_backend from import');
      console.log('ss1_backend methods:', Object.keys(ss1_backend));
      return ss1_backend;
    }
    
    // Fallback - use hardcoded canister ID for local environment
    const localCanisterId = import.meta.env.CANISTER_ID_SS1_BACKEND || 'uxrrr-q7777-77774-qaaaq-cai';
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

  // Generate ZK proof for user using backend function (mock proof)
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
      
      // Call backend function
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
        
        setOutput(`✅ ZK Proof generated for user '\${zkUsername}'!

📋 Proof details:
👤 Username: \${proofJson.username}
🔑 Public Key: \${proofJson.public_key} (hash of username)
🎲 Nonce: \${proofJson.nonce}
🌳 SMT Root: \${proofJson.smt_root.substring(0, 20)}...

🔒 IMPORTANT: Secret value (\${proofJson.secret_value}) will NOT be revealed in real ZK proof!

Proof (hex): \${proofHex.substring(0, 100)}...
        
💡 Now you can use this proof for verification below.`);
      } catch (decodeError) {
        setOutput(`✅ ZK Proof generated for user '\${zkUsername}'!
Proof (hex): \${proofHex}
        
💡 Now you can use this proof for verification below.`);
      }
    } catch (error) {
      setOutput(`❌ Error during ZK proof generation: \${error.message}`);
    }
    setLoading(false);
  };

  // REAL dynamic ZK proof generation with snarkjs in browser
  const handleGenerateDynamicZK = async () => {
    try {
      if (!zkUsername.trim()) {
        alert('Please enter a username');
        return;
      }

      setOutput(`🔄 Generating REAL dynamic ZK proof for user '\${zkUsername}' with current SMT state...`);
      setLoading(true);
      
      const backend = getBackendActor();
      if (!backend) {
        throw new Error('Backend canister is not available');
      }
      
      // Step 1: Get current SMT root
      console.log('📊 Getting current SMT root...');
      const currentRoot = await backend.get_root();
      console.log('Current SMT root (hex):', currentRoot);
      
      // Step 2: Try to get merkle proof for the user
      console.log('🔍 Getting merkle proof for user:', zkUsername);
      let merkleProof = null;
      let userValue = 0; // Default for non-membership
      let isUserInSMT = false;
      
      try {
        merkleProof = await backend.get_merkle_proof(zkUsername);
        console.log('Merkle proof received:', merkleProof);
        isUserInSMT = true;
        
        // Step 2.5: Get the actual user value from SMT entries
        console.log('🔍 Getting user value from SMT...');
        const allEntries = await backend.get_all_smt_entries();
        console.log('All SMT entries:', allEntries);
        
        const userEntry = allEntries.find(([key, value]) => key === zkUsername);
        if (userEntry) {
          userValue = parseInt(userEntry[1]);
          console.log('User value from SMT:', userValue);
        } else {
          console.log('User not found in SMT entries despite having merkle proof');
          userValue = 0;
          isUserInSMT = false;
        }
      } catch (proofError) {
        console.log('User not found in SMT - will generate non-membership proof');
        merkleProof = null;
        userValue = 0;
        isUserInSMT = false;
      }
      
      // Step 3: Calculate publicKey from username (consistent with backend)
      const publicKey = zkUsername.split('').reduce((hash, char) => {
        return ((hash * 31) + char.charCodeAt(0)) >>> 0; // >>> 0 for unsigned 32-bit
      }, 0);
      console.log('Public key for', zkUsername, ':', publicKey);
      
      // Step 4: Convert hex root to decimal for circuit
      const expectedRoot = BigInt('0x' + currentRoot);
      console.log('Expected root (BigInt):', expectedRoot.toString());
      
      // Step 5: Prepare circuit inputs
      let circuitInputs;
      
      if (isUserInSMT && merkleProof && merkleProof.length > 0) {
        // User exists in SMT - generate membership proof
        console.log('Generating membership proof...');
        
        // Extract sibling hashes from merkle proof
        const siblings = merkleProof.map(proof_item => {
          // Convert hex hash to BigInt then take modulo to get smaller number
          const hashBigInt = BigInt('0x' + proof_item.hash);
          // Take modulo 2^32 to get a reasonable sized number for circuit
          const hashMod = hashBigInt % (BigInt(2) ** BigInt(32));
          return hashMod.toString();
        });
        
        // Pad siblings to 3 levels (circuit expects exactly 3)
        while (siblings.length < 3) {
          siblings.push('0'); // Pad with zeros
        }
        if (siblings.length > 3) {
          siblings.splice(3); // Take only first 3
        }
        
        circuitInputs = {
          publicKey: publicKey.toString(),
          expectedRoot: expectedRoot.toString(),
          secretValue: userValue.toString(), // Use actual value from SMT
          salt: (zkNonce || '789').toString(),
          // Real merkle path siblings from SMT
          sibling1: siblings[0],
          sibling2: siblings[1], 
          sibling3: siblings[2]
        };
      } else {
        // User doesn't exist - generate non-membership proof
        console.log('Generating non-membership proof...');
        circuitInputs = {
          publicKey: publicKey.toString(),
          expectedRoot: expectedRoot.toString(),
          secretValue: '0', // No secret value for non-members
          salt: (zkNonce || '789').toString(),
          // Default siblings for non-membership (use default values)
          sibling1: '100',
          sibling2: '200',
          sibling3: '300'
        };
      }
      
      console.log('Circuit inputs:', circuitInputs);
      
      // Step 6: Check if snarkjs is available and wait for it to load
      if (!window.snarkjs) {
        console.log('Waiting for snarkjs to load...');
        setOutput('🔄 Waiting for snarkjs library to load...');
        
        // Wait for snarkjs to be available (max 10 seconds)
        let retries = 0;
        const maxRetries = 50; // 50 * 200ms = 10 seconds
        
        while (!window.snarkjs && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200));
          retries++;
        }
        
        if (!window.snarkjs) {
          throw new Error('snarkjs is not loaded. Please check the script import or reload the page.');
        }
      }
      
      console.log('snarkjs available:', !!window.snarkjs);
      console.log('groth16 available:', !!window.snarkjs.groth16);
      console.log('fullProve available:', !!window.snarkjs.groth16.fullProve);
      
      // Step 7: Generate proof with snarkjs
      setOutput(`🔄 Generating cryptographic proof... This may take 10-30 seconds.`);
      
      console.log('Starting snarkjs proof generation...');
      const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
        circuitInputs,
        "/zk_membership.wasm",
        "/zk_membership_final.zkey"
      );
      
      console.log('✅ Proof generated successfully!');
      console.log('Proof:', proof);
      console.log('Public signals:', publicSignals);
      
      // Step 8: Format proof for storage/verification
      const formattedProof = {
        pi_a: [proof.pi_a[0], proof.pi_a[1]],
        pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        pi_c: [proof.pi_c[0], proof.pi_c[1]]
      };
      
      // Get siblings from merkle proof or use defaults
      const siblings = [
        parseInt(circuitInputs.sibling1),
        parseInt(circuitInputs.sibling2), 
        parseInt(circuitInputs.sibling3)
      ];
      
      // Format data according to backend UserZKProofData structure
      const userZKProofData = {
        pi_a: [proof.pi_a[0], proof.pi_a[1]],
        pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        pi_c: [proof.pi_c[0], proof.pi_c[1]],
        smt_root: currentRoot,
        username: zkUsername,
        public_key: publicKey,
        secret_value: userValue, // Use actual SMT value
        nonce: parseInt(zkNonce) || 12345,
        siblings: siblings
      };
      
      // Encode as hex string (as expected by backend)
      const proofJson = JSON.stringify(userZKProofData);
      const proofHex = Array.from(new TextEncoder().encode(proofJson))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      setZkProof(proofHex);
      setOutput(`🎉 REAL Cryptographic ZK Proof Generated!

📊 SMT State:
🌳 Current Root: ${currentRoot}
🔢 Root (decimal): ${expectedRoot.toString()}
👤 User: ${zkUsername}
🔑 Public Key: ${publicKey}
💎 Secret Value: ${userValue} ${isUserInSMT ? '(from SMT)' : '(non-member)'}
🎲 Nonce: ${zkNonce || '12345'}
${isUserInSMT ? '✅ Membership proof for existing user' : '❌ Non-membership proof for non-existing user'}

🔒 Generated Proof (Groth16):
π_a: [${userZKProofData.pi_a[0].substring(0, 20)}..., ${userZKProofData.pi_a[1].substring(0, 20)}...]
π_b: [[${userZKProofData.pi_b[0][0].substring(0, 10)}..., ${userZKProofData.pi_b[0][1].substring(0, 10)}...], [${userZKProofData.pi_b[1][0].substring(0, 10)}..., ${userZKProofData.pi_b[1][1].substring(0, 10)}...]]
π_c: [${userZKProofData.pi_c[0].substring(0, 20)}..., ${userZKProofData.pi_c[1].substring(0, 20)}...]

📋 Circuit Data:
Secret Value: ${userZKProofData.secret_value} ${isUserInSMT ? '(real value from SMT)' : '(default for non-member)'}
Siblings: [${userZKProofData.siblings.join(', ')}] ${isUserInSMT ? '(from merkle proof)' : '(default values)'}

📋 Public Signals:
${publicSignals.map((sig, i) => `Signal ${i}: ${sig.toString().substring(0, 30)}...`).join('\n')}

🔐 Proof encoded as hex for backend verification
📏 Proof length: ${proofHex.length} characters

⏰ Generated at: ${new Date().toISOString()}

💡 This is a REAL cryptographic proof!
💡 ${isUserInSMT ? 'Should verify as VALID for existing user' : 'Should verify as INVALID for non-existing user'}
💡 You can now verify this proof using backend verification.`);

    } catch (error) {
      console.error('Dynamic ZK generation error:', error);
      setOutput(`❌ Error generating dynamic ZK proof: ${error.message}

🔍 Troubleshooting:
- Make sure snarkjs loaded (check browser console)
- Verify circuit files are available: /zk_membership.wasm, /zk_membership_final.zkey
- Check if user exists in SMT or try adding them first

Debug info: ${error.stack || 'No stack trace available'}`);
    } finally {
      setLoading(false);
    }
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
    <main className="main-container">
      <header className="header">
        <img src="logo2.svg" alt="zkSMT Logo" className="logo" />
        <h1>zkSMT Proof System</h1>
        <p>Zero-Knowledge Sparse Merkle Tree with Internet Computer</p>
      </header>

      <div className="container">
        <section className="section">
          <h2>🌳 SMT Operations</h2>
          <form className="form">
            <input
              type="text"
              placeholder="Key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input"
            />
            <div className="button-group">
              <button onClick={handleInsert} disabled={loading} className="button primary">
                {loading ? 'Processing...' : 'Insert'}
              </button>
              <button onClick={handleDelete} disabled={loading} className="button danger">
                {loading ? 'Processing...' : 'Delete'}
              </button>
              <button onClick={handleGetProof} disabled={loading} className="button secondary">
                {loading ? 'Processing...' : 'Get Proof'}
              </button>
              <button onClick={handleGetRoot} disabled={loading} className="button secondary">
                {loading ? 'Processing...' : 'Get Root'}
              </button>
            </div>
          </form>
        </section>

        <section className="section">
          <h2>🔐 ZK Membership Proof</h2>
          <form className="form">
            <input
              type="text"
              placeholder="Username for ZK proof"
              value={zkUsername}
              onChange={(e) => setZkUsername(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="Nonce (optional)"
              value={zkNonce}
              onChange={(e) => setZkNonce(e.target.value)}
              className="input"
            />
            <div className="button-group">
              <button 
                onClick={handleGenerateDynamicZK} 
                disabled={loading} 
                className="button success"
                title="Generate real cryptographic proof using snarkjs in browser"
              >
                {loading ? 'Generating...' : 'Generate Dynamic ZK (Real)'}
              </button>
              <button onClick={handleVerifyZK} disabled={loading} className="button secondary">
                {loading ? 'Verifying...' : 'Verify Real ZK Membership'}
              </button>
            </div>
          </form>
        </section>

        <section className="section">
          <h2>�� Greeting Test</h2>
          <form className="form">
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
            <button onClick={handleGreet} disabled={loading} className="button primary">
              {loading ? 'Loading...' : 'Greet'}
            </button>
          </form>
        </section>

        <section className="section output-section">
          <h2>📄 Output</h2>
          <pre className="output">{output || 'No results...'}</pre>
        </section>
      </div>
      
      {/* Load snarkjs from CDN */}
      <script src="https://unpkg.com/snarkjs@0.7.3/build/snarkjs.min.js"></script>
    </main>
  );
}

export default App;
