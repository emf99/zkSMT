include "node_modules/circomlib/circuits/mimcsponge.circom";
include "node_modules/circomlib/circuits/mux1.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// Template dla prostego SMT membership proof
template SMTMembership(nLevels) {
    // Publiczne inputs
    signal input root;           // Root hash SMT
    signal input key;            // Klucz do sprawdzenia
    
    // Prywatne inputs (witness)
    signal private input value;          // Wartość dla klucza
    signal private input siblings[nLevels];  // Sibling nodes
    signal private input pathIndices[nLevels]; // 0=left, 1=right
    
    // Komponenty
    component hashers[nLevels];
    component mux[nLevels];
    
    // Hash liścia (key, value)
    component leafHasher = MiMCSponge(2, 220, 1);
    leafHasher.ins[0] <== key;
    leafHasher.ins[1] <== value;
    leafHasher.k <== 0;
    
    // Ścieżka przez drzewo
    signal levelHashes[nLevels + 1];
    levelHashes[0] <== leafHasher.outs[0];
    
    for (var i = 0; i < nLevels; i++) {
        // Multiplexer dla wyboru kolejności hash(left, right)
        mux[i] = Mux1();
        mux[i].c[0] <== levelHashes[i];     // current jako left
        mux[i].c[1] <== siblings[i];       // sibling jako left
        mux[i].s <== pathIndices[i];
        
        // Hash parent node
        hashers[i] = MiMCSponge(2, 220, 1);
        hashers[i].ins[0] <== mux[i].out;
        hashers[i].ins[1] <== pathIndices[i] == 0 ? siblings[i] : levelHashes[i];
        hashers[i].k <== 0;
        
        levelHashes[i + 1] <== hashers[i].outs[0];
    }
    
    // Sprawdź czy obliczony root == podany root
    component eq = IsEqual();
    eq.in[0] <== levelHashes[nLevels];
    eq.in[1] <== root;
    eq.out === 1;
}

component main = SMTMembership(4);  // 4 poziomy dla prostoty
