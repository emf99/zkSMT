// ZK Proof Generator for SMT
const snarkjs = require("snarkjs");
const fs = require("fs");

class ZKSMTProver {
    constructor() {
        this.circuitWasm = "./minimal_smt.wasm";
        this.circuitZkey = "./minimal_smt_final.zkey";
        this.verificationKey = JSON.parse(fs.readFileSync("./verification_key.json"));
    }

    // Generuje ZK proof że znamy value dla danego key przy obecnym root
    async generateMembershipProof(key, value, nonce) {
        const root = key * key + value * value + nonce * nonce;
        
        const input = {
            root: root.toString(),
            key: key.toString(),
            value: value.toString(),
            nonce: nonce.toString()
        };

        console.log("Generating proof for input:", input);

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            this.circuitWasm,
            this.circuitZkey
        );

        return {
            proof: this.formatProofForSolidity(proof),
            publicSignals,
            input: {
                root: root.toString(),
                key: key.toString()
            }
        };
    }

    // Weryfikuje ZK proof
    async verifyProof(proof, publicSignals) {
        const res = await snarkjs.groth16.verify(
            this.verificationKey,
            publicSignals,
            proof
        );
        return res;
    }

    // Formatuje proof do postaci używanej przez canister
    formatProofForSolidity(proof) {
        return {
            pi_a: [proof.pi_a[0], proof.pi_a[1]],
            pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            pi_c: [proof.pi_c[0], proof.pi_c[1]]
        };
    }

    // Konwertuje proof do hex string dla canister
    proofToHex(proof) {
        const data = {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c
        };
        return Buffer.from(JSON.stringify(data)).toString('hex');
    }
}

module.exports = ZKSMTProver;

// Test example
async function testZKProof() {
    const prover = new ZKSMTProver();
    
    // Bob ma id=2, używamy nonce=4, dla key=3 (hash("bob"))
    const result = await prover.generateMembershipProof(3, 2, 4);
    
    console.log("Generated proof:", result);
    console.log("Proof hex:", prover.proofToHex(result.proof));
    
    // Verify
    const isValid = await prover.verifyProof(result.proof, result.publicSignals);
    console.log("Proof valid:", isValid);
}

if (require.main === module) {
    testZKProof().catch(console.error);
}
