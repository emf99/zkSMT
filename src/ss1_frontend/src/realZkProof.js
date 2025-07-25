// Prawdziwy ZK prover używający snarkjs
// Nie ujawnia secretValue - prawdziwy zero-knowledge proof!

export class RealZKSMTProver {
  constructor() {
    console.log('RealZKSMTProver initialized with snarkjs');
  }

  async generateMembershipProof(publicKey, secretValue, salt, siblings, expectedRoot) {
    try {
      // Import snarkjs dynamically
      const snarkjs = (await import('snarkjs')).default;
      
      console.log(`Generating REAL ZK proof for publicKey=${publicKey}, expectedRoot=${expectedRoot}`);
      console.log('Secret value and siblings are HIDDEN from verifier!');
      
      // Przygotuj dane wejściowe dla circuit'u
      const input = {
        publicKey: publicKey.toString(),
        expectedRoot: expectedRoot.toString(),
        secretValue: secretValue.toString(),
        salt: salt.toString(),
        sibling1: siblings[0].toString(),
        sibling2: siblings[1].toString(),
        sibling3: siblings[2].toString()
      };
      
      console.log('Circuit input (including private witnesses):', input);
      
      // Wygeneruj proof używając skompilowanego circuit'u
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        '/zk_membership.wasm',
        '/zk_membership_final.zkey'
      );
      
      console.log('Proof generated successfully!');
      console.log('Public signals (only these are visible):', publicSignals);
      console.log('Proof:', proof);
      
      return {
        proof: proof,
        publicSignals: publicSignals
      };
      
    } catch (error) {
      console.error('Error generating ZK proof:', error);
      throw error;
    }
  }

  async verifyProof(proof, publicSignals) {
    try {
      const snarkjs = (await import('snarkjs')).default;
      
      // Załaduj verification key
      const response = await fetch('/zk_membership_vkey.json');
      const vKey = await response.json();
      
      // Weryfikuj proof
      const result = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      
      console.log('Proof verification result:', result);
      return result;
      
    } catch (error) {
      console.error('Error verifying ZK proof:', error);
      return false;
    }
  }

  // Konwertuj proof do hex dla wysłania do backend
  proofToHex(proofData) {
    const proofObj = {
      proof: proofData.proof,
      publicSignals: proofData.publicSignals
    };
    
    const jsonString = JSON.stringify(proofObj);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonString);
    
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  hexToProof(hexString) {
    try {
      const bytes = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(bytes);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error parsing proof hex:', error);
      return null;
    }
  }
}
